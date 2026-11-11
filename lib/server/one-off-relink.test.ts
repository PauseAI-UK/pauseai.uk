import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { stubLettersInboxEnv } from "@/tests/gmail-sends";
import { query } from "./db";
import { keepOneOff } from "./one-off-emails";
import { relinkOneOffs } from "./one-off-relink";
import type { GmailMessageHeaders } from "./outside-services/gmail";
import { saveLetterReply } from "./outside-services/blobs";
import { readPoliticianBook } from "./politician-book";
import { gzipSync } from "node:zlib";

const LATER = () => Date.now() + 60_000;

/** Keeps a message from `from` to `to` in thread `thread`, its text `text`. */
async function keep(id: string, from: string, text = "Hello", to = "policy@pauseai.uk", thread = `t-${id}`) {
  const message: GmailMessageHeaders = {
    id,
    threadId: thread,
    labelIds: [],
    internalDate: "1790000000000",
    headers: new Map([
      ["from", from],
      ["to", to],
      ["subject", "A thread"],
      ["message-id", `<${id}@example.org>`],
    ]),
  };
  const raw = Buffer.from(`Subject: A thread\r\n\r\n${text}`);
  return (await keepOneOff("policy@pauseai.uk", message, raw, await readPoliticianBook(true), ["policy@pauseai.uk"]))!;
}

const linked = () =>
  query<{ thread: number; id: number }>(
    "SELECT thread_id::int AS thread, notable_person_id::int AS id FROM one_off_thread_people ORDER BY thread_id, notable_person_id",
  );

describeWithDatabase("relinking one-off threads", () => {
  useTestDatabase();
  beforeEach(() => stubLettersInboxEnv());
  afterEach(() => vi.unstubAllEnvs());

  it("reads the quotes of messages kept before they were stored, and links whom they quote", async () => {
    const meg = await addTestPolitician({ name: "Dame Meg Hillier", email: "meg.hillier.mp@parliament.uk" });
    const thread = await keep(
      "a",
      "jane@example.com",
      "From: x@example.com\nSent: today\nTo: meghilliermp@parliament.uk",
    );
    await query("UPDATE one_off_messages SET quoted_addresses = NULL, quoted_names = NULL");
    await query("DELETE FROM one_off_thread_people");
    const gone = await keep("b", "jane@example.com");
    await query(
      "UPDATE one_off_messages SET quoted_addresses = NULL, quoted_names = NULL, blob_key = 'gone' WHERE id = (SELECT max(id) FROM one_off_messages)",
    );
    expect(await relinkOneOffs(LATER())).toEqual({ read: 2, unread: 0, linked: 1, unlinked: 0, offices: 0 });
    expect(await linked()).toEqual([{ thread, id: meg }]);
    expect(await query("SELECT quoted_addresses AS q FROM one_off_messages ORDER BY id")).toEqual([
      { q: ["x@example.com", "meghilliermp@parliament.uk"] },
      { q: [] },
    ]);
    expect(gone).not.toBe(thread);
  });

  it("stops reading quotes at its time, and takes no one off a thread with quotes still unread", async () => {
    const polly = await addTestPolitician({ email: "polly@example.org" });
    const thread = await keep("a", "jane@example.com", "Hi", "polly@example.org");
    await query("UPDATE one_off_messages SET quoted_addresses = NULL, quoted_names = NULL");
    await query("UPDATE notable_people SET email = NULL");
    expect(await relinkOneOffs(Date.now() - 1)).toEqual({ read: 0, unread: 1, linked: 0, unlinked: 0, offices: 0 });
    expect(await linked()).toEqual([{ thread, id: polly }]);
    expect(await relinkOneOffs(LATER())).toMatchObject({ read: 1, unread: 0, unlinked: 1 });
    expect(await linked()).toEqual([]);
  });

  it("finds an office's address seen only beside one politician, and links its threads to them", async () => {
    const polly = await addTestPolitician();
    const other = await addTestPolitician({
      airtableId: null,
      name: "Oscar Other",
      email: "oscar.other.mp@parliament.uk",
      constituency: "Elsewhere",
    });
    await keep("a", "aaron.lukas@parliament.uk", "Hi", "polly.placeholder.mp@parliament.uk");
    const alone = await keep("b", "aaron.lukas@parliament.uk", "Following up");
    await keep("c", "maisie.moss@parliament.uk", "Hi", "polly.placeholder.mp@parliament.uk");
    await keep("d", "maisie.moss@parliament.uk", "Hi", "oscar.other.mp@parliament.uk");
    await keep("e", "noreply@parliament.uk", "Hi", "polly.placeholder.mp@parliament.uk");
    await keep("f", "nobody.atall@parliament.uk");
    expect(await relinkOneOffs(LATER())).toMatchObject({ offices: 1, linked: 1 });
    expect(await query("SELECT address, notable_person_id::int AS id, source FROM politician_addresses")).toEqual([
      { address: "aaron.lukas@parliament.uk", id: polly, source: "office" },
    ]);
    expect((await linked()).filter((row) => row.thread === alone)).toEqual([{ thread: alone, id: polly }]);
    expect(other).not.toBe(polly);
    // Found again each time, not twice.
    expect(await relinkOneOffs(LATER())).toMatchObject({ offices: 1, linked: 0 });
    expect(await query("SELECT 1 FROM politician_addresses")).toHaveLength(1);
  });

  it("finds an office's address on a message whose quotes are still unread", async () => {
    const polly = await addTestPolitician();
    await keep("a", "aaron.lukas@parliament.uk", "Hi", "polly.placeholder.mp@parliament.uk");
    await query("UPDATE one_off_messages SET quoted_addresses = NULL, quoted_names = NULL");
    expect(await relinkOneOffs(Date.now() - 1)).toMatchObject({ unread: 1, offices: 1 });
    expect(await query("SELECT notable_person_id::int AS id FROM politician_addresses")).toEqual([{ id: polly }]);
  });

  it("leaves a politician staff took off a thread off it", async () => {
    const polly = await addTestPolitician();
    const thread = await keep("a", "polly.placeholder.mp@parliament.uk");
    await query("DELETE FROM one_off_thread_people");
    await query(
      "INSERT INTO one_off_unlinked (thread_id, notable_person_id, unlinked_by) VALUES ($1, $2, 'jo@pauseai.uk')",
      [thread, polly],
    );
    expect(await relinkOneOffs(LATER())).toMatchObject({ linked: 0 });
    expect(await linked()).toEqual([]);
  });

  it("works out again whether a thread has someone else in it, as the book says who's a politician", async () => {
    const polly = await addTestPolitician();
    await keep("a", "polly.personal@example.com");
    const marked = async () => (await query<{ s: boolean }>("SELECT someone_else AS s FROM one_off_threads"))[0].s;
    expect(await marked()).toBe(true);
    await query(
      "INSERT INTO politician_addresses (address, notable_person_id, source, added_by) VALUES ('polly.personal@example.com', $1, 'staff', 'jo@pauseai.uk')",
      [polly],
    );
    await relinkOneOffs(LATER());
    expect(await marked()).toBe(false);
  });

  it("reads a kept blob's quotes", async () => {
    await saveLetterReply(
      "one-off/x.eml.gz",
      gzipSync(Buffer.from("Subject: x\r\n\r\nOn a day a@example.com wrote:\n> hi")),
    );
    const { quotesOf } = await import("./one-off-relink");
    expect(await quotesOf("one-off/x.eml.gz")).toEqual({ addresses: ["a@example.com"], names: [] });
  });
});
