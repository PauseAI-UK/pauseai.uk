import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkoutPostgres,
  checkoutPostgresDir,
  defaultHost,
  INITDB_ARGS,
  isReady,
  isRunning,
  postgresBase,
  postgresDir,
  postgresEnv,
  serverOptions,
  startPostgres,
  stopPostgres,
  sweepCheckoutPostgres,
  sweepPostgres,
} from "./own-postgres.mjs";

const temporary = () => mkdtempSync(join(tmpdir(), "own-postgres-test-"));

/** A stand-in for execFileSync that records each command, failing those `fails` names. */
function recorder(fails: string[] = [], stderr = "initdb: error: no such locale\n") {
  const calls: string[][] = [];
  const run = (command: string, args: string[]) => {
    calls.push([command, ...args]);
    if (fails.includes(command)) throw Object.assign(new Error(`${command} failed`), { stderr: Buffer.from(stderr) });
    return "";
  };
  return { calls, run };
}

describe("where the server lives", () => {
  it("is in memory where there's /dev/shm, else the temporary folder", () => {
    const shm = temporary();
    expect(postgresBase(shm)).toBe(shm);
    expect(postgresBase(join(shm, "missing"))).toBe(tmpdir());
  });

  it("is a folder named after the gate's process", () => {
    expect(postgresDir(4242, "/dev/shm")).toBe("/dev/shm/gate-postgres-4242");
  });

  it("is a folder named from the checkout's path, the same each time", () => {
    const dir = checkoutPostgresDir("/home/jane/pauseai.uk", "/dev/shm");
    expect(dir).toMatch(/^\/dev\/shm\/checkout-postgres-[0-9a-f]{8}$/);
    expect(checkoutPostgresDir("/home/jane/pauseai.uk", "/dev/shm")).toBe(dir);
    expect(checkoutPostgresDir("/home/jane/pauseai.uk/tmp/worktrees/other", "/dev/shm")).not.toBe(dir);
  });
});

describe("defaultHost", () => {
  it("finds the first directory with the server's socket, or falls back to localhost", () => {
    const linux = mkdtempSync(join(tmpdir(), "pg-"));
    const mac = mkdtempSync(join(tmpdir(), "pg-"));
    try {
      writeFileSync(join(mac, ".s.PGSQL.5432"), "");
      expect(defaultHost("5432", [linux, mac])).toBe(mac);
      expect(defaultHost("5433", [linux, mac])).toBe("localhost");
    } finally {
      rmSync(linux, { recursive: true });
      rmSync(mac, { recursive: true });
    }
  });
});

describe("postgresEnv", () => {
  it("points the PG* variables at the server's socket", () => {
    expect(postgresEnv("/dev/shm/gate-postgres-1", "jane")).toEqual({
      PGHOST: "/dev/shm/gate-postgres-1",
      PGPORT: "5432",
      PGUSER: "jane",
    });
  });
});

describe("startPostgres", () => {
  it("makes the server as CI's is made, starts it on its own socket, and returns its variables", () => {
    const { calls, run } = recorder();
    const dir = join(temporary(), "server");
    expect(startPostgres(dir, run, "jane")).toEqual({ env: postgresEnv(dir, "jane") });
    expect(calls).toEqual([
      ["initdb", "--pgdata", join(dir, "data"), "--username=jane", ...INITDB_ARGS],
      ["pg_ctl", "--pgdata", join(dir, "data"), "--log", join(dir, "log"), "--wait", "-o", serverOptions(dir), "start"],
    ]);
    expect(serverOptions(dir)).toContain(`-k ${dir} `);
  });

  it("says why when the server won't start, from the last line of what the command said, and cleans up", () => {
    const { calls, run } = recorder(["initdb"]);
    const dir = join(temporary(), "server");
    mkdirSync(dir);
    expect(startPostgres(dir, run, "jane")).toEqual({ problem: "initdb: error: no such locale" });
    expect(calls.at(-1)?.slice(0, 2)).toEqual(["pg_ctl", "--pgdata"]);
    expect(existsSync(dir)).toBe(false);
  });

  it("gives the error's message when the command said nothing, or wasn't there", () => {
    expect(startPostgres(join(temporary(), "a"), recorder(["initdb"], "").run)).toEqual({ problem: "initdb failed" });
    const missing = () => {
      throw new Error("spawnSync initdb ENOENT");
    };
    expect(startPostgres(join(temporary(), "b"), missing)).toEqual({ problem: "spawnSync initdb ENOENT" });
  });
});

describe("stopPostgres", () => {
  it("stops the server at once and deletes its folder, whether or not one was running", () => {
    const dir = temporary();
    const { calls, run } = recorder(["pg_ctl"]);
    stopPostgres(dir, run);
    expect(calls).toEqual([["pg_ctl", "--pgdata", join(dir, "data"), "--mode=immediate", "stop"]]);
    expect(existsSync(dir)).toBe(false);
  });
});

describe("sweepPostgres", () => {
  it("stops the servers of gates no longer running, and leaves the rest", () => {
    const base = temporary();
    for (const name of ["gate-postgres-11", "gate-postgres-22", "gate-postgres-x", "other-33"])
      mkdirSync(join(base, name));
    const stopped: string[] = [];
    const found = sweepPostgres(
      base,
      (pid) => pid === 22,
      (dir) => stopped.push(dir),
    );
    expect(found).toEqual([join(base, "gate-postgres-11")]);
    expect(stopped).toEqual(found);
  });
});

describe("isRunning", () => {
  it("knows this process runs, and one that has exited doesn't", () => {
    expect(isRunning(process.pid)).toBe(true);
    const gone = spawnSync("node", ["-e", ""]).pid;
    expect(isRunning(gone)).toBe(false);
  });

  it("counts a process it may not signal as running", () => {
    // Process 1 is always there, and belongs to root.
    expect(isRunning(1)).toBe(true);
  });
});

/** Writes the postmaster.pid of a server in `dir`, run by `pid`, with `status` on its eighth line as Postgres writes it. */
function pidFile(dir: string, pid = process.pid, status = "ready") {
  mkdirSync(join(dir, "data"), { recursive: true });
  const lines = [String(pid), join(dir, "data"), "1700000000", "5432", dir, "", "  5432001  0", status];
  writeFileSync(join(dir, "data", "postmaster.pid"), `${lines.join("\n")}\n`);
}

describe("isReady", () => {
  it("is true once the server's running process says it's ready", () => {
    const dir = temporary();
    expect(isReady(dir)).toBe(false);
    pidFile(dir, process.pid, "starting");
    expect(isReady(dir)).toBe(false);
    pidFile(dir);
    expect(isReady(dir)).toBe(true);
    expect(isReady(dir, () => false)).toBe(false);
  });
});

describe("sweepCheckoutPostgres", () => {
  it("stops the servers of checkouts that are gone, and leaves the rest and any still starting", () => {
    const base = temporary();
    for (const name of [
      "checkout-postgres-1",
      "checkout-postgres-2",
      "checkout-postgres-3",
      "checkout-postgres-1.lock",
    ])
      mkdirSync(join(base, name));
    writeFileSync(join(base, "checkout-postgres-1", "checkout"), "/gone");
    writeFileSync(join(base, "checkout-postgres-2", "checkout"), "/here");
    const stopped: string[] = [];
    const found = sweepCheckoutPostgres(
      base,
      (path) => path === "/here",
      (dir) => stopped.push(dir),
    );
    expect(found).toEqual([join(base, "checkout-postgres-1")]);
    expect(stopped).toEqual(found);
  });
});

describe("checkoutPostgres", () => {
  /** A stand-in for execFileSync whose `pg_ctl start` leaves a ready server's postmaster.pid, as the real one does. */
  function fakeServer() {
    const { calls, run: record } = recorder();
    const run = (command: string, args: string[]) => {
      record(command, args);
      if (command === "pg_ctl" && args.at(-1) === "start") pidFile(join(args[1], ".."));
      return "";
    };
    return { calls, run };
  }

  it("starts the checkout's server, naming the checkout in its folder, and returns its variables", () => {
    const base = temporary();
    const { calls, run } = fakeServer();
    const dir = checkoutPostgresDir("/home/jane/pauseai.uk", base);
    expect(checkoutPostgres("/home/jane/pauseai.uk", { base, run, user: "jane" })).toEqual({
      env: postgresEnv(dir, "jane"),
    });
    expect(calls.map((call) => call.slice(0, 1)[0])).toEqual(["pg_ctl", "initdb", "pg_ctl"]);
    expect(readFileSync(join(dir, "checkout"), "utf8")).toBe("/home/jane/pauseai.uk");
    expect(existsSync(`${dir}.lock`)).toBe(false);
  });

  it("starts nothing when the server's already up", () => {
    const base = temporary();
    pidFile(checkoutPostgresDir("/c", base));
    const { calls, run } = fakeServer();
    expect(checkoutPostgres("/c", { base, run, user: "jane" })).toHaveProperty("env");
    expect(calls).toEqual([]);
  });

  it("sweeps the servers of checkouts that are gone as it starts one", () => {
    const base = temporary();
    mkdirSync(join(base, "checkout-postgres-gone"));
    writeFileSync(join(base, "checkout-postgres-gone", "checkout"), join(base, "no-such-checkout"));
    checkoutPostgres("/c", { base, run: fakeServer().run, user: "jane" });
    expect(existsSync(join(base, "checkout-postgres-gone"))).toBe(false);
  });

  it("waits while another process starts it, then uses that one", () => {
    const base = temporary();
    const dir = checkoutPostgresDir("/c", base);
    mkdirSync(`${dir}.lock`);
    const { calls, run } = fakeServer();
    let waits = 0;
    const wait = () => {
      waits += 1;
      pidFile(dir);
    };
    expect(checkoutPostgres("/c", { base, run, user: "jane", wait })).toHaveProperty("env");
    expect(waits).toBe(1);
    expect(calls).toEqual([]);
  });

  it("takes a lock left over two minutes by a process that was killed", () => {
    const base = temporary();
    const dir = checkoutPostgresDir("/c", base);
    mkdirSync(`${dir}.lock`);
    const old = (Date.now() - 180_000) / 1000;
    utimesSync(`${dir}.lock`, old, old);
    const { calls, run } = fakeServer();
    expect(checkoutPostgres("/c", { base, run, user: "jane", wait: () => {} })).toHaveProperty("env");
    expect(calls.map((call) => call[0])).toContain("initdb");
  });

  it("gives up after waiting two minutes on another process", () => {
    const base = temporary();
    const dir = checkoutPostgresDir("/c", base);
    mkdirSync(`${dir}.lock`);
    let time = Date.now();
    const result = checkoutPostgres("/c", {
      base,
      run: fakeServer().run,
      wait: () => {},
      now: () => (time += 200_000),
    });
    expect(result).toEqual({ problem: `${dir}.lock was held for over two minutes` });
  });

  it("says why when it can't make the lock, or the server won't start", () => {
    const base = join(temporary(), "missing");
    expect(checkoutPostgres("/c", { base, run: fakeServer().run })).toHaveProperty(
      "problem",
      expect.stringContaining("ENOENT"),
    );
    const fails = recorder(["initdb"]);
    const ok = temporary();
    expect(checkoutPostgres("/c", { base: ok, run: fails.run })).toEqual({ problem: "initdb: error: no such locale" });
    expect(existsSync(`${checkoutPostgresDir("/c", ok)}.lock`)).toBe(false);
  });
});

const hasInitdb = spawnSync("initdb", ["--version"]).status === 0;

// CI's test jobs have Postgres's client, not its server, so this runs where initdb is installed. initdb
// alone takes a couple of seconds, and over six beside the rest of the tests.
describe.skipIf(!hasInitdb)("a real server", () => {
  it(
    "starts, makes databases with the site's extensions in CI's collation, and is gone once stopped",
    { timeout: 60_000 },
    () => {
      const dir = postgresDir(process.pid, temporary());
      const started = startPostgres(dir);
      expect(started).toHaveProperty("env");
      try {
        const env = { ...process.env, ...(started as { env: Record<string, string> }).env };
        execFileSync("createdb", ["gate_postgres_test"], { env });
        const said = execFileSync(
          "psql",
          [
            "-XAtq",
            "-d",
            "gate_postgres_test",
            "-c",
            "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; SELECT datcollate, current_setting('TimeZone') FROM pg_database WHERE datname = current_database()",
          ],
          { env, encoding: "utf8" },
        );
        expect(said.trim()).toBe("C.UTF-8|Etc/UTC");
      } finally {
        stopPostgres(dir);
      }
      expect(existsSync(dir)).toBe(false);
    },
  );
});
