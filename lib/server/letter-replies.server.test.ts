import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubBlobsEnv } from "@/tests/gmail-sends";
import { allResults, atOnce } from "@/tests/at-once";
import { gzipSync } from "node:zlib";
import {
  addTestLetter,
  addTestPolitician,
  describeWithDatabase,
  MAKES_DATABASES,
  useDatabaseUpTo,
  useTestDatabase,
} from "@/tests/database";
import { migrate } from "@/scripts/db-migrate.mjs";
import { query } from "./db.server";
import { claimOneOffs, hasMessage, keepReply, postmarkMessageId } from "./letter-replies.server";
import { letterReply, saveLetterReply } from "./outside-services/blobs.server";
import type { GmailMessageHeaders } from "./outside-services/gmail.server";
import { messageContent } from "./letter-threads.server";

// messageContent as it is, but that a test can run something first, as another run would meanwhile.
vi.mock("./letter-threads.server", async (original) => {
  const actual = await original<typeof import("./letter-threads.server")>();
  return { ...actual, messageContent: vi.fn(actual.messageContent) };
});

describe("postmarkMessageId", () => {
  it("is Postmark's ID for an email it sent, by its Message-ID, and nothing for any other", () => {
    expect(postmarkMessageId("abc-123@mtasv.net")).toBe("abc-123");
    expect(postmarkMessageId("ABC-123@MTASV.NET")).toBe("ABC-123");
    expect(postmarkMessageId("abc-123@example.org")).toBeNull();
    expect(postmarkMessageId(null)).toBeNull();
    expect(postmarkMessageId(undefined)).toBeNull();
  });
});

describeWithDatabase("a letter's thread", () => {
  useTestDatabase();
  beforeEach(stubBlobsEnv);
  afterEach(() => vi.unstubAllEnvs());

  const letter = async () =>
    addTestLetter({ politicianId: await addTestPolitician(), senderEmail: "wendy@example.com" });

  /** A message kept on a letter, as a read of Gmail keeps one. */
  async function onLetter(letterId: number, row: { gmail: string; thread: string; rfc?: string; account?: string }) {
    await query(
      `INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, from_address, at,
         from_us, blob_key, size)
       VALUES ($1, $2, $3, $4, $5, 'polly@parliament.uk', '2026-06-01', false, $6, 1)`,
      [
        letterId,
        row.account ?? "joseph@pauseai.uk",
        row.gmail,
        row.thread,
        row.rfc ?? null,
        `joseph@pauseai.uk/${row.gmail}`,
      ],
    );
  }

  /** A one-off message, in a thread of its own unless `thread` is given. Returns its thread. */
  async function oneOff(row: {
    gmail: string;
    gmailThread?: string;
    rfc?: string;
    inReplyTo?: string[];
    from?: string;
    subject?: string;
    fromUs?: boolean;
    thread?: number;
    text?: string;
  }): Promise<number> {
    const thread =
      row.thread ??
      (
        await query<{ id: number }>(
          "INSERT INTO one_off_threads (subject, latest_at) VALUES ('A thread', now()) RETURNING id::int AS id",
        )
      )[0].id;
    const key = `one-off/joseph@pauseai.uk/${row.gmail}.eml.gz`;
    const subject = row.subject ?? "Re: A letter";
    await saveLetterReply(key, gzipSync(Buffer.from(`Subject: ${subject}\r\n\r\n${row.text ?? "Hello"}`)));
    await query(
      `INSERT INTO one_off_messages (thread_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, in_reply_to,
         from_address, from_name, to_line, cc_line, addresses, subject, at, from_us, blob_key, size)
       VALUES ($1, 'joseph@pauseai.uk', $2, $3, $4, $5, $6, 'Someone', 'polly@parliament.uk', 'cc@example.org', '{}', $7,
         '2026-06-02', $8, $9, 10)`,
      [
        thread,
        row.gmail,
        row.gmailThread ?? `gt-${row.gmail}`,
        row.rfc ?? null,
        row.inReplyTo ?? [],
        row.from ?? "polly@parliament.uk",
        subject,
        row.fromUs ?? false,
        key,
      ],
    );
    return thread;
  }

  const replies = (letterId: number) =>
    query<{ gmail: string; supporter: boolean; us: boolean }>(
      `SELECT gmail_message_id AS gmail, from_supporter AS supporter, from_us AS us FROM letter_replies
       WHERE letter_id = $1 ORDER BY at, id`,
      [letterId],
    );

  it("moves a one-off thread in the letter's Gmail thread, whole, onto the letter, and deletes the empty thread", async () => {
    const id = await letter();
    await onLetter(id, { gmail: "r1", thread: "gt-shared" });
    const thread = await oneOff({ gmail: "o1", gmailThread: "gt-shared" });
    await oneOff({ gmail: "o2", thread, from: "wendy@example.com" });
    await oneOff({ gmail: "o3", thread, from: "joseph@pauseai.uk", fromUs: true });
    expect(await claimOneOffs(id)).toBe(3);
    expect(await replies(id)).toEqual([
      { gmail: "r1", supporter: false, us: false },
      { gmail: "o1", supporter: false, us: false },
      { gmail: "o2", supporter: true, us: false },
      { gmail: "o3", supporter: false, us: true },
    ]);
    expect(await query("SELECT 1 FROM one_off_messages")).toEqual([]);
    expect(await query("SELECT 1 FROM one_off_threads")).toEqual([]);
    // Moving adds nothing to the letter's history.
    expect(await query("SELECT 1 FROM letter_events")).toEqual([]);
  });

  it("moves one that answers a message the letter has, or an email it went as, by Gmail or Postmark", async () => {
    const id = await letter();
    await onLetter(id, { gmail: "r1", thread: "gt-r1", rfc: "kept@parliament.uk" });
    await query(
      `INSERT INTO email_sends (purpose, letter_id, address, outcome, message_id, backend, sender, rfc_message_id)
       VALUES ('mailing', $1, 'x', 'sent', 'g-sent', 'gmail', 'joseph@pauseai.uk', 'sent@pauseai.uk'),
              ('letter', $1, 'x', 'sent', 'pm-sent', 'postmark', NULL, NULL)`,
      [id],
    );
    await oneOff({ gmail: "o1", inReplyTo: ["kept@parliament.uk"] });
    await oneOff({ gmail: "o2", inReplyTo: ["sent@pauseai.uk"] });
    await oneOff({ gmail: "o3", inReplyTo: ["pm-sent@mtasv.net"] });
    await oneOff({ gmail: "o4", inReplyTo: ["elsewhere@example.org"] });
    expect(await claimOneOffs(id)).toBe(3);
    expect((await replies(id)).map((row) => row.gmail)).toEqual(["r1", "o1", "o2", "o3"]);
    expect(await query("SELECT gmail_message_id AS gmail FROM one_off_messages")).toEqual([{ gmail: "o4" }]);
  });

  it("moves one in a Gmail thread an email of the letter's went in, from the mailbox it went from", async () => {
    const id = await letter();
    await query(
      `INSERT INTO email_sends (purpose, letter_id, address, outcome, message_id, backend, sender, gmail_thread_id)
       VALUES ('mailing', $1, 'x', 'sent', 'g-sent', 'gmail', 'joseph@pauseai.uk', 'gt-sent')`,
      [id],
    );
    await oneOff({ gmail: "o1", gmailThread: "gt-sent" });
    expect(await claimOneOffs(id)).toBe(1);
  });

  it("drops a copy of a message the letter has, by its Message-ID, with its blob", async () => {
    const id = await letter();
    await onLetter(id, { gmail: "r1", thread: "gt-r1", rfc: "same@parliament.uk" });
    await oneOff({ gmail: "o1", rfc: "same@parliament.uk" });
    expect(await claimOneOffs(id)).toBe(0);
    expect((await replies(id)).map((row) => row.gmail)).toEqual(["r1"]);
    expect(await query("SELECT 1 FROM one_off_messages")).toEqual([]);
    expect(await letterReply("one-off/joseph@pauseai.uk/o1.eml.gz")).toBeUndefined();
  });

  it("moves each message once when runs claim at once, keeping its blob", async () => {
    const id = await letter();
    await onLetter(id, { gmail: "r1", thread: "gt-shared" });
    await oneOff({ gmail: "o1", gmailThread: "gt-shared", rfc: "o1@parliament.uk" });
    expect(allResults(await atOnce(() => claimOneOffs(id))).reduce((a, b) => a + b)).toBe(1);
    expect((await replies(id)).map((row) => row.gmail)).toEqual(["r1", "o1"]);
    expect(await letterReply("one-off/joseph@pauseai.uk/o1.eml.gz")).toBeDefined();
  });

  it("leaves a message another run took after it was listed", async () => {
    const id = await letter();
    await onLetter(id, { gmail: "r1", thread: "gt-shared" });
    await oneOff({ gmail: "o1", gmailThread: "gt-shared" });
    const real = vi.mocked(messageContent).getMockImplementation()!;
    vi.mocked(messageContent).mockImplementationOnce(async (key) => {
      await query("DELETE FROM one_off_messages WHERE gmail_message_id = 'o1'");
      return real(key);
    });
    expect(await claimOneOffs(id)).toBe(0);
    expect((await replies(id)).map((row) => row.gmail)).toEqual(["r1"]);
    expect(await letterReply("one-off/joseph@pauseai.uk/o1.eml.gz")).toBeDefined();
  });

  it("keeps a copy's blob when a message on a letter is kept under the same key", async () => {
    const id = await letter();
    await onLetter(id, { gmail: "r1", thread: "gt-shared", rfc: "same@parliament.uk" });
    await query("UPDATE letter_replies SET blob_key = 'one-off/joseph@pauseai.uk/o1.eml.gz'");
    await oneOff({ gmail: "o1", gmailThread: "gt-shared", rfc: "same@parliament.uk" });
    expect(await claimOneOffs(id)).toBe(0);
    expect(await letterReply("one-off/joseph@pauseai.uk/o1.eml.gz")).toBeDefined();
  });

  it("drops one the letter has by its Gmail ID, under a blob of its own", async () => {
    const id = await letter();
    await onLetter(id, { gmail: "o1", thread: "gt-shared" });
    await oneOff({ gmail: "o1", gmailThread: "gt-shared" });
    expect(await claimOneOffs(id)).toBe(0);
    expect(await query("SELECT 1 FROM one_off_messages")).toEqual([]);
    expect(await letterReply("one-off/joseph@pauseai.uk/o1.eml.gz")).toBeUndefined();
  });

  it("notes an automatic reply as one, so the page marks it", async () => {
    const id = await letter();
    await onLetter(id, { gmail: "r1", thread: "gt-shared" });
    const thread = await oneOff({ gmail: "o1", gmailThread: "gt-shared", subject: "Automatic reply: A letter" });
    await oneOff({ gmail: "o2", thread, subject: "Out of office" });
    // One with no To or Cc line.
    await query("UPDATE one_off_messages SET to_line = '', cc_line = '' WHERE gmail_message_id = 'o2'");
    await claimOneOffs(id);
    const handling = [{ outcome: "not_forwarded", reason: "gmail" }];
    expect(await query("SELECT status, details FROM letter_events ORDER BY id")).toEqual([
      {
        status: "auto_reply",
        details: {
          from: "polly@parliament.uk",
          to: "polly@parliament.uk",
          cc: "cc@example.org",
          handling,
          gmailMessageId: "o1",
        },
      },
      { status: "auto_reply", details: { from: "polly@parliament.uk", handling, gmailMessageId: "o2" } },
    ]);
  });

  it("keeps a thread that isn't the letter's, and moves nothing for a letter with none", async () => {
    const id = await letter();
    await oneOff({ gmail: "o1" });
    expect(await claimOneOffs(id)).toBe(0);
    expect(await query("SELECT 1 FROM one_off_threads")).toHaveLength(1);
  });

  it("knows a message the letter has by its Message-ID, and none without one", async () => {
    const id = await letter();
    await onLetter(id, { gmail: "r1", thread: "gt-r1", rfc: "kept@parliament.uk" });
    expect(await hasMessage(id, "kept@parliament.uk")).toBe(true);
    expect(await hasMessage(id, "other@parliament.uk")).toBe(false);
    expect(await hasMessage(id, null)).toBe(false);
  });

  it("doesn't keep a reply again that the letter has from another mailbox, by its Message-ID", async () => {
    const id = await letter();
    await onLetter(id, { gmail: "r1", thread: "gt-r1", rfc: "kept@parliament.uk", account: "policy@pauseai.uk" });
    const message: GmailMessageHeaders = {
      id: "copy",
      threadId: "gt-copy",
      labelIds: [],
      internalDate: "1790000000000",
      headers: new Map([
        ["from", "polly@parliament.uk"],
        ["message-id", "<kept@parliament.uk>"],
      ]),
    };
    await keepReply("joseph@pauseai.uk", "", id, message, { raw: Buffer.from("x") });
    expect((await replies(id)).map((row) => row.gmail)).toEqual(["r1"]);
  });
});

describeWithDatabase("migration 0096_letter_threads_in_one_place", MAKES_DATABASES, () => {
  const db = useDatabaseUpTo("0094");

  it("moves the one-off threads in letters' threads onto the letters, whole, as claimOneOffs would", async () => {
    const polly = await addTestPolitician();
    const letter = await addTestLetter({
      politicianId: polly,
      senderEmail: "Wendy@example.com",
      repliedAt: "2026-06-01",
    });
    const other = await addTestLetter({ politicianId: polly, senderEmail: "sam@example.com" });
    await query(
      `INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, from_address, at,
         from_us, blob_key, size)
       VALUES ($1, 'joseph@pauseai.uk', 'r1', 'gt-1', 'r1@parliament.uk', 'polly@parliament.uk', '2026-06-01', false, 'k-r1', 1)`,
      [letter],
    );
    await query(
      `INSERT INTO email_sends (purpose, letter_id, address, outcome, message_id, backend)
       VALUES ('letter', $1, 'polly@parliament.uk', 'sent', 'pm-other', 'postmark')`,
      [other],
    );
    const thread = async () =>
      (
        await query<{ id: number }>(
          "INSERT INTO one_off_threads (subject, latest_at) VALUES ('A thread', now()) RETURNING id::int AS id",
        )
      )[0].id;
    const message = (thread: number, gmail: string, extra: Record<string, unknown>) =>
      query(
        `INSERT INTO one_off_messages (thread_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, in_reply_to,
           from_address, to_line, cc_line, addresses, subject, at, from_us, blob_key, size)
         VALUES ($1, 'joseph@pauseai.uk', $2, $3, $4, $5, $6, $7, '', '{}', $8, $9, $10, $11, 1)`,
        [
          thread,
          gmail,
          extra.gmailThread ?? `gt-${gmail}`,
          extra.rfc ?? null,
          extra.inReplyTo ?? [],
          extra.from ?? "polly@parliament.uk",
          extra.to ?? "",
          extra.subject ?? "Re: A letter",
          extra.at ?? "2026-06-02",
          extra.fromUs ?? false,
          `one-off/${gmail}`,
        ],
      );
    // A thread in the letter's Gmail thread: the politician's fresh email, our answer, the supporter, an
    // out-of-office, and a copy of the reply the letter has.
    const first = await thread();
    await message(first, "fresh", { gmailThread: "gt-1", at: "2026-05-30" });
    await message(first, "ours", { inReplyTo: ["fresh@x"], from: "joseph@pauseai.uk", fromUs: true });
    await message(first, "wendy", { from: "wendy@example.com" });
    await message(first, "away", { subject: "Automatic reply: A letter", to: "joseph@pauseai.uk" });
    await message(first, "copy", { rfc: "r1@parliament.uk" });
    // One answering the other letter's email Postmark sent, and one in no letter's thread.
    await message(await thread(), "postmark", { inReplyTo: ["pm-other@mtasv.net"] });
    const alone = await thread();
    await message(alone, "alone", {});

    expect(migrate(db.url, { appliedUpTo: "0094" })).toContain("0096_letter_threads_in_one_place");

    expect(
      await query(
        `SELECT letter_id::int AS letter, gmail_message_id AS gmail, from_us AS us, from_supporter AS supporter
         FROM letter_replies ORDER BY letter_id, at, id`,
      ),
    ).toEqual([
      { letter, gmail: "fresh", us: false, supporter: false },
      { letter, gmail: "r1", us: false, supporter: false },
      { letter, gmail: "ours", us: true, supporter: false },
      { letter, gmail: "wendy", us: false, supporter: true },
      { letter, gmail: "away", us: false, supporter: false },
      { letter: other, gmail: "postmark", us: false, supporter: false },
    ]);
    expect(await query("SELECT gmail_message_id AS gmail FROM one_off_messages")).toEqual([{ gmail: "alone" }]);
    expect(await query("SELECT id::int AS id FROM one_off_threads")).toEqual([{ id: alone }]);
    expect(await query("SELECT letter_id::int AS letter, status, details FROM letter_events")).toEqual([
      {
        letter,
        status: "auto_reply",
        details: {
          from: "polly@parliament.uk",
          to: "joseph@pauseai.uk",
          handling: [{ outcome: "not_forwarded", reason: "gmail" }],
          gmailMessageId: "away",
        },
      },
    ]);
    // Moving adds no reply to a letter's history, so neither letter's replied_at changes.
    expect(await query("SELECT replied_at IS NOT NULL AS replied FROM letters ORDER BY id")).toEqual([
      { replied: true },
      { replied: false },
    ]);
    // A reply kept from Postmark has no Gmail IDs.
    await query(
      `INSERT INTO letter_replies (letter_id, account, from_address, at, from_us, blob_key, size)
       VALUES ($1, 'x@letters.pauseai.uk', 'polly@parliament.uk', now(), false, 'postmark/1.eml.gz', 1)`,
      [letter],
    );
  });
});
