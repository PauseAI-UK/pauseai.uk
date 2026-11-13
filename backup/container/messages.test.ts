import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { run } from "./backup.ts";
import { archiveMessages, tarHeader, type Site } from "./messages.ts";

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

describe("archiveMessages", () => {
  it("writes every message into a tar file that tar reads back, each under its key", async () => {
    const long = `one-off/${"a".repeat(80)}@pauseai.uk/${"b".repeat(60)}.eml.gz`;
    const messages = { "jo@pauseai.uk/m1.eml.gz": "first", [long]: "x".repeat(600) };
    const path = join(dir, "good.tar");
    const asked = site(messages);
    const report = await archiveMessages(asked, path, AT);
    expect(asked.asked[1]).toBe("/api/backup/messages?key=jo%40pauseai.uk%2Fm1.eml.gz");
    expect(report).toMatchObject({ messages: 2, missing: [] });
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
    const report = await archiveMessages(site({ a: big }, ["a", "gone"]), path, AT);
    expect(report).toMatchObject({ messages: 1, missing: ["gone"] });
    expect((await readFile(path)).length).toBe(report.bytes);
  });

  it("fails where the site won't list its messages, or send one", async () => {
    await expect(
      archiveMessages(async () => new Response("no", { status: 401 }), join(dir, "x.tar"), AT),
    ).rejects.toThrow("The site wouldn't list its messages: 401.");
    const failing: Site = async (path) =>
      path === "/api/backup/messages" ? Response.json({ keys: ["a"] }) : new Response("down", { status: 502 });
    await expect(archiveMessages(failing, join(dir, "y.tar"), AT)).rejects.toThrow(
      "The site wouldn't send message a: 502.",
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
