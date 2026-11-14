import { afterEach, beforeEach, expect, it, onTestFinished, vi } from "vitest";
import { staffCopy } from "@/lib/content/staff-interface";
import { lettersCopy } from "@/lib/letters/copy";
import {
  addTestPolitician,
  connectTestGmail,
  describeWithDatabase,
  useTestDatabase,
  refuseWrites,
} from "@/tests/database";
import type { MailingDoc } from "./doc";
import { query } from "@/lib/server/db.server";
import { recordProblem } from "@/lib/email/email.server";
import type { ChannelMessage, MailingChannel } from "@/lib/letters/channels.server";
import { uncertainLetters } from "@/lib/letters/sending.server";
import { createDraft, saveDraft, scheduleMailing } from "./drafts.server";
import { sendDueLetters, startDueMailings } from "./sending.server";

const JO = "jo@pauseai.uk";
const LETTER: MailingDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Dear " },
        { type: "field", attrs: { field: "salutation" } },
      ],
    },
  ],
};

/** A channel that records what it sends, and answers with `answer` for each. */
function recording(answer: (message: ChannelMessage) => Awaited<ReturnType<MailingChannel["send"]>>, remaining = 100) {
  const sent: ChannelMessage[] = [];
  const channel: MailingChannel = {
    sendsMailings: true,
    send: async (message) => {
      sent.push(message);
      return answer(message);
    },
    remainingToday: async () => remaining - sent.length,
    cost: () => 0,
    report: () => undefined,
  };
  return { sent, channel };
}

const SENT = () => ({ sent: true as const, id: "g", messageId: "m@pauseai.uk", threadId: "t" });

describeWithDatabase("sending mailings", () => {
  useTestDatabase();
  beforeEach(() => vi.useFakeTimers({ now: new Date("2026-11-01T09:00:00Z"), toFake: ["Date"] }));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  /** A mailing from Jo's Gmail to everyone in office, scheduled for `due`. Returns its ID. */
  async function scheduled(due = "2026-11-01T10:00:00Z", subject = "AI"): Promise<number> {
    await connectTestGmail(JO);
    const { id } = await createDraft(JO, { list: "politicians", params: {} }, { subject, body: LETTER });
    const saved = await saveDraft(id, 1, { sentFrom: JO, fromName: "Jo Staff", dueAt: new Date(due) });
    expect(await scheduleMailing(id, (saved as { version: number }).version, JO)).toEqual({ scheduled: true });
    return id;
  }

  const letters = () =>
    query(
      `SELECT n.name, l.status, p.skip_reason AS "skipReason", l.sent_at IS NOT NULL AS "sentAt"
       FROM letters l JOIN letters_from_pauseai p USING (id) JOIN notable_people n ON n.id = l.notable_person_id ORDER BY n.name`,
    );
  const state = async (id: number) =>
    (await query<{ state: string }>("SELECT state FROM mailings WHERE id = $1", [id]))[0].state;

  it("starts the mailings that are due, and only those", async () => {
    await addTestPolitician();
    const due = await scheduled("2026-11-01T10:00:00Z");
    const later = await scheduled("2026-11-01T12:00:00Z");
    expect(await startDueMailings()).toEqual([]);
    vi.setSystemTime(new Date("2026-11-01T10:05:00Z"));
    expect(await startDueMailings()).toEqual([due]);
    expect([await state(due), await state(later)]).toEqual(["sending", "scheduled"]);
    expect(await query("SELECT actor, action, details FROM audit_log WHERE action = 'start mailing'")).toEqual([
      { actor: "send-mailings", action: "start mailing", details: { id: due } },
    ]);
  });

  it("starts none overnight, though one is due: the morning's first run starts it", async () => {
    await addTestPolitician();
    const due = await scheduled("2026-11-01T10:00:00Z");
    vi.setSystemTime(new Date("2026-11-02T05:18:00Z"));
    expect(await startDueMailings()).toEqual([]);
    vi.setSystemTime(new Date("2026-11-02T06:18:00Z"));
    expect(await startDueMailings()).toEqual([due]);
  });

  it("sends each letter from the sender's Gmail in their name, filled in for each, then marks the mailing sent", async () => {
    await addTestPolitician({
      airtableId: null,
      name: "Polly Placeholder",
      salutation: "Ms Placeholder",
      email: "polly@example.org",
    });
    await addTestPolitician({
      airtableId: null,
      name: "Dora Dummy",
      salutation: "Lady Dummy",
      email: "dora@example.org",
    });
    const id = await scheduled();
    await query(
      "INSERT INTO mailing_attachments (mailing_id, filename, content_type, content) VALUES ($1, 'a.pdf', 'application/pdf', 'PDF')",
      [id],
    );
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    await startDueMailings();
    const { sent, channel } = recording(SENT);
    expect(await sendDueLetters({ until: Infinity, gap: 0, channel })).toEqual({
      sent: 2,
      skipped: 0,
      failed: 0,
      left: 0,
      waiting: [],
    });
    expect(sent.map((m) => [m.from, m.to.address, m.text])).toEqual([
      [{ name: "Jo Staff", address: JO }, "dora@example.org", "Dear Lady Dummy"],
      [{ name: "Jo Staff", address: JO }, "polly@example.org", "Dear Ms Placeholder"],
    ]);
    expect(sent[0].attachments).toEqual([{ Name: "a.pdf", ContentType: "application/pdf", Content: "UERG" }]);
    expect(await letters()).toEqual([
      { name: "Dora Dummy", status: "sent", skipReason: null, sentAt: true },
      { name: "Polly Placeholder", status: "sent", skipReason: null, sentAt: true },
    ]);
    expect(await query("SELECT status, details FROM letter_events ORDER BY id LIMIT 1")).toEqual([
      {
        status: "sent",
        details: {
          from: JO,
          to: "dora@example.org",
          messageId: "m@pauseai.uk",
          threadId: "t",
          // What sent it, kept with it.
          backend: "gmail",
          account: JO,
        },
      },
    ]);
    expect(await state(id)).toBe("sent");
  });

  it("sends in the name the Gmail sends as when the mailing gives none", async () => {
    await addTestPolitician({ airtableId: null, name: "Polly Placeholder", email: "polly@example.org" });
    await connectTestGmail(JO);
    await query("UPDATE staff_accounts SET gmail_name = 'Jo Gmail' WHERE email = $1", [JO]);
    const { id } = await createDraft(JO, { list: "politicians", params: {} }, { subject: "AI", body: LETTER });
    const saved = await saveDraft(id, 1, { sentFrom: JO, fromName: "", dueAt: new Date("2026-11-01T10:00:00Z") });
    await scheduleMailing(id, (saved as { version: number }).version, JO);
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    await startDueMailings();
    const { sent, channel } = recording(SENT);
    await sendDueLetters({ until: Infinity, gap: 0, channel });
    expect(sent.map((m) => m.from)).toEqual([{ name: "Jo Gmail", address: JO }]);
  });

  it("skips anyone who has left office, has no address or whose address is blocked since, and marks a failure", async () => {
    await addTestPolitician({ airtableId: null, name: "Ann Away", email: "ann@example.org" });
    await addTestPolitician({ airtableId: null, name: "Bob Bounced", email: "bob@example.org" });
    await addTestPolitician({ airtableId: null, name: "Cat Fails", email: "cat@example.org" });
    await addTestPolitician({ airtableId: null, name: "Dan Refused", email: "dan@example.org" });
    await addTestPolitician({ airtableId: null, name: "Eve Emptied", email: "eve@example.org" });
    await scheduled();
    await query("UPDATE notable_people SET status = 'retired' WHERE name = 'Ann Away'");
    await query("UPDATE notable_people SET email = '' WHERE name = 'Eve Emptied'");
    await recordProblem({ address: "bob@example.org", messageId: null, kind: "hard", reason: "No", canReset: true });
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    await startDueMailings();
    const { channel } = recording((m) =>
      m.to.address === "cat@example.org"
        ? { sent: false, reason: "failed", detail: "Message rejected: the recipient address is invalid" }
        : m.to.address === "dan@example.org"
          ? { sent: false, reason: "blocked" }
          : SENT(),
    );
    expect(await sendDueLetters({ until: Infinity, gap: 0, channel })).toMatchObject({
      sent: 0,
      skipped: 4,
      failed: 1,
    });
    expect(await letters()).toEqual([
      { name: "Ann Away", status: "skipped", skipReason: "left-office", sentAt: false },
      { name: "Bob Bounced", status: "skipped", skipReason: "blocked", sentAt: false },
      { name: "Cat Fails", status: "not_sent", skipReason: null, sentAt: false },
      { name: "Dan Refused", status: "skipped", skipReason: "blocked", sentAt: false },
      { name: "Eve Emptied", status: "skipped", skipReason: "no-email", sentAt: false },
    ]);
    expect(await query("SELECT status, details FROM letter_events WHERE status <> 'skipped'")).toEqual([
      { status: "failed", details: { detail: "Message rejected: the recipient address is invalid" } },
    ]);
  });

  it("puts a letter back to go next run when sending it throws, and the rest of its mailing wait, failing none", async () => {
    await addTestPolitician({ airtableId: null, name: "Polly", email: "polly@example.org" });
    await addTestPolitician({ airtableId: null, name: "Dora", email: "dora@example.org" });
    await scheduled();
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    await startDueMailings();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { channel } = recording(() => {
      throw new Error("couldn't make it");
    });
    expect(await sendDueLetters({ until: Infinity, gap: 0, channel })).toMatchObject({ sent: 0, failed: 0, left: 2 });
    expect((await letters()).map((letter) => letter.status)).toEqual(["scheduled", "scheduled"]);
    const [{ first }] = await query<{ first: number }>("SELECT min(id)::int AS first FROM letters_from_pauseai");
    const words = staffCopy.problems.anywhere;
    expect(error.mock.calls.map(([what]) => what)).toContain(words.notSentYet(lettersCopy.problems.letterOf(first)));
  });

  it("puts back a letter it took but couldn't read, so it goes next run rather than being left sending", async () => {
    await addTestPolitician({ airtableId: null, name: "Polly", email: "polly@example.org" });
    await scheduled();
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    await startDueMailings();
    // Reading the letter after taking it fails, as the politicians' table is briefly missing.
    await query("ALTER TABLE notable_people RENAME TO notable_people_gone");
    onTestFinished(
      async () => void (await query("ALTER TABLE IF EXISTS notable_people_gone RENAME TO notable_people")),
    );
    await expect(sendDueLetters({ until: Infinity, gap: 0, channel: recording(SENT).channel })).rejects.toThrow();
    await query("ALTER TABLE notable_people_gone RENAME TO notable_people");
    expect((await letters()).map((letter) => letter.status)).toEqual(["scheduled"]);
  });

  it("counts a letter that went as sent when marking it fails, reporting it, and goes on to the rest", async () => {
    await addTestPolitician({ airtableId: null, name: "Polly", email: "polly@example.org" });
    await addTestPolitician({ airtableId: null, name: "Dora", email: "dora@example.org" });
    await scheduled();
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    await startDueMailings();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await refuseWrites("letters", "NEW.status = 'sent'");
    const { sent, channel } = recording(SENT);
    expect(await sendDueLetters({ until: Infinity, gap: 0, channel })).toMatchObject({ sent: 2, failed: 0, left: 0 });
    expect(sent).toHaveLength(2);
    // Left sending, for uncertainLetters to mark uncertain for a person, never sent again.
    expect((await letters()).map((letter) => letter.status)).toEqual(["sending", "sending"]);
  });

  it("leaves a letter Gmail can't send for now, and the rest from its account, for the next run, failing none", async () => {
    await addTestPolitician({ airtableId: null, name: "Polly", email: "polly@example.org" });
    await addTestPolitician({ airtableId: null, name: "Dora", email: "dora@example.org" });
    await scheduled();
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    await startDueMailings();
    const { channel } = recording(() => ({ sent: false, reason: "failed", retry: true }));
    expect(await sendDueLetters({ until: Infinity, gap: 0, channel })).toMatchObject({
      sent: 0,
      failed: 0,
      left: 2,
      waiting: [JO],
    });
    expect((await letters()).map((letter) => letter.status)).toEqual(["scheduled", "scheduled"]);
  });

  it("stops for the day at the account's limit, and when its Gmail is no longer connected, leaving the rest", async () => {
    await addTestPolitician({ airtableId: null, name: "Polly", email: "polly@example.org" });
    await addTestPolitician({ airtableId: null, name: "Dora", email: "dora@example.org" });
    const id = await scheduled();
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    await startDueMailings();
    const limited = recording(SENT, 1);
    expect(await sendDueLetters({ until: Infinity, gap: 0, channel: limited.channel })).toEqual({
      sent: 1,
      skipped: 0,
      failed: 0,
      left: 1,
      waiting: [JO],
    });
    await query("UPDATE staff_accounts SET gmail_token = NULL, gmail_connected_at = NULL, gmail_history_id = NULL");
    const unconnected = recording(SENT);
    expect(await sendDueLetters({ until: Infinity, gap: 0, channel: unconnected.channel })).toMatchObject({
      sent: 0,
      left: 1,
      waiting: [JO],
    });
    expect(await state(id)).toBe("sending");
  });

  it("sends a second mailing from the same account no further once it's waiting, and stops at the time given", async () => {
    await addTestPolitician({ airtableId: null, name: "Polly", email: "polly@example.org" });
    await scheduled("2026-11-01T10:00:00Z", "One");
    await scheduled("2026-11-01T10:00:00Z", "Two");
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    await startDueMailings();
    const limited = recording(SENT, 0);
    expect(await sendDueLetters({ until: Infinity, gap: 0, channel: limited.channel })).toMatchObject({
      sent: 0,
      left: 2,
      waiting: [JO],
    });
    const late = recording(SENT);
    expect(await sendDueLetters({ until: Date.now(), gap: 1000, channel: late.channel })).toMatchObject({
      sent: 0,
      left: 2,
    });
  });

  it("goes at the channel's pace, a gap between each", async () => {
    await addTestPolitician({ airtableId: null, name: "Polly", email: "polly@example.org" });
    await addTestPolitician({ airtableId: null, name: "Dora", email: "dora@example.org" });
    await scheduled();
    vi.useRealTimers();
    await query("UPDATE mailings SET state = 'sending' WHERE body IS NOT NULL");
    const times: number[] = [];
    const { channel } = recording(() => {
      times.push(Date.now());
      return SENT();
    });
    await sendDueLetters({ until: Infinity, gap: 50, channel });
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(45);
  });

  it("sends by Gmail when no channel is given", async () => {
    await addTestPolitician({ airtableId: null, name: "Polly", email: "polly@example.org" });
    await scheduled();
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    await startDueMailings();
    expect(await sendDueLetters({ until: Infinity, gap: 0 })).toMatchObject({ sent: 1, left: 0 });
    expect(await query("SELECT backend, sender, purpose FROM email_sends")).toEqual([
      { backend: "gmail", sender: JO, purpose: "mailing" },
    ]);
  });

  it("finishes a mailing whose run stopped after a send, its letter uncertain rather than sent twice", async () => {
    await addTestPolitician({ airtableId: null, name: "Polly", email: "polly@example.org" });
    await addTestPolitician({ airtableId: null, name: "Dora", email: "dora@example.org" });
    const id = await scheduled();
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    await startDueMailings();
    // A run is cut off (Netlify stops the function) once Gmail has taken Dora's letter, before it's marked sent:
    // it's left sending, as no code of ours runs after.
    await query(
      `UPDATE letters l SET status = 'sending', taken_at = now() FROM notable_people n
       WHERE n.id = l.notable_person_id AND n.name = 'Dora'`,
    );
    // The next run sends the rest, and waits for the one left sending, as a run may be sending it now.
    const next = recording(SENT);
    expect(await uncertainLetters()).toBe(0);
    expect(await sendDueLetters({ until: Infinity, gap: 0, channel: next.channel })).toMatchObject({
      sent: 1,
      left: 0,
    });
    expect(next.sent.map((m) => m.to.name)).toEqual(["Polly"]);
    expect(await state(id)).toBe("sending");
    // A while later, it's uncertain, and the mailing is done; it isn't sent again.
    await query("UPDATE letters SET taken_at = now() - interval '16 minutes' WHERE status = 'sending'");
    expect(await uncertainLetters()).toBe(1);
    expect(await sendDueLetters({ until: Infinity, gap: 0, channel: next.channel })).toMatchObject({
      sent: 0,
      left: 0,
    });
    expect(next.sent).toHaveLength(1);
    expect(await state(id)).toBe("sent");
    expect(await letters()).toEqual([
      { name: "Dora", status: "uncertain", skipReason: null, sentAt: false },
      { name: "Polly", status: "sent", skipReason: null, sentAt: true },
    ]);
    expect(
      await query(
        "SELECT e.status, e.details FROM letter_events e JOIN letters l ON l.id = e.letter_id WHERE l.status = 'uncertain'",
      ),
    ).toEqual([{ status: "uncertain", details: { to: "dora@example.org" } }]);
  });
});
