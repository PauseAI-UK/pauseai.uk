import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { toNotifications } from "@/tests/notifications";
import { staffCopy } from "@/lib/content/staff-interface";
import { addTestLetter, addTestMp, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "@/lib/server/db.server";
import { handleDeliveryProblem, unblock } from "./delivery-problems.server";
import type { DeliveryProblem, Purpose } from "@/lib/email/email.server";

/** Postmark's webhook call, which on Netlify arrives on the netlify.app host. */
const REQUEST = new Request("https://main--pauseaiuk.netlify.app/api/postmark/bounce", { method: "POST" });
const BOUNCE: DeliveryProblem = {
  address: "test-mp@parliament.example",
  messageId: "msg-1",
  kind: "hard",
  reason: "Unknown user",
  canReset: true,
  details: { type: "HardBounce" },
};

type Sent = { To: string; Subject: string; TextBody: string };

beforeEach(() => {
  vi.stubEnv("POSTMARK_SERVER_TOKEN", "server-token");
  vi.stubEnv("NOTIFICATION_INBOX", "notifications@pauseai.uk");
  vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
});
afterEach(() => vi.unstubAllEnvs());

describeWithDatabase("handleDeliveryProblem", () => {
  useTestDatabase();

  /** Records each email sent through Postmark. */
  function postmark() {
    const sent: Sent[] = [];
    server.use(
      http.post("https://api.postmarkapp.com/email", async ({ request }) => {
        sent.push((await request.json()) as Sent);
        return HttpResponse.json({ ErrorCode: 0, MessageID: `alert-${sent.length}` });
      }),
    );
    return sent;
  }

  /** A sent letter to the test MP, its email logged as msg-1, or an email of another purpose. */
  async function sentEmail(purpose: Purpose = "letter"): Promise<number> {
    const mp = await addTestMp();
    const id = await addTestLetter({ politicianId: mp, senderName: "Jane", senderEmail: "jane@example.com" });
    await query(
      "INSERT INTO email_sends (purpose, letter_id, address, outcome, message_id) VALUES ($1, $2, 'test-mp@parliament.example', 'sent', 'msg-1')",
      [purpose, purpose === "letter" ? id : null],
    );
    return id;
  }

  const letter = async () => (await query<{ status: string }>("SELECT status FROM letters"))[0].status;
  const events = () => query("SELECT status, details FROM letter_events");

  it("marks a mailing's letter that bounced, leaving staff to the day's report", async () => {
    const mp = await addTestMp();
    const [{ id }] = await query<{ id: number }>(
      "INSERT INTO letters (kind, notable_person_id, status) VALUES ('pauseai', $1, 'sent') RETURNING id::int AS id",
      [mp],
    );
    await query(
      "INSERT INTO email_sends (purpose, letter_id, address, outcome, message_id, backend, sender) VALUES ('mailing', $1, 'test-mp@parliament.example', 'sent', 'msg-1', 'gmail', 'jo@pauseai.uk')",
      [id],
    );
    const sent = postmark();
    await handleDeliveryProblem(BOUNCE, REQUEST);
    expect(await letter()).toBe("bounced");
    expect(await events()).toMatchObject([{ status: "bounced" }]);
    expect(sent).toEqual([]);
  });

  it.each(["office-notice", null] as const)(
    "emails staff of a politician's address blocked by an email of purpose %s, which has no hook to tell them",
    async (purpose) => {
      if (purpose) await sentEmail(purpose);
      else await addTestMp();
      const sent = postmark();
      // Read from a Gmail mailbox, or, from Gmail but its mailbox not known, as Postmark's are.
      const gmail = purpose ? { gmailMessageId: "g1", gmailAccount: "jo@pauseai.uk" } : { gmailMessageId: "g1" };
      await handleDeliveryProblem(
        { ...BOUNCE, ...gmail, address: `"Test" <${BOUNCE.address.toUpperCase()}>` },
        REQUEST,
      );
      const words = staffCopy.alert.notALetter;
      expect(sent).toMatchObject([{ Subject: words.subject("Testy McTestface MP") }]);
      expect(sent[0].TextBody).toBe(
        words.body(
          "Testy McTestface MP",
          "test-mp@parliament.example",
          "Unknown user",
          "https://pauseai.uk/staff/politicians/addresses-to-fix",
          purpose ? "https://mail.google.com/mail/?authuser=jo%40pauseai.uk#all/g1" : undefined,
        ),
      );
      expect(sent[0].TextBody.includes("mail.google.com")).toBe(!!purpose);
    },
  );

  it("marks a copy of a broadcast that bounced failed, notes a complaint, and lets a soft bounce be", async () => {
    postmark();
    const [{ mailing }] = await query<{ mailing: number }>(
      `INSERT INTO mailings (title, audience, channel, topic, filter, body, created_by, state)
       VALUES ('', 'supporters', 'email', 'newsletter', '{}', '{}', 'staff@pauseai.uk', 'draft') RETURNING id::int AS mailing`,
    );
    for (const n of [1, 2, 3]) {
      await query(`INSERT INTO broadcast_messages (mailing_id, status, provider_message_id) VALUES ($1, 'sent', $2)`, [
        mailing,
        `pm-${n}`,
      ]);
      await query(
        `INSERT INTO email_sends (purpose, address, outcome, message_id) VALUES ('broadcast', $1, 'sent', $2)`,
        [`p${n}@example.com`, `pm-${n}`],
      );
    }
    const problem = { messageId: "", reason: "Nope", canReset: true };
    await handleDeliveryProblem({ ...problem, address: "p1@example.com", messageId: "pm-1", kind: "hard" });
    await handleDeliveryProblem({ ...problem, address: "p2@example.com", messageId: "pm-2", kind: "complaint" });
    await handleDeliveryProblem({ ...problem, address: "p3@example.com", messageId: "pm-3", kind: "soft" });
    expect(await query("SELECT provider_message_id AS id, status FROM broadcast_messages ORDER BY id")).toEqual([
      { id: "pm-1", status: "failed" },
      { id: "pm-2", status: "sent" },
      { id: "pm-3", status: "sent" },
    ]);
    expect(await query("SELECT kind, details FROM broadcast_message_events ORDER BY id")).toEqual([
      { kind: "bounced", details: { reason: "Nope" } },
      { kind: "opted-out", details: { reason: "Nope" } },
    ]);
  });

  it("says nothing of an address blocked that isn't a politician's in office", async () => {
    await sentEmail("forwarded-reply");
    const sent = postmark();
    await handleDeliveryProblem({ ...BOUNCE, address: "someone@example.org" }, REQUEST);
    await query("UPDATE notable_people SET status = 'left_office'");
    await handleDeliveryProblem(BOUNCE, REQUEST);
    expect(sent).toEqual([]);
  });

  it("marks a letter that hard-bounced, blocks the address, and emails staff a link to the blocked addresses", async () => {
    await sentEmail();
    const sent = postmark();
    await handleDeliveryProblem(BOUNCE, REQUEST);
    expect(await letter()).toBe("bounced");
    expect(await events()).toEqual([
      {
        status: "bounced",
        details: { type: "HardBounce", reason: "Unknown user", email: "test-mp@parliament.example" },
      },
    ]);
    expect(await query("SELECT address FROM email_blocks")).toEqual([{ address: "test-mp@parliament.example" }]);
    expect(sent).toEqual([
      expect.objectContaining({
        To: toNotifications("notifications@pauseai.uk"),
        Subject: staffCopy.alert.subject("Testy McTestface MP"),
        TextBody: staffCopy.alert.body(
          "Testy McTestface MP",
          "test-mp@parliament.example",
          "Unknown user",
          "https://pauseai.uk/staff/politicians/addresses-to-fix",
        ),
      }),
    ]);
    expect(await query("SELECT purpose FROM email_sends ORDER BY id")).toEqual([
      { purpose: "letter" },
      { purpose: "staff-alert" },
    ]);
  });

  it("blocks the sender's own address when their copy bounces, but leaves the letter alone and tells nobody", async () => {
    await sentEmail();
    const sent = postmark();
    await handleDeliveryProblem({ ...BOUNCE, address: "Jane@Example.com" }, REQUEST);
    expect(await letter()).toBe("sent");
    expect(await events()).toEqual([]);
    expect(await query("SELECT address FROM email_blocks")).toEqual([{ address: "jane@example.com" }]);
    expect(sent).toEqual([]);
  });

  it("marks a spam complaint, and tells staff", async () => {
    await sentEmail();
    const sent = postmark();
    await handleDeliveryProblem({ ...BOUNCE, kind: "complaint" }, REQUEST);
    expect(await letter()).toBe("spam_complaint");
    expect(sent).toHaveLength(1);
  });

  it("marks a soft bounce, without blocking the address or telling staff", async () => {
    await sentEmail();
    const sent = postmark();
    await handleDeliveryProblem({ ...BOUNCE, kind: "soft", details: undefined }, REQUEST);
    expect(await letter()).toBe("bounced");
    expect(await events()).toMatchObject([{ details: { reason: "Unknown user" } }]);
    expect(await query("SELECT address FROM email_blocks")).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("tells nobody when there's no notification inbox", async () => {
    vi.stubEnv("NOTIFICATION_INBOX", "");
    await sentEmail();
    const sent = postmark();
    await handleDeliveryProblem(BOUNCE, REQUEST);
    expect(await letter()).toBe("bounced");
    expect(sent).toEqual([]);
  });

  it("leaves letters alone for other emails, ones we didn't send, and a letter since deleted", async () => {
    postmark();
    for (const purpose of ["forwarded-reply", "staff-login", "staff-alert"] as const) {
      await query("TRUNCATE letters, email_sends, politicians RESTART IDENTITY CASCADE");
      await sentEmail(purpose);
      await handleDeliveryProblem(BOUNCE, REQUEST);
      expect(await letter()).toBe("sent");
    }
    await handleDeliveryProblem({ ...BOUNCE, messageId: null }, REQUEST);
    await handleDeliveryProblem({ ...BOUNCE, messageId: "unknown" }, REQUEST);
    expect(await letter()).toBe("sent");

    await query("TRUNCATE letters, email_sends, politicians RESTART IDENTITY CASCADE");
    const id = await sentEmail();
    await query("DELETE FROM letters WHERE id = $1", [id]);
    await handleDeliveryProblem(BOUNCE, REQUEST);
    expect(await query("SELECT * FROM letter_events")).toEqual([]);
    // Every problem is still recorded.
    expect(await query("SELECT count(*)::int AS n FROM email_problems")).toEqual([{ n: 6 }]);
  });
});

describeWithDatabase("unblock", () => {
  useTestDatabase();

  it("sends nothing again for an address it didn't unblock", async () => {
    expect(await unblock("nobody@example.org", "samuel.whitlock@pauseai.uk", "Fixed")).toBe(false);
    expect(await query("SELECT * FROM email_sends")).toEqual([]);
  });
});
