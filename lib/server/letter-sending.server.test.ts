import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse } from "msw";
import { copy } from "@/lib/content/email-your-mp";
import { docFromMarkup } from "@/lib/letter-format";
import { addTestMp, connectTestGmail, describeWithDatabase, refuseWrites, useTestDatabase } from "@/tests/database";
import { deliverToLettersInbox, resetLettersInbox } from "@/lib/server/fixtures/letters-inbox";
import { LETTERS_INBOX, recordGmail, stubLettersInboxEnv, testMail, testProxy } from "@/tests/gmail-sends";
import { staffCopy } from "@/lib/content/staff-interface";
import { notifications } from "@/tests/notifications";
import { query } from "./db.server";
import { recordProblem } from "./email.server";
import { handleDeliveryProblem, unblock } from "./delivery-problems.server";
import { readGmail } from "./gmail-reading.server";
import { sendLetterQueue } from "./letter-queue.server";
import { noticeToSender, sendCopy, sendLetter, threading, uncertainLetters } from "./letter-sending.server";
import { submitLetter, type LetterForm } from "./mp-letters.server";
import { relay, resendAfterFix, sendRelay, uncertainRelays } from "./relays.server";

const JANE = "jane@example.com";
/** Jane as every email to her is addressed: her name and her own address. */
const JANE_LINE = `"Jane Smith" <${JANE}>`;
const REQUEST = new Request("https://pauseai.uk/api/cron/read-gmail", { method: "POST" });
const MP = "test-mp@parliament.example";

const FORM: LetterForm = {
  campaign: "regulate-letter-pm",
  name: "Jane Smith",
  postcode: "zz9 9zz",
  address: "1 High Street",
  email: JANE,
  subject: "Please back a pause",
  letter: docFromMarkup("Dear Mr McTestface,\n\nPlease back a pause.\n\nJane Smith"),
  draftHash: "",
  consent: false,
  nickname: "",
  turnstileToken: "",
};

const disconnect = () =>
  query("UPDATE staff_accounts SET gmail_token = NULL, gmail_connected_at = NULL, gmail_history_id = NULL");
const block = (address: string) =>
  recordProblem({ address, messageId: null, kind: "hard", reason: "No such user", canReset: true });
const statusOf = async () => (await query<{ status: string }>("SELECT status FROM letters"))[0].status;
const events = async () =>
  query<{ status: string; details: Record<string, unknown> }>("SELECT status, details FROM letter_events ORDER BY id");

it("threads an email onto another by its Message-ID, or not at all", () => {
  expect(threading("a@b")).toEqual([
    { Name: "In-Reply-To", Value: "<a@b>" },
    { Name: "References", Value: "<a@b>" },
  ]);
  expect(threading(undefined)).toBeUndefined();
});

describeWithDatabase("the letters inbox's queue", () => {
  useTestDatabase();

  beforeEach(async () => {
    stubLettersInboxEnv();
    vi.spyOn(console, "error").mockImplementation(() => {});
    resetLettersInbox();
    await addTestMp();
    await connectTestGmail(LETTERS_INBOX);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /** Jane's letter, kept but not sent, as while the letters inbox is disconnected. Returns its ID. */
  async function queued(): Promise<number> {
    await disconnect();
    await submitLetter(FORM);
    await connectTestGmail(LETTERS_INBOX);
    return (await query<{ id: number }>("SELECT id::int AS id FROM letters"))[0].id;
  }

  it("tells the notification inbox once letters have waited three hours, and not again while they wait", async () => {
    const sent = notifications();
    const id = await queued();
    await disconnect();
    // Two hours: not yet.
    await query("UPDATE letters SET created_at = now() - interval '2 hours'");
    await sendLetterQueue(Date.now() + 10_000, REQUEST);
    expect(sent).toEqual([]);
    await query("UPDATE letters SET created_at = now() - interval '4 hours'");
    await sendLetterQueue(Date.now() + 10_000, REQUEST);
    await sendLetterQueue(Date.now() + 10_000, REQUEST);
    const words = staffCopy.notifications.lettersWaiting;
    const why = staffCopy.letters.detail.reasons.not_connected;
    expect(sent.map((email) => [email.Subject, email.TextBody])).toEqual([
      [words.subject(1, 3), words.body(1, 3, why, "https://pauseai.uk/staff/campaigns")],
    ]);
    expect(await query("SELECT letter_id::int AS id FROM email_sends WHERE purpose = 'staff-alert'")).toEqual([{ id }]);
    // Sent, then another waits as long: told again. With room to send, but Gmail failing, it says so.
    await connectTestGmail(LETTERS_INBOX);
    await sendLetterQueue(Date.now() + 10_000);
    expect(await statusOf()).toBe("sent");
    recordGmail(() => new HttpResponse(null, { status: 503 }));
    await submitLetter(FORM);
    await query("UPDATE letters SET created_at = now() - interval '4 hours' WHERE status = 'queued'");
    await sendLetterQueue(Date.now() + 10_000);
    expect(sent.map((email) => email.TextBody)).toEqual([
      expect.anything(),
      words.body(1, 3, staffCopy.letters.detail.reasons.failed, "https://pauseai.uk/staff/campaigns"),
    ]);
  });

  it("sends what's queued in the hourly run, saying how many went and how many are left", async () => {
    await queued();
    const sent = recordGmail();
    expect(await sendLetterQueue(Date.now() + 10_000)).toEqual({ sent: 1, left: 0 });
    expect(sent.map((s) => s.headers.get("to"))).toEqual([`"Testy McTestface MP" <${MP}>`, JANE_LINE]);
    expect(await statusOf()).toBe("sent");
    expect((await events()).map((e) => e.status)).toEqual(["queued", "sent", "copy_sent"]);
  });

  it("says why once while it waits, however many runs it waits through", async () => {
    await queued();
    await disconnect();
    expect(await sendLetterQueue(Date.now() + 10_000)).toEqual({ sent: 0, left: 1 });
    const id = (await query<{ id: number }>("SELECT id::int AS id FROM letters"))[0].id;
    expect(await sendLetter(id)).toEqual({ sent: false, reason: "not_connected" });
    expect(await sendLetter(id)).toEqual({ sent: false, reason: "not_connected" });
    expect((await events()).map((e) => e.status)).toEqual(["queued"]);
  });

  it("passes over a letter whose MP's address is blocked, and one with none", async () => {
    await queued();
    await block(MP);
    expect(await sendLetterQueue(Date.now() + 10_000)).toEqual({ sent: 0, left: 1 });
    await query("DELETE FROM email_blocks");
    await query("UPDATE notable_people SET email = NULL");
    expect(await sendLetterQueue(Date.now() + 10_000)).toEqual({ sent: 0, left: 1 });
    // Taken by sendLetter all the same, it waits, as for a blocked address.
    const id = (await query<{ id: number }>("SELECT id::int AS id FROM letters"))[0].id;
    expect(await sendLetter(id)).toEqual({ sent: false, reason: "blocked" });
  });

  it("stops when its time is up", async () => {
    await queued();
    expect(await sendLetterQueue(Date.now() - 1)).toEqual({ sent: 0, left: 1 });
  });

  it("sends nothing twice: a letter already taken is left alone", async () => {
    const id = await queued();
    await query("UPDATE letters SET status = 'sending'");
    const sent = recordGmail();
    expect(await sendLetter(id)).toEqual({ sent: true });
    expect(sent).toEqual([]);
  });

  it("puts a letter back in the queue when sending it goes wrong, not leaving it taken", async () => {
    const id = await queued();
    await query(`UPDATE letters_from_supporters SET letter = '"not a letter"'`);
    expect(await sendLetter(id)).toEqual({ sent: false, reason: "failed" });
    expect(await statusOf()).toBe("queued");
  });

  it("leaves a letter that went sending, not queued, when marking it sent fails, so it isn't sent twice", async () => {
    const id = await queued();
    const sent = recordGmail();
    await refuseWrites("letters", "NEW.status = 'sent'");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // It went, so it counts as sent, and the run goes on, saying so.
    expect(await sendLetter(id)).toEqual({ sent: true });
    expect(sent).toHaveLength(1);
    expect(await statusOf()).toBe("sending");
    expect(error.mock.calls[0][0]).toBe(
      staffCopy.problems.anywhere.sentUnrecorded(staffCopy.problems.anywhere.letterOf(id)),
    );
  });

  it("queues a letter when Gmail refuses the MP's address as blocked", async () => {
    const id = await queued();
    // Blocked between the check and the send, as by a bounce read meanwhile; awaited before the test ends,
    // so it's never still writing when the next test empties the tables.
    let blocking: Promise<unknown> = Promise.resolve();
    recordGmail(() => {
      blocking = block(MP);
      return HttpResponse.json({ error: { code: 500 } }, { status: 500 });
    });
    expect(await sendLetter(id)).toMatchObject({ sent: false });
    await blocking;
    expect(await statusOf()).toBe("queued");
  });

  it("holds the supporter's copy while her address is blocked, and sends it once it's unblocked", async () => {
    await block(JANE);
    await submitLetter(FORM);
    expect(await query("SELECT copy_state FROM letters_from_supporters")).toEqual([{ copy_state: "held" }]);
    expect((await events()).at(-1)).toEqual({ status: "copy_held", details: { to: JANE, reason: "blocked" } });
    const sent = recordGmail();
    expect(await unblock(JANE, "staff@pauseai.uk", "She fixed her mailbox")).toBe(true);
    expect(sent.map((s) => s.headers.get("to"))).toEqual([JANE_LINE]);
    expect(await query("SELECT copy_state FROM letters_from_supporters")).toEqual([{ copy_state: "sent" }]);
  });

  it("leaves a copy queued while the letters inbox can't send it, or Gmail refuses it, for the queue", async () => {
    await submitLetter(FORM);
    const id = (await query<{ id: number }>("SELECT id::int AS id FROM letters"))[0].id;
    await query("UPDATE letters_from_supporters SET copy_state = 'queued'");
    await disconnect();
    await sendCopy(id);
    expect(await query("SELECT copy_state FROM letters_from_supporters")).toEqual([{ copy_state: "queued" }]);
    await connectTestGmail(LETTERS_INBOX);
    recordGmail(() => HttpResponse.json({ error: { code: 500 } }, { status: 500 }));
    await sendCopy(id);
    expect(await query("SELECT copy_state FROM letters_from_supporters")).toEqual([{ copy_state: "queued" }]);
    recordGmail();
    expect(await sendLetterQueue(Date.now() + 10_000)).toEqual({ sent: 0, left: 0 });
    expect(await query("SELECT copy_state FROM letters_from_supporters")).toEqual([{ copy_state: "sent" }]);
  });

  it("stops the queue while the letters inbox can't send, leaving relays, letters and copies waiting", async () => {
    const id = await replied();
    await query("UPDATE letter_relays SET status = 'queued'");
    await query("UPDATE letters_from_supporters SET copy_state = 'queued'");
    await disconnect();
    await submitLetter({ ...FORM, email: "sam@example.com", name: "Sam Smith" });
    expect(await sendLetterQueue(Date.now() + 10_000)).toEqual({ sent: 0, left: 3 });
    // A relay that can't go, as its address is blocked, isn't counted as sent.
    await connectTestGmail(LETTERS_INBOX);
    await block(JANE);
    expect(await sendLetterQueue(Date.now() + 10_000)).toMatchObject({ sent: 1 });
    expect(await query("SELECT status FROM letter_relays")).toEqual([{ status: "held" }]);
    void id;
  });

  it("holds a relay to an MP with no address, and sends one with nothing to thread it on all the same", async () => {
    const id = await replied();
    deliverToLettersInbox(testMail({ from: JANE, to: testProxy("testy.mctestface.mp"), text: "Thanks\r\n" }));
    await query("UPDATE notable_people SET email = NULL");
    await readGmail("test");
    expect(await query("SELECT status FROM letter_relays WHERE NOT to_supporter")).toEqual([{ status: "held" }]);
    await query("UPDATE notable_people SET email = $1", [MP]);
    await query("DELETE FROM email_sends WHERE purpose = 'letter'");
    await query("UPDATE letter_relays SET status = 'queued' WHERE NOT to_supporter");
    const sent = recordGmail();
    const [{ relayId }] = await query<{ relayId: number }>(
      'SELECT id::int AS "relayId" FROM letter_relays WHERE NOT to_supporter',
    );
    expect(await sendRelay(relayId)).toEqual({ sent: true });
    expect(sent[0].headers.has("in-reply-to")).toBe(false);
    void id;
  });

  it("puts a copy back when something goes wrong before it goes, and leaves one that went for a person", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const words = staffCopy.problems.anywhere;
    await submitLetter(FORM);
    const id = (await query<{ id: number }>("SELECT id::int AS id FROM letters"))[0].id;
    await query("UPDATE letters_from_supporters SET copy_state = 'queued'");
    // Gmail refusing it, then logging that failing: nothing went, so it's back in the queue.
    recordGmail(() => HttpResponse.json({ error: { code: 500 } }, { status: 500 }));
    await refuseWrites("email_sends", "NEW.outcome = 'failed'", "INSERT");
    await sendCopy(id);
    expect(await query("SELECT copy_state FROM letters_from_supporters")).toEqual([{ copy_state: "queued" }]);
    expect(error.mock.calls.map(([what]) => what)).toContain(words.notSentYet(words.letterCopyOf(id)));
    // It goes, but marking it sent fails: left sending, for a person, never sent again.
    const sent = recordGmail();
    await refuseWrites("letters_from_supporters", "NEW.copy_state = 'sent'");
    await sendCopy(id);
    expect(sent).toHaveLength(1);
    expect(await query("SELECT copy_state FROM letters_from_supporters")).toEqual([{ copy_state: "sending" }]);
    expect(error.mock.calls.map(([what]) => what)).toContain(words.sentUnrecorded(words.letterCopyOf(id)));
  });

  it("puts a relay back when something goes wrong before it goes, and leaves one that went for a person", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const words = staffCopy.problems.anywhere;
    await replied();
    await query("UPDATE letter_relays SET status = 'queued'");
    const [{ relayId }] = await query<{ relayId: number }>(
      'SELECT id::int AS "relayId" FROM letter_relays ORDER BY id LIMIT 1',
    );
    recordGmail(() => HttpResponse.json({ error: { code: 500 } }, { status: 500 }));
    await refuseWrites("email_sends", "NEW.outcome = 'failed'", "INSERT");
    expect(await sendRelay(relayId)).toEqual({ sent: false, reason: "failed" });
    expect(await query("SELECT status, reason FROM letter_relays WHERE id = $1", [relayId])).toEqual([
      { status: "queued", reason: "failed" },
    ]);
    expect(error.mock.calls.map(([what]) => what)).toContain(words.notSentYet(words.relayOf(relayId)));
    const sent = recordGmail();
    await refuseWrites("letter_relays", "NEW.status = 'sent'");
    expect(await sendRelay(relayId)).toEqual({ sent: true });
    expect(sent).toHaveLength(1);
    expect(await query("SELECT status FROM letter_relays WHERE id = $1", [relayId])).toEqual([{ status: "sending" }]);
    expect(error.mock.calls.map(([what]) => what)).toContain(words.sentUnrecorded(words.relayOf(relayId)));
  });

  it("tells the supporter nothing has gone again while it can't go", async () => {
    const id = await replied();
    await query("UPDATE letters SET status = 'bounced'");
    await query("INSERT INTO letter_events (letter_id, status, details) VALUES ($1, 'notice', $2)", [
      id,
      JSON.stringify({ to: JANE, notice: "bounced" }),
    ]);
    await disconnect();
    await resendAfterFix({
      politicianId: (await query<{ id: number }>("SELECT id::int AS id FROM notable_people"))[0].id,
    });
    expect(await statusOf()).toBe("queued");
    expect((await events()).filter((e) => e.status === "notice")).toHaveLength(1);
  });

  it("sends no notice when Gmail refuses it", async () => {
    await submitLetter(FORM);
    const id = (await query<{ id: number }>("SELECT id::int AS id FROM letters"))[0].id;
    recordGmail(() => HttpResponse.json({ error: { code: 500 } }, { status: 500 }));
    expect(await noticeToSender(id, "bounced")).toBe(false);
  });

  it("sends no notice while the letters inbox can't, nor for a letter that's gone", async () => {
    await submitLetter(FORM);
    const id = (await query<{ id: number }>("SELECT id::int AS id FROM letters"))[0].id;
    await disconnect();
    expect(await noticeToSender(id, "bounced")).toBe(false);
    expect(await noticeToSender(id + 1, "bounced")).toBe(false);
  });

  /** Jane's letter, sent, and the office's reply to her proxy, read and relayed. Returns the letter's ID. */
  async function replied(): Promise<number> {
    await submitLetter(FORM);
    deliverToLettersInbox(testMail({ from: `"Testy McTestface MP" <${MP}>`, to: testProxy("jane.smith") }));
    await readGmail("test");
    return (await query<{ id: number }>("SELECT id::int AS id FROM letters"))[0].id;
  }

  it("holds a relay to an address that's blocked, and sends it once unblocked", async () => {
    await block(JANE);
    await replied();
    expect(await query("SELECT status, reason FROM letter_relays")).toEqual([{ status: "held", reason: "blocked" }]);
    expect((await events()).at(-1)).toMatchObject({ status: "relay_held", details: { to: JANE, reason: "blocked" } });
    const sent = recordGmail();
    await unblock(JANE, "staff@pauseai.uk", "Fixed");
    // Her copy, held as well, then the relay.
    expect(sent.map((s) => s.headers.get("bcc") ?? s.headers.get("to"))).toEqual([JANE_LINE, JANE_LINE]);
    expect(await query("SELECT status FROM letter_relays")).toEqual([{ status: "sent" }]);
  });

  describe("a reply held for the supporter's bouncing address", () => {
    const officeNotices = () =>
      query<{ letterId: number }>(
        `SELECT letter_id::int AS "letterId" FROM email_sends WHERE purpose = 'office-notice' AND outcome = 'sent'`,
      );
    const aDayHeld = () => query("UPDATE letter_relays SET created_at = now() - interval '25 hours'");

    it("tells the MP's office once, a day on, from her proxy, in the thread of their reply", async () => {
      await block(JANE);
      const id = await replied();
      const sent = recordGmail();
      await sendLetterQueue(Date.now() + 10_000);
      expect(await officeNotices()).toEqual([]);
      await aDayHeld();
      // Not while the letters inbox can't send.
      await disconnect();
      await sendLetterQueue(Date.now() + 10_000);
      expect(await officeNotices()).toEqual([]);
      await connectTestGmail(LETTERS_INBOX);
      await sendLetterQueue(Date.now() + 10_000);
      await sendLetterQueue(Date.now() + 10_000);
      expect(await officeNotices()).toEqual([{ letterId: id }]);
      const [notice] = sent;
      expect(notice.headers.get("from")).toBe(`"Jane Smith (via PauseAI)" <${testProxy("jane.smith")}>`);
      expect(notice.headers.get("to")).toBe(`"Testy McTestface MP" <${MP}>`);
      // The reply's subject has its Re: already.
      expect(notice.headers.get("subject")).toBe("Re: Request to co-sign letter on frontier AI risks");
      expect(notice.headers.get("in-reply-to")).toMatch(/^<.+>$/);
      expect(notice.text).toBe(copy.notices.office("Jane Smith"));
      expect((await events()).at(-1)).toMatchObject({ status: "office_told", details: { to: MP, backend: "gmail" } });
    });

    it("answers a reply with no Re: or Message-ID, and passes over an MP with no address now", async () => {
      await block(JANE);
      await replied();
      await query("UPDATE letter_replies SET subject = 'Thanks', rfc_message_id = NULL");
      await aDayHeld();
      const sent = recordGmail();
      await query("UPDATE notable_people SET email = NULL");
      await sendLetterQueue(Date.now() + 10_000);
      expect(sent).toEqual([]);
      await query(`UPDATE notable_people SET email = '${MP}'`);
      // Gmail failing: tried again the next hour.
      recordGmail(() => new HttpResponse(null, { status: 503 }));
      await sendLetterQueue(Date.now() + 10_000);
      expect(await officeNotices()).toEqual([]);
      const sent2 = recordGmail();
      await sendLetterQueue(Date.now() + 10_000);
      expect(sent2[0].headers.get("subject")).toBe("Re: Thanks");
      expect(sent2[0].headers.get("in-reply-to")).toBeUndefined();
    });

    it("reports to the notification inbox, once a day at most, the supporters' copies that bounced since, and why", async () => {
      const reports = notifications();
      await block(JANE);
      const id = await replied();
      // None bounced: no report.
      await sendLetterQueue(Date.now() + 10_000);
      expect(reports).toEqual([]);
      const bounce = (email: string, reason: string) =>
        query("INSERT INTO letter_events (letter_id, status, details) VALUES ($1, 'copy_bounced', $2)", [
          id,
          JSON.stringify({ email, reason }),
        ]);
      await bounce("jane@exampel.com", "No such domain");
      await sendLetterQueue(Date.now() + 10_000);
      await bounce("jo@example.org", "Mailbox full");
      // Within the day: nothing more.
      await sendLetterQueue(Date.now() + 10_000);
      const words = staffCopy.notifications.supporterBounces;
      const link = "https://pauseai.uk/staff/supporters/bounced-emails";
      expect(reports.map((r) => [r.Subject, r.TextBody])).toEqual([
        [words.subject(1), words.body(1, 1, ["- exampel.com: No such domain"], link)],
      ]);
      // A day on, the one since.
      await query("UPDATE email_sends SET at = at - interval '25 hours' WHERE purpose = 'staff-report'");
      await query("UPDATE letter_events SET at = at - interval '25 hours' WHERE details->>'reason' = 'No such domain'");
      await sendLetterQueue(Date.now() + 10_000);
      expect(reports.at(-1)!.TextBody).toBe(words.body(1, 1, ["- example.org: Mailbox full"], link));
    });
  });

  it("queues a relay the letters inbox can't send yet, saying why once, and sends it before new letters", async () => {
    recordGmail(() => undefined);
    await submitLetter(FORM);
    await disconnect();
    deliverToLettersInbox(testMail({ from: `"Testy McTestface MP" <${MP}>`, to: testProxy("jane.smith") }));
    await connectTestGmail(LETTERS_INBOX);
    const sent = recordGmail(() => HttpResponse.json({ error: { code: 429 } }, { status: 429 }));
    await readGmail("test");
    expect(await query("SELECT status, reason FROM letter_relays")).toEqual([{ status: "queued", reason: "failed" }]);
    const [{ id }] = await query<{ id: number }>("SELECT id::int AS id FROM letter_relays");
    expect(await sendRelay(id)).toEqual({ sent: false, reason: "failed" });
    expect((await events()).filter((e) => e.status === "relay_queued")).toHaveLength(1);
    await disconnect();
    expect(await sendRelay(id)).toEqual({ sent: false, reason: "not_connected" });
    await connectTestGmail(LETTERS_INBOX);
    // Then a new letter, from Sam: the relay goes first.
    await disconnect();
    await submitLetter({ ...FORM, email: "sam@example.com", name: "Sam Smith" });
    await connectTestGmail(LETTERS_INBOX);
    sent.length = 0;
    const order = recordGmail();
    expect(await sendLetterQueue(Date.now() + 10_000)).toEqual({ sent: 2, left: 0 });
    expect(order.map((s) => s.headers.get("to"))[0]).toBe(JANE_LINE);
    // A relay not queued is left alone.
    expect(await sendRelay(id)).toEqual({ sent: false });
  });

  it("marks a relay a stopped run left sending as uncertain, not sending it again", async () => {
    const letterId = await replied();
    await query("UPDATE letter_relays SET status = 'sending', sent_at = NULL, created_at = now() - interval '1 hour'");
    expect(await uncertainRelays()).toBe(1);
    expect(await query("SELECT status FROM letter_relays")).toEqual([{ status: "uncertain" }]);
    expect((await events()).at(-1)).toMatchObject({ status: "relay_uncertain", details: { to: JANE } });
    // One just begun is left: a run may be sending it now.
    const [{ replyId }] = await query<{ replyId: number }>('SELECT reply_id::int AS "replyId" FROM letter_relays');
    await query("DELETE FROM letter_relays");
    await query(
      "INSERT INTO letter_relays (letter_id, reply_id, to_supporter, status) VALUES ($1, $2, true, 'sending')",
      [letterId, replyId],
    );
    expect(await uncertainRelays()).toBe(0);
  });

  it("marks a letter or copy a stopped run left sending as uncertain, not sending it again", async () => {
    const id = await queued();
    // A run took the letter, then stopped: one just taken is left, as a run may be sending it now.
    await query("UPDATE letters SET status = 'sending', taken_at = now()");
    expect(await uncertainLetters()).toBe(0);
    await query("UPDATE letters SET taken_at = now() - interval '16 minutes'");
    expect(await uncertainLetters()).toBe(1);
    expect(await statusOf()).toBe("uncertain");
    expect((await events()).at(-1)).toMatchObject({ status: "uncertain", details: { to: MP } });
    const sent = recordGmail();
    expect(await sendLetterQueue(Date.now() + 10_000)).toEqual({ sent: 0, left: 0 });
    expect(await sendLetter(id)).toEqual({ sent: true });
    expect(sent).toEqual([]);
    // Sent, then a run took its copy and stopped.
    await query("UPDATE letters SET status = 'sent'");
    await query("UPDATE letters_from_supporters SET copy_state = 'sending', copy_taken_at = now()");
    expect(await uncertainLetters()).toBe(0);
    await query("UPDATE letters_from_supporters SET copy_taken_at = now() - interval '16 minutes'");
    expect(await uncertainLetters()).toBe(1);
    expect(await query("SELECT copy_state FROM letters_from_supporters")).toEqual([{ copy_state: "uncertain" }]);
    expect((await events()).at(-1)).toMatchObject({ status: "copy_uncertain", details: { to: JANE } });
    await sendCopy(id);
    expect(sent).toEqual([]);
  });

  it("sends again what bounced to an MP once their address changes, and tells the supporter it's gone", async () => {
    const id = await replied();
    // The letter and her answer, relayed to the MP, both bounced.
    deliverToLettersInbox(testMail({ from: JANE, to: testProxy("testy.mctestface.mp"), text: "Thanks\r\n" }));
    await readGmail("test");
    await query("UPDATE letters SET status = 'bounced'");
    await query("UPDATE letter_relays SET status = 'bounced' WHERE NOT to_supporter");
    await query("INSERT INTO letter_events (letter_id, status, details) VALUES ($1, 'notice', $2)", [
      id,
      JSON.stringify({ to: JANE, notice: "bounced" }),
    ]);
    await block(MP);
    const sent = recordGmail();
    // Still at the blocked address: nothing goes.
    expect(await sendLetterQueue(Date.now() + 10_000)).toMatchObject({ sent: 0 });
    expect(sent).toEqual([]);
    await query("UPDATE notable_people SET email = 'new-office@parliament.example'");
    await sendLetterQueue(Date.now() + 10_000);
    expect(sent.map((s) => s.headers.get("to"))).toEqual([
      '"Testy McTestface MP" <new-office@parliament.example>',
      JANE_LINE,
      '"Testy McTestface MP" <new-office@parliament.example>',
      JANE_LINE,
    ]);
    expect(sent[1].text).toBe(copy.notices.resent("Testy McTestface MP"));
    expect(await statusOf()).toBe("sent");
    expect(await query("SELECT status FROM letter_relays ORDER BY id")).toEqual([
      { status: "sent" },
      { status: "sent" },
    ]);
  });

  it("resends nothing to a fixed address that has nothing waiting", async () => {
    await submitLetter(FORM);
    const sent = recordGmail();
    await resendAfterFix({ address: "nobody@example.org" });
    await resendAfterFix({ politicianId: 0 });
    expect(sent).toEqual([]);
  });

  it("records a relay of a kept message and sends it at once", async () => {
    const letterId = await replied();
    const [{ replyId }] = await query<{ replyId: number }>('SELECT reply_id::int AS "replyId" FROM letter_relays');
    await query("DELETE FROM letter_relays");
    const sent = recordGmail();
    expect(await relay(letterId, replyId, false)).toEqual(expect.any(Number));
    expect(sent.map((s) => s.headers.get("to"))).toEqual([`"Testy McTestface MP" <${MP}>`]);
  });

  describe("bounces of what the letters inbox sends", () => {
    /** Gmail's ID for the newest email of `purpose`, as a bounce names it. */
    const sentId = async (purpose: string, to?: string) =>
      (
        await query<{ id: string }>(
          "SELECT message_id AS id FROM email_sends WHERE purpose = $1 AND ($2::text IS NULL OR address = $2) ORDER BY id DESC LIMIT 1",
          [purpose, to ?? null],
        )
      )[0].id;
    const bounce = (messageId: string, address: string, kind: "hard" | "soft" | "complaint" = "hard") =>
      handleDeliveryProblem({ address, messageId, kind, reason: "No such user", canReset: true }, REQUEST);

    it("a relay to the MP that bounces: marked so, the supporter told, staff alerted; once unblocked, sent again", async () => {
      await replied();
      deliverToLettersInbox(testMail({ from: JANE, to: testProxy("testy.mctestface.mp"), text: "Thanks\r\n" }));
      await readGmail("test");
      const sent = recordGmail();
      await bounce(await sentId("relay", MP), MP);
      expect(await query("SELECT status FROM letter_relays WHERE NOT to_supporter")).toEqual([{ status: "bounced" }]);
      expect(sent.map((s) => s.headers.get("to"))).toEqual([JANE_LINE]);
      expect(sent[0].text).toBe(copy.notices.bounced("Testy McTestface MP"));
      expect((await events()).slice(-3).map((e) => e.status)).toEqual(["relayed", "relay_bounced", "notice"]);
      expect(await query("SELECT count(*)::int AS n FROM email_sends WHERE purpose = 'staff-alert'")).toEqual([
        { n: 1 },
      ]);
      sent.length = 0;
      await unblock(MP, "staff@pauseai.uk", "Fixed by the office");
      expect(sent.map((s) => s.headers.get("to"))).toEqual([`"Testy McTestface MP" <${MP}>`, JANE_LINE]);
      expect(sent[1].text).toBe(copy.notices.resent("Testy McTestface MP"));
    });

    it("a relay to the supporter that bounces: her address blocked, the history says so, nobody else told", async () => {
      await replied();
      const sent = recordGmail();
      await bounce(await sentId("relay", JANE), JANE);
      expect(sent).toEqual([]);
      expect(await query("SELECT address FROM email_blocks")).toEqual([{ address: JANE }]);
      expect((await events()).at(-1)).toEqual({
        status: "relay_bounced",
        details: { email: JANE, reason: "No such user" },
      });
      expect(await query("SELECT status FROM letter_relays")).toEqual([{ status: "sent" }]);
    });

    it("a soft bounce of a relay or a copy is only noted, as Gmail keeps trying", async () => {
      await replied();
      await bounce(await sentId("relay"), JANE, "soft");
      await bounce(await sentId("letter-copy"), JANE, "soft");
      expect((await events()).slice(-2).map((e) => e.status)).toEqual(["relay_delayed", "copy_delayed"]);
      expect(await query("SELECT address FROM email_blocks")).toEqual([]);
    });

    it("the supporter's copy bouncing blocks her address, and the history says so", async () => {
      await submitLetter(FORM);
      await bounce(await sentId("letter-copy"), JANE);
      expect((await events()).at(-1)).toEqual({
        status: "copy_bounced",
        details: { email: JANE, reason: "No such user" },
      });
      expect(await query("SELECT address FROM email_blocks")).toEqual([{ address: JANE }]);
    });

    it("a letter that bounced goes again once its MP's address is unblocked, and the supporter is told", async () => {
      await submitLetter(FORM);
      await bounce(await sentId("letter"), MP);
      expect(await statusOf()).toBe("bounced");
      const sent = recordGmail();
      expect(await unblock(MP, "staff@pauseai.uk", "Their office gave us the right address")).toBe(true);
      expect(sent.map((s) => s.headers.get("to"))).toEqual([`"Testy McTestface MP" <${MP}>`, JANE_LINE]);
      expect(await statusOf()).toBe("sent");
    });

    it("tells the supporter only of a hard bounce of the letter, not a soft one or a complaint", async () => {
      await submitLetter(FORM);
      const id = await sentId("letter");
      const sent = recordGmail();
      await bounce(id, MP, "soft");
      await bounce(id, MP, "complaint");
      expect(sent).toEqual([]);
      await bounce(id, MP);
      expect(sent.map((s) => s.headers.get("to"))).toEqual([JANE_LINE]);
    });

    /** The MP's address works again, both ways: staff unblock it, then it changes; and the queue runs twice. */
    async function fixAddress() {
      expect(await unblock(MP, "staff@pauseai.uk", "Their office gave us the right address")).toBe(true);
      await query("UPDATE notable_people SET email = 'new-office@parliament.example'");
      await sendLetterQueue(Date.now() + 10_000);
      await sendLetterQueue(Date.now() + 10_000);
    }

    it("a letter written over a week ago never goes again: the supporter is told so, once", async () => {
      await submitLetter(FORM);
      await bounce(await sentId("letter"), MP);
      await query("UPDATE letters SET created_at = now() - interval '8 days'");
      const sent = recordGmail();
      await fixAddress();
      expect(sent.map((s) => s.headers.get("to"))).toEqual([JANE_LINE]);
      expect(sent[0].text).toBe(copy.notices.notResent("Testy McTestface MP"));
      expect(await statusOf()).toBe("bounced");
      const last = (await events()).at(-1)!;
      expect(last).toMatchObject({ status: "notice", details: { to: JANE, notice: "notResent" } });
      expect(last.details).not.toHaveProperty("gmailMessageId");
    });

    it("a relay to the MP from over a week ago never goes again either, and the supporter is told of it, once", async () => {
      await replied();
      deliverToLettersInbox(testMail({ from: JANE, to: testProxy("testy.mctestface.mp"), text: "Thanks\r\n" }));
      await readGmail("test");
      await bounce(await sentId("relay", MP), MP);
      await query("UPDATE letter_relays SET created_at = now() - interval '8 days' WHERE NOT to_supporter");
      const sent = recordGmail();
      await fixAddress();
      expect(sent.map((s) => s.headers.get("to"))).toEqual([JANE_LINE]);
      expect(sent[0].text).toBe(copy.notices.notResent("Testy McTestface MP"));
      expect(await query("SELECT status FROM letter_relays WHERE NOT to_supporter")).toEqual([{ status: "bounced" }]);
      // Both notices name the message relayed, so the history puts them under it.
      const notices = (await events()).filter((e) => e.status === "notice");
      expect(notices.map((e) => e.details.notice)).toEqual(["bounced", "notResent"]);
      expect(notices[1].details.gmailMessageId).toEqual(expect.any(String));
      expect(notices[0].details.gmailMessageId).toBe(notices[1].details.gmailMessageId);
    });

    it("tells nobody it won't go again who wasn't told it bounced, or whose own address is blocked", async () => {
      await submitLetter(FORM);
      const id = await sentId("letter");
      // A soft bounce marks the letter bounced, and tells nobody.
      await bounce(id, MP, "soft");
      await query("UPDATE letters SET created_at = now() - interval '8 days'");
      const sent = recordGmail();
      await sendLetterQueue(Date.now() + 10_000);
      expect(sent).toEqual([]);
      await bounce(id, MP);
      await block(JANE);
      sent.length = 0;
      await sendLetterQueue(Date.now() + 10_000);
      expect(sent).toEqual([]);
      // Once her address works, she's told.
      await unblock(JANE, "staff@pauseai.uk", "She fixed her mailbox");
      await sendLetterQueue(Date.now() + 10_000);
      expect(sent.map((s) => s.text)).toEqual([copy.notices.notResent("Testy McTestface MP")]);
    });
  });
});
