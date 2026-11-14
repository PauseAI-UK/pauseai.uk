import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { copy } from "@/lib/content/email-your-mp";
import { addTestLetter, addTestMp, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "@/lib/server/db.server";
import { recordProblem } from "@/lib/email/email.server";
import { forwardReply, isAutoReply } from "./inbound.server";
import { gunzipSync } from "node:zlib";
import { letterReply } from "@/lib/server/outside-services/blobs.server";
import { threadMessages } from "./threads.server";
import { stubBlobsEnv } from "@/tests/gmail-sends";
import { emailCopy } from "@/lib/email/copy";

/** The policy inbox as a forward to it is addressed. */
const POLICY = `"${emailCopy.inboxNames.policy}" <replies@pauseai.uk>`;

const POSTMARK = "https://api.postmarkapp.com/email";

beforeEach(() => {
  vi.stubEnv("POSTMARK_WEBHOOK_USER", "postmark");
  vi.stubEnv("POSTMARK_WEBHOOK_PASSWORD", "hunter2");
  vi.stubEnv("POSTMARK_SERVER_TOKEN", "server-token");
  vi.stubEnv("POLICY_INBOX", "replies@pauseai.uk");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** A sent letter to the test MP. Returns its mailbox: its address, but for the domain. */
async function sentLetter(mailbox = "jane.smith.482913"): Promise<string> {
  const mp = await addTestMp();
  await addTestLetter({
    politicianId: mp,
    senderName: "Jane Smith",
    senderEmail: "Jane@Example.com",
    contactConsent: true,
    postmarkMailbox: mailbox,
  });
  return mailbox;
}

describeWithDatabase("forwardReply", () => {
  useTestDatabase();

  type Sent = {
    From: string;
    To: string;
    ReplyTo: string;
    Subject: string;
    TextBody: string;
    Attachments?: unknown[];
    Headers?: { Name: string; Value: string }[];
  };
  function postmark() {
    const sent: Sent[] = [];
    server.use(
      http.post(POSTMARK, async ({ request }) => {
        sent.push((await request.json()) as Sent);
        return HttpResponse.json({ ErrorCode: 0, MessageID: `fwd-${sent.length}` });
      }),
    );
    return sent;
  }

  const reply = (mailbox: string, extra = {}) => ({
    MessageID: "inbound-1",
    FromFull: { Email: "test-mp@parliament.example", Name: "Testy McTestface MP" },
    ToFull: [{ Email: `${mailbox}@letters.pauseai.uk` }],
    CcFull: [],
    Subject: "Re: S",
    Date: "Mon, 12 Oct 2026 10:00:00 +0100",
    TextBody: "Thanks for your letter.",
    ...extra,
  });

  const events = () =>
    query<{ status: string; details: object }>("SELECT status, details FROM letter_events ORDER BY id");
  const repliedAt = async () =>
    (await query<{ replied_at: Date | null }>("SELECT replied_at FROM letters"))[0].replied_at;

  it("forwards the reply to our inbox and to the sender, and records when it came and who from, not its text", async () => {
    const mailbox = await sentLetter();
    const sent = postmark();

    expect(
      await forwardReply(
        reply(mailbox, {
          Attachments: [{ Name: "a.pdf", Content: "QQ==", ContentType: "application/pdf", ContentLength: 1 }],
        }),
      ),
    ).toEqual(["replies@pauseai.uk", "Jane@Example.com"]);

    // Each named: the policy inbox by its own name, Jane by hers.
    expect(sent.map((e) => e.To)).toEqual([POLICY, `"Jane Smith" <Jane@Example.com>`]);
    expect(sent[0]).toMatchObject({
      From: "PauseAI UK <noreply@notify.pauseai.uk>",
      ReplyTo: `"Testy McTestface MP" <test-mp@parliament.example>, "Jane Smith" <jane.smith.482913@letters.pauseai.uk>`,
      Subject: "Re: S",
    });
    expect(sent[0].TextBody).toContain(copy.forwardedReply.toInbox("Testy McTestface MP", "Jane Smith"));
    expect(sent[1].TextBody).toContain(copy.forwardedReply.toSender("Testy McTestface MP"));
    expect(sent[1].TextBody).not.toContain(copy.forwardedReply.toInbox("Testy McTestface MP", "Jane Smith"));
    expect(sent[0].Headers).toBeUndefined();
    expect(sent[0].TextBody).toContain(
      `From: Testy McTestface MP <test-mp@parliament.example>\nTo: ${mailbox}@letters.pauseai.uk\nDate: `,
    );
    // Jane gets a copy, so the shared inbox's says nothing of hers.
    expect(sent[0].TextBody).not.toContain(copy.forwardedReply.senderCopied("Jane Smith"));
    expect(sent[0].TextBody).not.toContain(copy.forwardedReply.senderBlocked("Jane Smith"));
    expect(sent[0].TextBody).toContain("Thanks for your letter.");
    expect(sent[0].Attachments).toEqual([{ Name: "a.pdf", Content: "QQ==", ContentType: "application/pdf" }]);
    // Who it was to, and to whom it was forwarded and why, in order.
    expect(await events()).toEqual([
      {
        status: "replied",
        details: {
          from: "test-mp@parliament.example",
          name: "Testy McTestface MP",
          to: `${mailbox}@letters.pauseai.uk`,
          messageId: "inbound-1",
          backend: "postmark",
          handling: [
            { outcome: "forwarded", to: "replies@pauseai.uk", reason: "policy_inbox", at: expect.any(String) },
            { outcome: "forwarded", to: "Jane@Example.com", reason: "sender", at: expect.any(String) },
          ],
        },
      },
    ]);
    expect(await repliedAt()).not.toBeNull();
  });

  it("puts the forward in the letter's thread, by the Message-ID Postmark gave the letter", async () => {
    const mailbox = await sentLetter();
    const [{ id }] = await query<{ id: number }>("SELECT id::int AS id FROM letters");
    await query(
      `INSERT INTO email_sends (purpose, letter_id, address, outcome, message_id)
       VALUES ('letter', $1, 'test-mp@parliament.example', 'sent', 'letter-1'), ('letter', $1, 'test-mp@parliament.example', 'failed', NULL)`,
      [id],
    );
    const sent = postmark();
    await forwardReply(reply(mailbox));
    const threading = [
      { Name: "In-Reply-To", Value: "<letter-1@mtasv.net>" },
      { Name: "References", Value: "<letter-1@mtasv.net>" },
    ];
    expect(sent.map((e) => e.Headers)).toEqual([threading, threading]);
  });

  it("records each reply once, however often Postmark sends it, and keeps the first reply's time", async () => {
    const mailbox = await sentLetter();
    postmark();
    await forwardReply(reply(mailbox));
    const first = await repliedAt();
    await forwardReply(reply(mailbox));
    await forwardReply(reply(mailbox, { MessageID: "inbound-2" }));
    expect((await events()).map((e) => (e.details as { messageId: string }).messageId)).toEqual([
      "inbound-1",
      "inbound-2",
    ]);
    expect(await repliedAt()).toEqual(first);
  });

  it("logs an office's automatic reply, and forwards it, without counting it as a reply", async () => {
    const mailbox = await sentLetter();
    const sent = postmark();
    expect(
      await forwardReply(reply(mailbox, { Headers: [{ Name: "Auto-Submitted", Value: "auto-replied" }] })),
    ).toHaveLength(2);
    expect(sent).toHaveLength(2);
    expect(await events()).toEqual([
      {
        status: "auto_reply",
        details: expect.objectContaining({ from: "test-mp@parliament.example", messageId: "inbound-1" }),
      },
    ]);
    expect(await repliedAt()).toBeNull();

    // Sent again by Postmark, it's still logged once; then the person's reply counts.
    await forwardReply(reply(mailbox, { Headers: [{ Name: "Auto-Submitted", Value: "auto-replied" }] }));
    await forwardReply(reply(mailbox, { MessageID: "inbound-2" }));
    expect((await events()).map((e) => e.status)).toEqual(["auto_reply", "replied"]);
    expect(await repliedAt()).not.toBeNull();
  });

  it("logs the sender writing back into the thread, and sends it to our inbox only, without counting it as the MP's reply", async () => {
    const mailbox = await sentLetter();
    const sent = postmark();
    expect(
      await forwardReply(
        reply(mailbox, {
          // Her email gives no name: her address is bare where answering it reaches her.
          FromFull: { Email: "jane@example.com" },
          ToFull: [{ Email: "test-mp@parliament.example" }, { Email: `${mailbox}@letters.pauseai.uk` }],
        }),
      ),
    ).toEqual(["replies@pauseai.uk"]);
    expect(sent[0].TextBody).toContain(copy.forwardedReply.followUp("Jane Smith", "Testy McTestface MP"));
    expect(sent[0].ReplyTo).toBe(`jane@example.com, "Jane Smith" <${mailbox}@letters.pauseai.uk>`);
    expect(await events()).toEqual([
      {
        status: "replied",
        details: {
          from: "jane@example.com",
          name: "",
          to: `test-mp@parliament.example, ${mailbox}@letters.pauseai.uk`,
          messageId: "inbound-1",
          backend: "postmark",
          handling: [
            { outcome: "forwarded", to: "replies@pauseai.uk", reason: "policy_inbox", at: expect.any(String) },
            { outcome: "not_forwarded", to: "Jane@Example.com", reason: "own_follow_up" },
          ],
        },
      },
    ]);
    expect(await repliedAt()).toBeNull();
  });

  it("doesn't send the sender a copy they already have", async () => {
    const mailbox = await sentLetter();
    const sent = postmark();
    expect(
      await forwardReply(
        reply(mailbox, { CcFull: [{ Email: "jane@example.com", Name: "Jane Smith" }], ReplyTo: "office@example.org" }),
      ),
    ).toEqual(["replies@pauseai.uk"]);
    expect(sent).toHaveLength(1);
    // The shared inbox's copy says why, and quotes the Cc.
    expect(sent[0].TextBody).toContain(
      `${copy.forwardedReply.toInbox("Testy McTestface MP", "Jane Smith")}\n\n${copy.forwardedReply.senderCopied("Jane Smith")}\n\n`,
    );
    expect(sent[0].TextBody).toContain("Cc: Jane Smith <jane@example.com>\n");
    expect((await events())[0].details).toMatchObject({
      cc: "jane@example.com",
      replyTo: "office@example.org",
      handling: [
        { outcome: "forwarded", to: "replies@pauseai.uk" },
        { outcome: "not_forwarded", to: "Jane@Example.com", reason: "copied" },
      ],
    });
  });

  it("doesn't send our inbox a copy it already has", async () => {
    const mailbox = await sentLetter();
    const sent = postmark();
    expect(
      await forwardReply(
        reply(mailbox, {
          ToFull: [{ Email: "Replies@PauseAI.uk" }, { Email: `${mailbox}@letters.pauseai.uk` }],
        }),
      ),
    ).toEqual(["Jane@Example.com"]);
    expect(sent).toHaveLength(1);
  });

  it("copes without a shared inbox, or with a reply missing its details", async () => {
    vi.stubEnv("POLICY_INBOX", "");
    const mailbox = await sentLetter();
    const sent = postmark();
    expect(await forwardReply({ OriginalRecipient: `${mailbox}@letters.pauseai.uk` })).toEqual(["Jane@Example.com"]);
    expect(sent[0].Subject).toBe("");
    expect(sent[0].TextBody).toContain("From:  <>\nDate: \n");
    expect(sent[0].ReplyTo).toBe(`"Jane Smith" <${mailbox}@letters.pauseai.uk>`);
    expect(await events()).toEqual([
      {
        status: "replied",
        details: {
          from: "",
          name: "",
          messageId: null,
          backend: "postmark",
          handling: [{ outcome: "forwarded", to: "Jane@Example.com", reason: "sender", at: expect.any(String) }],
        },
      },
    ]);
  });

  it("finds the letter by any of our addresses the reply went to, whatever their case", async () => {
    await sentLetter();
    const sent = postmark();
    const address = "Jane.Smith.482913@Letters.PauseAI.uk";
    expect(await forwardReply(reply("other", { ToFull: [], OriginalRecipient: address }))).toHaveLength(2);
    expect(
      await forwardReply(reply("other", { ToFull: [{ Name: "No address" }], CcFull: [{ Email: address }] })),
    ).toHaveLength(2);
    expect(await forwardReply(reply("other", { ToFull: [], BccFull: [{ Email: address }] }))).toHaveLength(2);
    expect(sent).toHaveLength(6);
  });

  it("skips a recipient whose address is blocked, and throws if a forward fails, so Postmark tries again", async () => {
    const mailbox = await sentLetter();
    const sent = postmark();
    await recordProblem({ address: "jane@example.com", messageId: null, kind: "hard", reason: "", canReset: true });
    expect(await forwardReply(reply(mailbox))).toEqual(["replies@pauseai.uk"]);
    expect(sent.map((e) => e.To)).toEqual([POLICY]);
    expect(sent[0].TextBody).toContain(copy.forwardedReply.senderBlocked("Jane Smith"));
    expect((await events())[0].details).toMatchObject({
      handling: [
        { outcome: "forwarded", to: "replies@pauseai.uk" },
        { outcome: "failed", to: "Jane@Example.com", reason: "blocked" },
      ],
    });

    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(POSTMARK, () => HttpResponse.json({ ErrorCode: 300, Message: "Invalid" }, { status: 422 })));
    await expect(forwardReply(reply(mailbox, { MessageID: "inbound-2" }))).rejects.toThrow(
      /Couldn't forward a reply to letter \d+/,
    );
    // What was tried is kept, and replaced when Postmark tries again.
    expect((await events())[1].details).toMatchObject({
      handling: [{ outcome: "failed", to: "replies@pauseai.uk", reason: "refused" }],
    });
    postmark();
    await forwardReply(reply(mailbox, { MessageID: "inbound-2" }));
    expect((await events())[1].details).toMatchObject({
      handling: [
        { outcome: "forwarded", to: "replies@pauseai.uk" },
        { outcome: "failed", to: "Jane@Example.com", reason: "blocked" },
      ],
    });
  });

  it("finds an older letter by its reply+<hex> address", async () => {
    await sentLetter("3f9a0c1b2d4e5f60718293a4");
    postmark();
    expect(await forwardReply(reply("reply+3F9A0C1B2D4E5F60718293A4"))).toHaveLength(2);
    expect(await events()).toHaveLength(1);
  });

  it("takes the letter Postmark delivered the reply to, when it went to two", async () => {
    await sentLetter();
    const [{ politicianId }] = await query<{ politicianId: number }>(
      `SELECT notable_person_id::int AS "politicianId" FROM letters`,
    );
    const sam = [{ id: await addTestLetter({ politicianId, senderName: "Sam", postmarkMailbox: "sam.000001" }) }];
    postmark();
    const both = reply("jane.smith.482913", {
      OriginalRecipient: "sam.000001@letters.pauseai.uk",
      ToFull: [{ Email: "jane.smith.482913@letters.pauseai.uk" }, { Email: "sam.000001@letters.pauseai.uk" }],
    });
    expect(await forwardReply(both)).toEqual(["replies@pauseai.uk", "sam@example.com"]);
    expect(await query("SELECT letter_id::int AS id FROM letter_events WHERE status = 'replied'")).toEqual(sam);
  });

  describe("keeping the reply whole", () => {
    beforeEach(stubBlobsEnv);
    const kept = () =>
      query<{
        account: string;
        gmail: string | null;
        rfc: string | null;
        from: string;
        supporter: boolean;
        key: string;
      }>(
        `SELECT account, gmail_message_id AS gmail, rfc_message_id AS rfc, from_address AS "from",
           from_supporter AS supporter, blob_key AS key FROM letter_replies ORDER BY id`,
      );
    const raw = "Message-ID: <office-1@parliament.example>\r\nSubject: Re: S\r\n\r\nThanks for your letter.";
    const withRaw = (mailbox: string, extra = {}) =>
      reply(mailbox, {
        RawEmail: raw,
        Headers: [{ Name: "Message-ID", Value: "<office-1@parliament.example>" }],
        ...extra,
      });

    it("keeps a person's reply on its letter, once, however often Postmark sends it", async () => {
      const mailbox = await sentLetter();
      postmark();
      await forwardReply(withRaw(mailbox));
      await forwardReply(withRaw(mailbox));
      expect(await kept()).toEqual([
        {
          account: `${mailbox}@letters.pauseai.uk`,
          gmail: null,
          rfc: "office-1@parliament.example",
          from: "test-mp@parliament.example",
          supporter: false,
          key: "postmark/inbound-1.eml.gz",
        },
      ]);
      expect(gunzipSync((await letterReply("postmark/inbound-1.eml.gz"))!).toString()).toBe(raw);
      expect(await threadMessages((await query<{ id: number }>("SELECT id::int AS id FROM letters"))[0].id)).toEqual([
        expect.objectContaining({ fromAddress: "test-mp@parliament.example", text: "Thanks for your letter." }),
      ]);
    });

    it("doesn't keep it again under another of Postmark's IDs, as when the letter has it from a mailbox", async () => {
      const mailbox = await sentLetter();
      postmark();
      await forwardReply(withRaw(mailbox));
      await forwardReply(withRaw(mailbox, { MessageID: "inbound-2" }));
      expect(await kept()).toHaveLength(1);
    });

    it("keeps the sender's own follow-up as theirs, and one with no Message-ID or sender", async () => {
      const mailbox = await sentLetter();
      postmark();
      await forwardReply(withRaw(mailbox, { FromFull: { Email: "JANE@example.com", Name: "Jane" } }));
      await forwardReply({ OriginalRecipient: `${mailbox}@letters.pauseai.uk`, MessageID: "inbound-2", RawEmail: raw });
      expect(await kept()).toEqual([
        expect.objectContaining({ from: "jane@example.com", supporter: true }),
        expect.objectContaining({ from: "", rfc: null, supporter: false, key: "postmark/inbound-2.eml.gz" }),
      ]);
    });

    it("keeps nothing of an automatic reply, or without the whole message or Postmark's ID", async () => {
      const mailbox = await sentLetter();
      postmark();
      await forwardReply(withRaw(mailbox, { Headers: [{ Name: "Auto-Submitted", Value: "auto-replied" }] }));
      await forwardReply(reply(mailbox, { MessageID: "inbound-2" }));
      await forwardReply(withRaw(mailbox, { MessageID: undefined }));
      expect(await kept()).toEqual([]);
    });

    it("brings onto the letter a one-off kept from a mailbox that answers the letter", async () => {
      const mailbox = await sentLetter();
      const [{ id: letter }] = await query<{ id: number }>("SELECT id::int AS id FROM letters");
      await query(
        `INSERT INTO email_sends (purpose, letter_id, address, outcome, message_id) VALUES ('letter', $1, 'x', 'sent', 'pm-letter')`,
        [letter],
      );
      const [{ id: thread }] = await query<{ id: number }>(
        "INSERT INTO one_off_threads (subject, latest_at) VALUES ('Re: S', now()) RETURNING id::int AS id",
      );
      await query(
        `INSERT INTO one_off_messages (thread_id, account, gmail_message_id, gmail_thread_id, in_reply_to, from_address,
           addresses, at, from_us, blob_key, size)
         VALUES ($1, 'policy@pauseai.uk', 'g1', 'gt1', ARRAY['pm-letter@mtasv.net'], 'aide@parliament.example', '{}', now(), false, 'one-off/g1', 1)`,
        [thread],
      );
      postmark();
      await forwardReply(withRaw(mailbox));
      expect((await kept()).map((row) => row.key)).toEqual(["postmark/inbound-1.eml.gz", "one-off/g1"]);
      expect(await query("SELECT 1 FROM one_off_threads")).toEqual([]);
    });
  });

  it("ignores mail for no letter, unknown letters, and our own mail coming back", async () => {
    const mailbox = await sentLetter();
    const sent = postmark();
    expect(await forwardReply(reply("", { ToFull: [{ Email: "someone@example.org" }] }))).toEqual([]);
    expect(await forwardReply(reply(""))).toEqual([]);
    expect(await forwardReply(reply("nope"))).toEqual([]);
    expect(await forwardReply(reply(mailbox, { FromFull: { Email: "noreply@NOTIFY.pauseai.uk" } }))).toEqual([]);
    expect(await forwardReply(reply(mailbox, { FromFull: { Email: "reply+x@letters.pauseai.uk" } }))).toEqual([]);
    expect(sent).toEqual([]);
  });
});

describe("isAutoReply", () => {
  const email = (headers: Record<string, string>, Subject = "Re: Your letter") => ({
    Subject,
    Headers: Object.entries(headers).map(([Name, Value]) => ({ Name, Value })),
  });

  it("knows a machine's reply by its headers", () => {
    for (const headers of <Record<string, string>[]>[
      { "Auto-Submitted": "auto-replied" },
      { "auto-submitted": " Auto-Generated " },
      { "X-Autoreply": "yes" },
      { "X-Autorespond": "" },
      { Precedence: "auto_reply" },
      { Precedence: "bulk" },
      { Precedence: "junk" },
    ]) {
      expect(isAutoReply(email(headers)), JSON.stringify(headers)).toBe(true);
    }
  });

  it("or failing those, by its subject", () => {
    for (const subject of [
      "Automatic reply: Request to co-sign",
      "Auto-Reply: x",
      "autoreply",
      "Out of Office: back Monday",
      "Out of the office",
      "AutoResponse",
    ]) {
      expect(isAutoReply(email({}, subject)), subject).toBe(true);
    }
  });

  it("takes a person's reply as one", () => {
    expect(isAutoReply(email({ "Auto-Submitted": "no", Precedence: "first-class", "X-Mailer": "Outlook" }))).toBe(
      false,
    );
    expect(isAutoReply(email({}, "Re: Out of office hours support"))).toBe(false);
    expect(isAutoReply({})).toBe(false);
    expect(isAutoReply({ Headers: [{}, { Name: "Auto-Submitted" }] })).toBe(false);
  });
});
