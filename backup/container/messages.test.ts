import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { run } from "./backup.ts";
import { archiveMessages, refreshDay, tarHeader, tarIndex, why, type Site } from "./messages.ts";

const AT = new Date("2026-11-13T03:00:00.000Z");
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "backup-messages-test-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** A site keeping `messages`, by key; listing `listed`, which may name some it doesn't keep. */
function site(messages: Record<string, string>, listed = Object.keys(messages)): Site & { asked: string[] } {
  const asked: string[] = [];
  const ask = async (path: string) => {
    asked.push(path);
    if (path === "/api/backup/messages") return Response.json({ keys: listed });
    const key = new URL(path, "https://site.example").searchParams.get("key")!;
    return key in messages ? new Response(messages[key]) : new Response("Not found", { status: 404 });
  };
  return Object.assign(ask, { asked });
}

/** No waiting, for the tests: the pauses and retries happen at once. */
const noWait = async () => {};

/** Archives the site's messages with no waiting, copying from `previous`, dated `at`. */
const archive = (from: Site, path: string, previous?: string, at = AT) =>
  archiveMessages(from, path, at, previous, noWait);

/** A day that isn't `key`'s to be fetched again (refreshDay), so it's copied that night. */
const notItsDay = (key: string) => new Date(Date.UTC(2026, 10, 15 + ((refreshDay(key) + 1) % 7)));

describe("archiveMessages", () => {
  it("writes every message into a tar file that tar reads back, each under its key", async () => {
    const long = `one-off/${"a".repeat(80)}@pauseai.uk/${"b".repeat(60)}.eml.gz`;
    const messages = { "jo@pauseai.uk/m1.eml.gz": "first", [long]: "x".repeat(600) };
    const path = join(dir, "good.tar");
    const asked = site(messages);
    const report = await archive(asked, path);
    expect(asked.asked[1]).toBe("/api/backup/messages?key=jo%40pauseai.uk%2Fm1.eml.gz");
    expect(report).toMatchObject({ messages: 2, fetched: 2, missing: [], failed: [] });
    const file = await readFile(path);
    expect(report.bytes).toBe(file.length);
    expect(file.length % 512).toBe(0);
    expect((await run("tar", ["-tf", path])).trim().split("\n")).toEqual(Object.keys(messages));
    const out = join(dir, "out");
    await run("mkdir", ["-p", out]);
    await run("tar", ["-xf", path, "-C", out]);
    expect(await readFile(join(out, long), "utf8")).toBe(messages[long]);
    expect(await readFile(join(out, "jo@pauseai.uk/m1.eml.gz"), "utf8")).toBe("first");
  });

  it("names each message the site listed but couldn't send, and leaves it out", async () => {
    // One big enough to fill the file's buffer, which the archive waits on.
    const big = "y".repeat(1_000_000);
    const path = join(dir, "missing.tar");
    const report = await archive(site({ a: big }, ["a", "gone"]), path);
    expect(report).toMatchObject({ messages: 1, missing: ["gone"] });
    expect((await readFile(path)).length).toBe(report.bytes);
  });

  it("says how far it's got in the container's logs: at the start, every hundred, and at the end", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const messages = Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`m${i}.eml.gz`, "x"]));
    await archive(site(messages), join(dir, "progress.tar"));
    expect(info.mock.calls.map(([line]) => line)).toEqual([
      "Messages: 0 of 250, 0 fetched from the site",
      "Messages: 100 of 250, 100 fetched from the site",
      "Messages: 200 of 250, 200 fetched from the site",
      "Messages: 250 of 250, 250 fetched from the site",
    ]);
    info.mockRestore();
  });

  it("copies what last night's archive has, fetching only the rest, and leaves out what the site no longer lists", async () => {
    const long = `one-off/${"a".repeat(80)}@pauseai.uk/${"b".repeat(60)}.eml.gz`;
    const last = join(dir, "last.tar");
    await archive(site({ [long]: "kept", b: "erased" }), last);
    // The site's copy of the kept one is different here, to show it's copied, not fetched.
    const asked = site({ [long]: "from the site", c: "new" }, [long, "c"]);
    const path = join(dir, "tonight.tar");
    const report = await archive(asked, path, last, notItsDay(long));
    expect(report).toMatchObject({ messages: 2, fetched: 1, missing: [] });
    expect(report).not.toHaveProperty("previousUnused");
    expect(asked.asked).toEqual(["/api/backup/messages", "/api/backup/messages?key=c"]);
    const index = await tarIndex(path);
    expect([...index.keys()]).toEqual([long, "c"]);
    const file = await readFile(path);
    const kept = index.get(long)!;
    expect(file.toString("utf8", kept.offset, kept.offset + kept.size)).toBe("kept");
  });

  it("fetches a message again on its day of the week, keeping last night's copy if the site fails", async () => {
    const last = join(dir, "weekly-last.tar");
    await archive(site({ a: "old" }), last);
    const onItsDay = new Date(Date.UTC(2026, 10, 15 + refreshDay("a")));
    const fresh = await archive(site({ a: "new" }), join(dir, "weekly.tar"), last, onItsDay);
    expect(fresh).toMatchObject({ fetched: 1, failed: [] });
    const down: Site = async (path) =>
      path === "/api/backup/messages" ? Response.json({ keys: ["a"] }) : new Response("down", { status: 503 });
    const kept = await archive(down, join(dir, "weekly-down.tar"), last, onItsDay);
    expect(kept).toMatchObject({ messages: 1, fetched: 0, failed: [] });
  });

  it("fetches them all where last night's archive is missing, or can't be read, saying why", async () => {
    const messages = { a: "A" };
    expect(await archive(site(messages), join(dir, "n1.tar"), join(dir, "none.tar"))).toMatchObject({ fetched: 1 });
    // An empty one, as the container saves when the Worker sends none: no archive, not a broken one.
    await writeFile(join(dir, "empty.tar"), "");
    const fromEmpty = await archive(site(messages), join(dir, "n2.tar"), join(dir, "empty.tar"));
    expect(fromEmpty).toMatchObject({ fetched: 1 });
    expect(fromEmpty).not.toHaveProperty("previousUnused");
    const broken = async (name: string, contents: Buffer) => {
      await writeFile(join(dir, name), contents);
      return archive(site(messages), join(dir, `out-${name}`), join(dir, name));
    };
    expect(await broken("junk.tar", Buffer.alloc(1024, 1))).toMatchObject({
      fetched: 1,
      previousUnused: "Not a tar header at byte 0.",
    });
    const header = tarHeader("a", 10_000, AT);
    expect((await broken("short.tar", Buffer.concat([header, Buffer.alloc(512)]))).previousUnused).toBe(
      "a runs past the end of the file.",
    );
    const whole = Buffer.concat([tarHeader("a", 1, AT), Buffer.alloc(512)]);
    expect((await broken("unended.tar", whole)).previousUnused).toBe(
      "The file ends without the empty blocks that end a tar file.",
    );
  });

  it("pauses after each batch it asked the site for, but not one it copied", async () => {
    const waits: number[] = [];
    const wait = async (ms: number) => void waits.push(ms);
    const last = join(dir, "pause-last.tar");
    await archive(site({ a: "A" }), last);
    await archiveMessages(site({ a: "A" }), join(dir, "pause.tar"), notItsDay("a"), last, wait);
    expect(waits).toEqual([]);
    await archiveMessages(site({ a: "A", b: "B", c: "C" }), join(dir, "pause2.tar"), AT, undefined, wait);
    expect(waits).toEqual([500, 500]);
  });

  it("tries a request again after waits that double to two minutes, and leaves out one it never gets", async () => {
    const waits: number[] = [];
    const wait = async (ms: number) => void (ms !== 500 && waits.push(ms));
    let tries = 0;
    const flaky: Site = async (path) => {
      if (path === "/api/backup/messages") return Response.json({ keys: ["a"] });
      tries++;
      if (tries === 1) throw new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
      if (tries === 2) return new Response("busy", { status: 429 });
      return new Response("A");
    };
    expect(await archiveMessages(flaky, join(dir, "flaky.tar"), AT, undefined, wait)).toMatchObject({ fetched: 1 });
    expect(waits).toEqual([1000, 2000]);
    waits.length = 0;
    const down: Site = async (path) => {
      if (path === "/api/backup/messages") return Response.json({ keys: ["a", "b"] });
      if (path.endsWith("=a")) throw new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
      return new Response("B");
    };
    const report = await archiveMessages(down, join(dir, "down.tar"), AT, undefined, wait);
    // The archive is still made, with what it got, and names what it didn't.
    expect(report).toMatchObject({
      messages: 1,
      fetched: 1,
      failed: ["a (fetch failed: UND_ERR_CONNECT_TIMEOUT, 9 times)"],
    });
    expect([...(await tarIndex(join(dir, "down.tar"))).keys()]).toEqual(["b"]);
    expect(waits).toEqual([1000, 2000, 4000, 8000, 16000, 32000, 60000, 120000]);
    const unreachable: Site = async () => {
      throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
    };
    await expect(archiveMessages(unreachable, join(dir, "x.tar"), AT, undefined, wait)).rejects.toThrow(
      "The site wouldn't list its messages: fetch failed: ENOTFOUND, 9 times.",
    );
  });

  it("fails where the site won't list its messages, and leaves out one it won't send, without trying again", async () => {
    await expect(archive(async () => new Response("no", { status: 401 }), join(dir, "x.tar"))).rejects.toThrow(
      "The site wouldn't list its messages: 401.",
    );
    const refusing: Site = async (path) =>
      path === "/api/backup/messages" ? Response.json({ keys: ["a"] }) : new Response("no", { status: 403 });
    expect(await archive(refusing, join(dir, "y.tar"))).toMatchObject({ messages: 0, failed: ["a (403)"] });
  });
});

describe("archiveMessages's waits", () => {
  it("waits a second before trying again, and half a second after a batch, by default", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    let tries = 0;
    const once: Site = async (path) => {
      if (path === "/api/backup/messages") return Response.json({ keys: ["a"] });
      return ++tries === 1 ? new Response("busy", { status: 503 }) : new Response("A");
    };
    const done = archiveMessages(once, join(dir, "wait.tar"), AT);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await done).toMatchObject({ fetched: 1 });
    vi.useRealTimers();
  });
});

describe("why", () => {
  it("puts an error's cause after its message: the code, else its words", () => {
    expect(why(new Error("fetch failed"))).toBe("fetch failed");
    expect(why(new Error("fetch failed", { cause: { message: "socket hang up" } }))).toBe(
      "fetch failed: socket hang up",
    );
  });
});

describe("tarHeader", () => {
  it("refuses a key too long for tar", () => {
    expect(() => tarHeader("a".repeat(101), 1, AT)).toThrow("A key too long for tar");
    expect(() => tarHeader(`${"a".repeat(160)}/b`, 1, AT)).toThrow("A key too long for tar");
    expect(() => tarHeader(`a/${"b".repeat(101)}`, 1, AT)).toThrow("A key too long for tar");
  });
});
