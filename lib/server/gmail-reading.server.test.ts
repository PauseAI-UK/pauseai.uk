import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { jobTitles, staffCopy } from "@/lib/content/staff-interface";
import { NIGHTLY } from "@/lib/import-runs";
import { notifications } from "@/tests/notifications";
import {
  addTestLetter,
  addTestPolitician,
  connectTestGmail,
  describeWithDatabase,
  useTestDatabase,
} from "@/tests/database";
import { allResults, heldAtOnce } from "@/tests/at-once";
import { query } from "./db.server";
import { readGmail } from "./gmail-reading.server";
import { noteAutoReply } from "./letter-replies.server";
import { listRuns, latestRun, startRunning, stopRunning } from "./import-runs.server";
import { ANOTHER_RUNNING, runJob } from "./jobs.server";
import { letterReply } from "./outside-services/blobs.server";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const JO = "jo@pauseai.uk";
const REQUEST = new Request("https://pauseai.uk/api/cron/read-gmail", { method: "POST" });
/** What the scheduled job's read of every account found. */
const read = async () => (await readGmail(NIGHTLY, REQUEST)).accounts;
const fixture = (name: string) => readFileSync(join(process.cwd(), "tests/fixtures/gmail", name), "latin1");

/** A message in the fake mailbox: its headers, its whole text, and its thread. */
type Message = { headers: Record<string, string>; raw?: string; threadId?: string; internalDate?: string };

/**
 * A fake Gmail for every account: `history` lists what arrived since the
 * last read, or null for history that's gone; `search` what each query
 * finds; `messages` each message by ID.
 */
function mailbox({
  history = [] as string[] | null,
  search = {} as Record<string, string[]>,
  messages = {} as Record<string, Message>,
}) {
  const fetched: string[] = [];
  server.use(
    http.get(`${API}/history`, () =>
      history === null
        ? new HttpResponse(null, { status: 404 })
        : HttpResponse.json({
            history: [{ messagesAdded: history.map((id) => ({ message: { id } })) }],
            historyId: "2000",
          }),
    ),
    http.get(`${API}/messages`, ({ request }) =>
      HttpResponse.json({
        messages: (search[new URL(request.url).searchParams.get("q")!] ?? []).map((id) => ({ id })),
      }),
    ),
    http.get(`${API}/messages/:id`, ({ request, params }) => {
      const id = String(params.id);
      const message = messages[id];
      const format = new URL(request.url).searchParams.get("format");
      fetched.push(`${id}:${format}`);
      // One the history listed that's gone since.
      if (!message) return new HttpResponse(null, { status: 404 });
      if (format === "raw")
        return HttpResponse.json({ raw: Buffer.from(message.raw ?? "", "latin1").toString("base64url") });
      return HttpResponse.json({
        id,
        threadId: message.threadId ?? `thread-${id}`,
        internalDate: message.internalDate ?? String(Date.parse("2026-11-02T10:00:00Z")),
        payload: { headers: Object.entries(message.headers).map(([name, value]) => ({ name, value })) },
      });
    }),
  );
  return fetched;
}

const BOUNCE_SEARCH = "from:mailer-daemon OR from:postmaster newer_than:3d";

describeWithDatabase("reading Gmail", () => {
  useTestDatabase();
  beforeEach(() => {
    vi.stubEnv(
      "NETLIFY_BLOBS_CONTEXT",
      Buffer.from(JSON.stringify({ edgeURL: "https://blobs.fixture.invalid", siteID: "fixture", token: "t" })).toString(
        "base64",
      ),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /** A letter of a mailing sent from Jo's Gmail to Polly, with its Message-ID and thread. Returns its ID. */
  async function sentLetter(n = 1, email = "polly@example.org"): Promise<number> {
    const politician = await addTestPolitician({ airtableId: null, name: `Polly ${n}`, email });
    const [{ id }] = await query<{ id: number }>(
      "INSERT INTO letters (kind, notable_person_id, status, sent_at) VALUES ('pauseai', $1, 'sent', now()) RETURNING id::int AS id",
      [politician],
    );
    await query(
      `INSERT INTO email_sends (purpose, letter_id, address, outcome, message_id, backend, sender, rfc_message_id, gmail_thread_id)
       VALUES ('mailing', $1, $2, 'sent', $3, 'gmail', $4, $5, $6)`,
      [id, email, `g-letter-${n}`, JO, `letter-${n}@pauseai.uk`, `t${n}`],
    );
    return id;
  }

  const replies = () =>
    query(
      `SELECT letter_id::int AS "letterId", gmail_message_id AS id, from_address AS "from", from_name AS name, from_us AS "fromUs",
         rfc_message_id AS rfc, subject, blob_key AS key FROM letter_replies ORDER BY letter_replies.id`,
    );
  const events = () => query('SELECT letter_id::int AS "letterId", status, details FROM letter_events ORDER BY id');

  it("keeps a reply to a copy of a broadcast whole, before anything else sees it, and only notes an automatic one; not an answer of ours from the mailbox", async () => {
    await connectTestGmail(JO, "1000");
    const [{ id: mailing }] = await query<{ id: number }>(
      `INSERT INTO mailings (title, audience, channel, topic, filter, body, created_by, state)
       VALUES ('', 'supporters', 'email', 'newsletter', '{}', '{}', 'staff@pauseai.uk', 'draft') RETURNING id::int AS id`,
    );
    await query(
      `INSERT INTO broadcast_messages (mailing_id, status, rfc_message_id, topics) VALUES ($1, 'sent', 'copy-1@pauseai.uk', '{newsletter}')`,
      [mailing],
    );
    const reply =
      "From: Jane <jane@example.com>\r\nSubject: Re: News\r\nIn-Reply-To: <copy-1@pauseai.uk>\r\n\r\nPlease stop.";
    mailbox({
      history: ["b1", "b2", "b3"],
      messages: {
        // An answer written in the mailbox's own Gmail, not the site.
        b3: {
          headers: { From: `PauseAI UK <${JO}>`, Subject: "Re: News", "In-Reply-To": "<copy-1@pauseai.uk>" },
          raw: "Subject: Re: News\r\n\r\nDone.",
        },
        b1: {
          headers: { From: "Jane <jane@example.com>", Subject: "Re: News", "In-Reply-To": "<copy-1@pauseai.uk>" },
          raw: reply,
        },
        b2: {
          headers: {
            From: "Jane <jane@example.com>",
            Subject: "Out of office",
            "Auto-Submitted": "auto-replied",
            References: "<other@example.org> <copy-1@pauseai.uk>",
          },
          raw: "Subject: Out of office\r\n\r\nAway.",
        },
      },
    });
    expect(await read()).toMatchObject([{ account: JO, replies: 1, autoReplies: 1 }]);
    expect(await query("SELECT from_address, subject, automatic, blob_key FROM broadcast_replies ORDER BY id")).toEqual(
      [
        { from_address: "jane@example.com", subject: "Re: News", automatic: false, blob_key: `${JO}/b1.eml.gz` },
        { from_address: "jane@example.com", subject: "Out of office", automatic: true, blob_key: `${JO}/b2.eml.gz` },
      ],
    );
    expect(await query("SELECT kind FROM broadcast_message_events")).toEqual([{ kind: "replied" }]);
    expect(gunzipSync((await letterReply(`${JO}/b1.eml.gz`))!).toString("latin1")).toBe(reply);
  });

  it("keeps a politician's reply whole and marks the letter replied to; keeps our answer, but not as a reply", async () => {
    await connectTestGmail(JO, "1000");
    const letter = await sentLetter();
    const reply = "From: Polly <Polly@example.org>\r\nSubject: Re: AI\r\nMessage-ID: <r1@example.org>\r\n\r\nThanks.";
    const fetched = mailbox({
      history: ["r1", "a1"],
      messages: {
        r1: {
          headers: {
            From: "Polly <Polly@example.org>",
            To: "=?UTF-8?Q?Jo_St=C3=A4ff?= <jo@pauseai.uk>",
            Cc: "office@example.org",
            "Reply-To": "caseworker@example.org",
            Subject: "Re: AI",
            "Message-ID": "<r1@example.org>",
            "In-Reply-To": "<letter-1@pauseai.uk>",
          },
          raw: reply,
        },
        a1: {
          headers: { From: JO, References: "<letter-1@pauseai.uk> <r1@example.org>" },
          raw: "Subject: x\r\n\r\nGlad.",
        },
      },
    });
    expect(await read()).toEqual([{ account: JO, replies: 2, autoReplies: 0, bounces: 0 }]);
    expect(await replies()).toEqual([
      {
        letterId: letter,
        id: "r1",
        from: "polly@example.org",
        name: "Polly",
        fromUs: false,
        rfc: "r1@example.org",
        subject: "Re: AI",
        key: `${JO}/r1.eml.gz`,
      },
      { letterId: letter, id: "a1", from: JO, name: "", fromUs: true, rfc: null, subject: "", key: `${JO}/a1.eml.gz` },
    ]);
    expect(gunzipSync((await letterReply(`${JO}/r1.eml.gz`))!).toString()).toBe(reply);
    expect(await query("SELECT replied_at FROM letters")).toEqual([{ replied_at: new Date("2026-11-02T10:00:00Z") }]);
    expect(await events()).toEqual([
      {
        letterId: letter,
        status: "replied",
        // Who it was to, as it came, its encoded words decoded; read here, it goes no further.
        details: {
          from: "polly@example.org",
          name: "Polly",
          to: "Jo Stäff <jo@pauseai.uk>",
          cc: "office@example.org",
          replyTo: "caseworker@example.org",
          handling: [{ outcome: "not_forwarded", reason: "gmail" }],
          gmailMessageId: "r1",
          // What received it.
          backend: "gmail",
          account: JO,
        },
      },
    ]);
    expect(await query("SELECT gmail_history_id FROM staff_accounts")).toEqual([{ gmail_history_id: "2000" }]);
    // Only the headers of each, then the two kept, whole.
    expect(fetched).toEqual(["r1:metadata", "r1:raw", "a1:metadata", "a1:raw"]);

    // Read again, nothing is kept twice.
    expect(await read()).toEqual([{ account: JO, replies: 0, autoReplies: 0, bounces: 0 }]);
    expect(await replies()).toHaveLength(2);
  });

  it("keeps a supporter's own message on their letter as theirs, without marking it replied to", async () => {
    await connectTestGmail(JO);
    const polly = await addTestPolitician({ airtableId: null, email: "polly@example.org" });
    const letter = await addTestLetter({ politicianId: polly, senderEmail: "Wendy@example.com" });
    await query(
      `INSERT INTO email_sends (purpose, letter_id, address, outcome, message_id, backend, sender, rfc_message_id, gmail_thread_id, imported)
       VALUES ('letter', $1, 'polly@example.org', 'sent', 'g-letter', 'gmail', $2, 'letter@pauseai.uk', 't1', true)`,
      [letter, JO],
    );
    mailbox({
      history: ["s1"],
      messages: {
        s1: { headers: { From: "Wendy <wendy@example.com>", "In-Reply-To": "<letter@pauseai.uk>" }, raw: "Update." },
      },
    });
    expect(await read()).toMatchObject([{ replies: 1 }]);
    expect(await query("SELECT from_supporter FROM letter_replies")).toEqual([{ from_supporter: true }]);
    expect(await query("SELECT replied_at FROM letters")).toEqual([{ replied_at: null }]);
    expect((await events()).map((event) => event.status)).toContain("replied");
  });

  it("finds the letter by its thread when a reply names nothing: ours, or one a kept message is in", async () => {
    await connectTestGmail(JO);
    const one = await sentLetter(1);
    const two = await sentLetter(2, "dora@example.org");
    await query(
      `INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, from_address, at, from_us, blob_key, size)
       VALUES ($1, $2, 'old', 'kept-thread', 'dora@example.org', now(), false, 'k', 1)`,
      [two, JO],
    );
    mailbox({
      history: ["x1", "x2", "x3"],
      messages: {
        x1: { headers: { From: "polly@example.org" }, threadId: "t1", raw: "a" },
        x2: { headers: { From: "dora@example.org" }, threadId: "kept-thread", raw: "b" },
        x3: { headers: { From: "nobody@example.org", "Message-ID": "<x3@example.org>" }, threadId: "elsewhere" },
      },
    });
    expect(await read()).toMatchObject([{ replies: 2 }]);
    expect((await replies()).map((r) => [r.id, r.letterId])).toEqual([
      ["old", two],
      ["x1", one],
      ["x2", two],
    ]);
  });

  it("skips a message deleted between the history listing it and its fetch, and reads the rest", async () => {
    await connectTestGmail(JO);
    await sentLetter();
    mailbox({
      history: ["gone", "x1"],
      messages: { x1: { headers: { From: "polly@example.org" }, threadId: "t1", raw: "a" } },
    });
    expect(await read()).toMatchObject([{ account: JO, replies: 1 }]);
    expect((await read())[0].error).toBeUndefined();
  });

  it("leaves alone the letter itself, in Sent, and notes an automatic reply once", async () => {
    await connectTestGmail(JO);
    const letter = await sentLetter();
    const fetched = mailbox({
      history: ["sent", "ooo"],
      messages: {
        sent: { headers: { From: JO, "Message-ID": "<letter-1@pauseai.uk>" }, threadId: "t1" },
        ooo: {
          headers: {
            From: "polly@example.org",
            "Auto-Submitted": "auto-replied",
            "In-Reply-To": "<letter-1@pauseai.uk>",
          },
        },
      },
    });
    expect(await read()).toMatchObject([{ replies: 0, autoReplies: 1 }]);
    expect(await read()).toMatchObject([{ autoReplies: 0 }]);
    expect(await events()).toEqual([
      {
        letterId: letter,
        status: "auto_reply",
        details: {
          from: "polly@example.org",
          handling: [{ outcome: "not_forwarded", reason: "gmail" }],
          gmailMessageId: "ooo",
        },
      },
    ]);
    expect(await replies()).toEqual([]);
    expect(fetched.filter((one) => one.endsWith(":raw"))).toEqual([]);
  });

  it("leaves alone our forward of a reply Postmark had, which is kept from Postmark's own copy", async () => {
    await connectTestGmail(JO);
    const letter = await sentLetter();
    await query(
      `INSERT INTO email_sends (purpose, letter_id, address, outcome, message_id, backend)
       VALUES ('forwarded-reply', $1, $2, 'sent', 'pm-fwd', 'postmark')`,
      [letter, JO],
    );
    const fetched = mailbox({
      history: ["fwd"],
      messages: {
        fwd: {
          headers: {
            From: "PauseAI UK <noreply@notify.pauseai.uk>",
            "Message-ID": "<pm-fwd@mtasv.net>",
            "In-Reply-To": "<letter-1@pauseai.uk>",
          },
        },
      },
    });
    expect(await read()).toMatchObject([{ replies: 0 }]);
    expect(await replies()).toEqual([]);
    expect(fetched.filter((one) => one.endsWith(":raw"))).toEqual([]);
  });

  it("records a bounce as Postmark's, on the letter it was, once; finds another server's by searching; and leaves alone any address we didn't send the email to", async () => {
    await connectTestGmail(JO);
    const letter = await sentLetter(1, "gone@example.org");
    await sentLetter(2, "full@example.net");
    mailbox({
      history: ["b1"],
      search: { [BOUNCE_SEARCH]: ["b1", "b2", "b3", "b4"] },
      messages: {
        b1: {
          headers: { From: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>" },
          raw: fixture("gmail-hard-bounce.eml"),
        },
        b2: {
          headers: { From: "postmaster@example.net", Subject: "Undeliverable" },
          raw: fixture("other-server-delay.eml"),
        },
        // Anyone can write as mailer-daemon: one that names no email of ours, and one that names ours but
        // addresses it didn't go to.
        b3: {
          headers: { From: "MAILER-DAEMON@example.com" },
          raw: "Subject: x\r\nX-Failed-Recipients: c@example.com\r\n\r\n?",
        },
        b4: {
          headers: { From: "mailer-daemon@example.com", "In-Reply-To": "<letter-2@pauseai.uk>" },
          raw: "Subject: x\r\nX-Failed-Recipients: mp@parliament.example, jo@pauseai.uk\r\nIn-Reply-To: <letter-2@pauseai.uk>\r\n\r\n?",
        },
      },
    });
    expect(await read()).toMatchObject([{ bounces: 2 }]);
    expect(
      await query("SELECT address, message_id, kind, reason, gmail_message_id FROM email_problems ORDER BY id"),
    ).toEqual([
      {
        address: "gone@example.org",
        message_id: "g-letter-1",
        kind: "hard",
        reason: "550 5.1.1 The email account that you tried to reach does not exist.",
        gmail_message_id: "b1",
      },
      { address: "full@example.net", message_id: "g-letter-2", kind: "soft", reason: "4.2.2", gmail_message_id: "b2" },
    ]);
    expect(await query("SELECT address FROM email_blocks ORDER BY address")).toEqual([{ address: "gone@example.org" }]);
    expect(await query("SELECT status FROM letters WHERE id = $1", [letter])).toEqual([{ status: "bounced" }]);
    // The search finds them again tomorrow; they're recorded once.
    expect(await read()).toMatchObject([{ bounces: 0 }]);
    expect(await query("SELECT 1 FROM email_problems")).toHaveLength(2);
  });

  it("knows our letter in Sent by Gmail's ID when Gmail sent it with a Message-ID of its own, and finds its bounce by its thread", async () => {
    await connectTestGmail(JO);
    const letter = await sentLetter(1, "gone@example.org");
    mailbox({
      history: ["g-letter-1", "b1"],
      messages: {
        "g-letter-1": { threadId: "t1", headers: { From: JO, "Message-ID": "<CAGt2Eo1@mail.gmail.com>" }, raw: "x" },
        b1: {
          threadId: "t1",
          headers: { From: "mailer-daemon@googlemail.com", "In-Reply-To": "<CAGt2Eo1@mail.gmail.com>" },
          raw: "Subject: x\r\nX-Failed-Recipients: gone@example.org\r\nIn-Reply-To: <CAGt2Eo1@mail.gmail.com>\r\n\r\n?",
        },
      },
    });
    expect(await read()).toEqual([{ account: JO, replies: 0, autoReplies: 0, bounces: 1 }]);
    expect(await replies()).toEqual([]);
    expect(await query("SELECT message_id FROM email_problems")).toEqual([{ message_id: "g-letter-1" }]);
    expect(await query("SELECT status FROM letters WHERE id = $1", [letter])).toEqual([{ status: "bounced" }]);
  });

  it("says why when a bounce gives nothing to go on", async () => {
    await connectTestGmail(JO);
    mailbox({
      history: ["b1"],
      messages: { b1: { headers: { From: "postmaster@example.net" }, raw: "Subject: hm\r\n\r\nNothing." } },
    });
    expect(await read()).toMatchObject([{ bounces: 0 }]);
  });

  it("searches the last few days when the mailbox's history has gone, and starts again from now", async () => {
    await connectTestGmail(JO, "5");
    await sentLetter();
    mailbox({
      history: null,
      search: { "newer_than:3d": ["r1"] },
      messages: { r1: { headers: { From: "polly@example.org", "In-Reply-To": "<letter-1@pauseai.uk>" }, raw: "x" } },
    });
    expect(await read()).toEqual([{ account: JO, replies: 1, autoReplies: 0, bounces: 0, restarted: true }]);
    expect(await query("SELECT gmail_history_id FROM staff_accounts")).toEqual([{ gmail_history_id: "1000" }]);
  });

  it("reads an account whose name Gmail won't give all the same, keeping that as a problem", async () => {
    await connectTestGmail(JO, "8");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mailbox({});
    server.use(http.get(`${API}/settings/sendAs`, () => new HttpResponse(null, { status: 403 })));
    expect(await read()).toEqual([{ account: JO, replies: 0, autoReplies: 0, bounces: 0 }]);
    expect(await latestRun("read-gmail")).toMatchObject({
      status: "unchanged",
      problems: [{ what: staffCopy.problems.job.nameUnknown(JO), error: "Gmail answered 403 for /settings/sendAs" }],
    });
  });

  it("reads each account, saying which failed and leaving where it got to", async () => {
    await connectTestGmail("al@pauseai.uk", "7");
    await connectTestGmail(JO, "8");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mailbox({});
    server.use(
      http.get(`${API}/history`, ({ request }) =>
        request.headers.get("authorization")!.endsWith("al@pauseai.uk")
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json({ historyId: "9" }),
      ),
    );
    expect(await read()).toEqual([
      {
        account: "al@pauseai.uk",
        replies: 0,
        autoReplies: 0,
        bounces: 0,
        error: "Gmail answered 500 for /history",
      },
      { account: JO, replies: 0, autoReplies: 0, bounces: 0 },
    ]);
    expect(error).toHaveBeenCalledWith(
      staffCopy.problems.job.couldntRead("al@pauseai.uk"),
      "Gmail answered 500 for /history",
    );
    expect(await query("SELECT email, gmail_history_id AS h FROM staff_accounts ORDER BY email")).toEqual([
      { email: "al@pauseai.uk", h: "7" },
      { email: JO, h: "9" },
    ]);
  });

  it("keeps an account it couldn't read as a problem of the run, and tells the notification inbox once until it's read again", async () => {
    const sent = notifications();
    await connectTestGmail("al@pauseai.uk", "7");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mailbox({});
    let failing = true;
    server.use(
      http.get(`${API}/history`, () =>
        failing ? new HttpResponse(null, { status: 500 }) : HttpResponse.json({ historyId: "9" }),
      ),
    );
    const words = staffCopy.notifications.importProblems;
    const title = jobTitles["read-gmail"];
    const told = words.body(
      title,
      [`- ${staffCopy.problems.job.couldntRead("al@pauseai.uk")} Gmail answered 500 for /history`],
      "https://pauseai.uk/staff/scheduled-jobs/gmail",
    );
    // Its first run, failing: told. Failing again: not.
    await read();
    await read();
    expect(sent.map((s) => [s.Subject, s.TextBody])).toEqual([[words.subject(title), told]]);
    expect(await latestRun("read-gmail")).toMatchObject({
      status: "ok",
      problems: [
        { what: staffCopy.problems.job.couldntRead("al@pauseai.uk"), error: "Gmail answered 500 for /history" },
      ],
    });
    // Read, then failing: told again.
    failing = false;
    await read();
    failing = true;
    await read();
    expect(sent).toHaveLength(2);
    // After a run that failed outright, which read no account: told.
    await query(
      "INSERT INTO import_runs (job, started_by, status, error) VALUES ('read-gmail', 'nightly', 'failed', 'boom')",
    );
    await read();
    expect(sent).toHaveLength(3);
  });

  it("says an account Google refused was disconnected, and reads the rest", async () => {
    const sent = notifications();
    await connectTestGmail("al@pauseai.uk");
    await connectTestGmail(JO, "8");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mailbox({});
    server.use(
      http.post("https://oauth2.googleapis.com/token", async ({ request }) =>
        (await request.clone().text()).includes("al%40pauseai.uk")
          ? HttpResponse.json({ error: "invalid_grant" }, { status: 400 })
          : undefined,
      ),
    );
    expect(await read()).toEqual([
      {
        account: "al@pauseai.uk",
        replies: 0,
        autoReplies: 0,
        bounces: 0,
        error: "Google refused the token request: 400 invalid_grant",
        disconnected: true,
      },
      { account: JO, replies: 0, autoReplies: 0, bounces: 0 },
    ]);
    expect(await query("SELECT email FROM staff_accounts WHERE gmail_token IS NOT NULL")).toEqual([{ email: JO }]);
    // Its own email, that it was disconnected, and not the one for an account that can't be read too.
    expect(sent.map((s) => s.Subject)).toEqual([staffCopy.notifications.gmailDisconnected.subject("al@pauseai.uk")]);
  });

  it("keeps each run in the import log, unchanged when it found nothing, and who started it", async () => {
    await connectTestGmail(JO);
    await sentLetter();
    mailbox({});
    await readGmail(JO);
    mailbox({
      history: ["r1"],
      messages: { r1: { headers: { From: "polly@example.org", "In-Reply-To": "<letter-1@pauseai.uk>" }, raw: "x" } },
    });
    await readGmail(NIGHTLY, REQUEST);
    expect(await listRuns("read-gmail")).toMatchObject([
      { status: "ok", startedBy: NIGHTLY, result: { accounts: [{ account: JO, replies: 1 }] } },
      { status: "unchanged", startedBy: JO, result: { accounts: [{ account: JO, replies: 0 }] } },
    ]);
  });

  it("reads each reply, automatic reply and bounce once when runs overlap, the runs started meanwhile not going", async () => {
    await connectTestGmail(JO);
    // To the address the bounce says failed.
    const letter = await sentLetter(1, "gone@example.org");
    mailbox({
      history: ["r1", "ooo", "b1"],
      messages: {
        r1: { headers: { From: "polly@example.org", "In-Reply-To": "<letter-1@pauseai.uk>" }, raw: "Thanks." },
        ooo: {
          headers: {
            From: "polly@example.org",
            "Auto-Submitted": "auto-replied",
            "In-Reply-To": "<letter-1@pauseai.uk>",
          },
        },
        b1: {
          headers: { From: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>" },
          raw: fixture("gmail-hard-bounce.eml"),
        },
      },
    });
    // The run that goes waits at Gmail until the other two have been turned away.
    const { held, start } = heldAtOnce(
      () => runJob("read-gmail", NIGHTLY, REQUEST),
      (run) => run === ANOTHER_RUNNING,
    );
    server.use(
      http.get(`${API}/history`, async () => {
        await held;
      }),
    );
    const runs = allResults(await start());
    expect(runs.filter((run) => run === ANOTHER_RUNNING)).toHaveLength(2);
    expect(runs.find((run) => run !== ANOTHER_RUNNING)).toEqual({
      accounts: [{ account: JO, replies: 1, autoReplies: 1, bounces: 1 }],
    });
    expect(await replies()).toHaveLength(1);
    expect((await events()).map((event) => [event.letterId, event.status])).toEqual([
      [letter, "replied"],
      [letter, "auto_reply"],
      [letter, "bounced"],
    ]);
    expect(await query("SELECT address, gmail_message_id FROM email_problems")).toEqual([
      { address: "gone@example.org", gmail_message_id: "b1" },
    ]);
    expect((await listRuns("read-gmail")).map((run) => run.status)).toEqual(["ok"]);
  });

  it("notes an automatic reply once when two jobs come to it at once", async () => {
    const letter = await sentLetter();
    const message = {
      id: "ooo",
      threadId: "t-ooo",
      labelIds: [],
      internalDate: String(Date.parse("2026-10-20T09:00:00Z")),
      headers: new Map([["from", "polly@example.org"]]),
    };
    expect((await Promise.all([noteAutoReply(letter, message), noteAutoReply(letter, message)])).sort()).toEqual([
      false,
      true,
    ]);
    expect((await events()).map((event) => event.status)).toEqual(["auto_reply"]);
  });

  it("tells the notification inbox once of an account it can't read, whatever runs didn't go as it read", async () => {
    const sent = notifications();
    await connectTestGmail("al@pauseai.uk", "7");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mailbox({});
    server.use(http.get(`${API}/history`, () => new HttpResponse(null, { status: 500 })));
    await read();
    // A run started while another is going keeps nothing, and doesn't go.
    await startRunning("read-gmail", NIGHTLY);
    expect(await runJob("read-gmail", JO, undefined)).toBe(ANOTHER_RUNNING);
    await stopRunning("read-gmail");
    expect(await listRuns("read-gmail")).toHaveLength(1);
    await read();
    expect(sent).toHaveLength(1);
  });
});
