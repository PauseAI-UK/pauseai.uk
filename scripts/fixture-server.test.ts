import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listenerPids, serverState, stopStaleServer, workingTree } from "./fixture-server.mjs";

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fixture-server-test-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const CHECKOUT = "/home/jane/pauseai.uk";
const TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const OLD_TREE = "0123456789abcdef0123456789abcdef01234567";

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("serverState", () => {
  it("is none when nothing answered", () => {
    expect(serverState(null, CHECKOUT, TREE)).toBe("none");
  });

  it("is foreign for another checkout's build, or something that isn't a fixture build", () => {
    expect(
      serverState(headers({ "X-Fixture-Checkout": "/home/jane/other", "X-Fixture-Tree": TREE }), CHECKOUT, TREE),
    ).toBe("foreign");
    expect(serverState(headers({}), CHECKOUT, TREE)).toBe("foreign");
  });

  it("is current for this checkout's build of the tree as it is", () => {
    expect(serverState(headers({ "X-Fixture-Checkout": CHECKOUT, "X-Fixture-Tree": TREE }), CHECKOUT, TREE)).toBe(
      "current",
    );
  });

  it("is stale for this checkout's build of another tree, or of none it names", () => {
    expect(serverState(headers({ "X-Fixture-Checkout": CHECKOUT, "X-Fixture-Tree": OLD_TREE }), CHECKOUT, TREE)).toBe(
      "stale",
    );
    expect(serverState(headers({ "X-Fixture-Checkout": CHECKOUT }), CHECKOUT, TREE)).toBe("stale");
  });
});

describe("workingTree", () => {
  it("changes with an edit, uncommitted or untracked, and comes back with the files as they were", () => {
    const repo = tempDir();
    const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" });
    git("init", "-q");
    writeFileSync(join(repo, "page.ts"), "one\n");
    git("add", "page.ts");
    git("-c", "user.name=Jane Smith", "-c", "user.email=jane.smith@example.com", "commit", "-qm", "First");
    const committed = workingTree(repo);
    expect(committed).toBe(git("rev-parse", "HEAD^{tree}").trim());

    writeFileSync(join(repo, "page.ts"), "two\n");
    const edited = workingTree(repo);
    expect(edited).not.toBe(committed);

    writeFileSync(join(repo, "new.ts"), "three\n");
    expect(workingTree(repo)).not.toBe(edited);

    rmSync(join(repo, "new.ts"));
    writeFileSync(join(repo, "page.ts"), "one\n");
    expect(workingTree(repo)).toBe(committed);
    // The checkout's own index is left as it was.
    expect(git("status", "--porcelain")).toBe("");
  });
});

describe("listenerPids", () => {
  const TABLE_HEAD =
    "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n";
  // A socket listening on 0.0.0.0:4924 (0x133C), one connected from that port, and one listening on another.
  const TCP =
    TABLE_HEAD +
    "   0: 00000000:133C 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 111 1 0 100 0 0 10 0\n" +
    "   1: 0100007F:133C 0100007F:9C40 01 00000000:00000000 00:00000000 00000000  1000        0 222 1 0 100 0 0 10 0\n" +
    "   2: 00000000:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 333 1 0 100 0 0 10 0\n";
  // The same port listening over IPv6.
  const TCP6 =
    TABLE_HEAD +
    "   0: 00000000000000000000000000000000:133C 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 444 1 0 100 0 0 10 0\n";

  function fakeProc({ tcp6 = true } = {}): string {
    const proc = tempDir();
    mkdirSync(join(proc, "net"));
    writeFileSync(join(proc, "net", "tcp"), TCP);
    if (tcp6) writeFileSync(join(proc, "net", "tcp6"), TCP6);
    const process = (pid: string, links: string[]) => {
      mkdirSync(join(proc, pid, "fd"), { recursive: true });
      links.forEach((link, fd) => symlinkSync(link, join(proc, pid, "fd", String(fd))));
    };
    process("10", ["/dev/null", "socket:[111]"]);
    process("11", ["socket:[222]"]);
    process("12", ["socket:[333]"]);
    process("13", ["pipe:[555]", "socket:[444]"]);
    // A process whose fd folder can't be read, as another user's can't.
    mkdirSync(join(proc, "14"));
    writeFileSync(join(proc, "self"), "");
    return proc;
  }

  it("finds the processes holding a socket that listens on the port, over IPv4 or IPv6", () => {
    expect(listenerPids(4924, fakeProc()).sort()).toEqual([10, 13]);
  });

  it("does without a table that isn't there", () => {
    expect(listenerPids("4924", fakeProc({ tcp6: false }))).toEqual([10]);
  });

  it("finds none where nothing listens on the port, or there's no /proc", () => {
    expect(listenerPids(5000, fakeProc())).toEqual([]);
    expect(listenerPids(4924, tempDir())).toEqual([]);
  });

  it.runIf(process.platform === "linux")("finds this process listening, from Linux's own /proc", async () => {
    const server = createServer();
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    try {
      const { port } = server.address() as { port: number };
      expect(listenerPids(port)).toEqual([process.pid]);
    } finally {
      server.close();
    }
  });
});

describe("stopStaleServer", () => {
  const url = "http://localhost:4924";
  const ours = (tree: string) => headers({ "X-Fixture-Checkout": CHECKOUT, "X-Fixture-Tree": tree });

  /** A server that answers `answers` times with `served`, then not at all. */
  function setup(served: Headers | null, answers = Infinity, found = [41, 42]) {
    let asked = 0;
    const fetchHeaders = vi.fn(async () => (asked++ < answers ? served : null));
    const kill = vi.fn();
    const log = vi.fn();
    const pids = vi.fn(() => found);
    const wait = vi.fn(async () => {});
    const stop = () =>
      stopStaleServer({ url, dir: CHECKOUT, tree: TREE, headers: fetchHeaders, pids, kill, wait, log });
    return { stop, kill, log, pids, wait };
  }

  it("leaves alone a server built from the tree as it is, another checkout's, and no server", async () => {
    for (const served of [ours(TREE), headers({ "X-Fixture-Checkout": "/home/jane/other" }), null]) {
      const { stop, kill } = setup(served);
      expect(["current", "foreign", "none"]).toContain(await stop());
      expect(kill).not.toHaveBeenCalled();
    }
  });

  it("stops this checkout's server built from another tree, and waits until it no longer answers", async () => {
    const { stop, kill, log, pids } = setup(ours(OLD_TREE), 3);
    expect(await stop()).toBe("stale");
    expect(pids).toHaveBeenCalledWith("4924");
    expect(kill.mock.calls).toEqual([
      [41, "SIGTERM"],
      [42, "SIGTERM"],
    ]);
    expect(log).toHaveBeenCalledWith(
      "▶ http://localhost:4924 is serving a build of this checkout from before its last change. Stopping it (41, 42).",
    );
  });

  it("kills one that outlasts SIGTERM, and passes over a process gone already", async () => {
    const { stop, kill } = setup(ours(OLD_TREE), 60);
    kill.mockImplementationOnce(() => {
      throw new Error("ESRCH");
    });
    expect(await stop()).toBe("stale");
    expect(kill.mock.calls.map(([, signal]) => signal)).toEqual(["SIGTERM", "SIGTERM", "SIGKILL", "SIGKILL"]);
  });

  it("says so when a server still answers after it's killed", async () => {
    const { stop } = setup(ours(OLD_TREE));
    await expect(stop()).rejects.toThrow("http://localhost:4924 still answers after its server was killed.");
  });

  it("says so when it can't find the server's process", async () => {
    const { stop, kill } = setup(ours(OLD_TREE), Infinity, []);
    await expect(stop()).rejects.toThrow("this can't find its process to stop it. Stop it and run again.");
    expect(kill).not.toHaveBeenCalled();
  });

  it("reads a real server's headers, and takes a refused connection as no server", async () => {
    const server = createServer((_, res) => {
      res.writeHead(307, { Location: "/staff/login", "X-Fixture-Checkout": CHECKOUT, "X-Fixture-Tree": TREE });
      res.end();
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const real = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      expect(await stopStaleServer({ url: real, dir: CHECKOUT, tree: TREE })).toBe("current");
    } finally {
      await new Promise((done) => server.close(done));
    }
    expect(await stopStaleServer({ url: real, dir: CHECKOUT, tree: TREE })).toBe("none");
  });

  it("checks this checkout's own server, by default, against its tree as it is", async () => {
    const asked: string[] = [];
    const fetchHeaders = async (url: string) => {
      asked.push(url);
      return null;
    };
    expect(await stopStaleServer({ headers: fetchHeaders })).toBe("none");
    expect(asked[0]).toMatch(/^http:\/\/localhost:\d+$/);
  });
});
