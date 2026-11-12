import "server-only";
import { randomBytes } from "node:crypto";
import { stopsAt, type BroadcastChannel, type BroadcastTerms } from "@/lib/broadcasts";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { staffCopy } from "@/lib/content/staff-interface";
import type { Topic } from "@/lib/contact-permissions";
import { checkMailingDoc, type MailingRecipientValues } from "@/lib/mailing-doc";
import { now } from "@/lib/now";
import type { StoredFilter } from "@/lib/staff-search";
import { SENDING, staffTime } from "@/lib/staff-time";
import { siteUrl } from "@/lib/site-url";
import { logChange } from "./audit";
import { broadcastBackend } from "./broadcast-channels";
import { supporterAudience } from "./broadcast-recipients";
import { query } from "./db";
import { hashOf } from "./email-settings";
import { sendBroadcastCopies, type BroadcastCopyEmail, type BroadcastCopyResult } from "./email";
import { emailFor } from "./mailing-drafts";
import { newMessageId } from "./mime";
import { notifyStaff, staffLink } from "./notifications";
import { recordOptOut } from "./opt-outs";
import { checkSuppression, civicrmKey, SUPPRESSION_BATCH, type Block } from "./outside-services/civicrm";
import { BATCH_SIZE } from "./outside-services/postmark";
import { problem } from "./problems";
import { nameLine } from "./proxies";

// Sending broadcasts to supporters, in the hourly send-mailings run, as
// mailings to politicians go. A broadcast that's due starts: who it goes to
// is found then (supporterAudience), a copy each, once to each address,
// each with its own unsubscribe link. Its copies go in batches, each checked
// just before: anyone who has opted out since is skipped, and every address
// is checked with CiviCRM's checkSuppression, which drops anyone PauseAI
// mustn't bulk email and keeps that as an opt-out of ours. An email goes by
// Postmark's broadcast stream. Nothing goes unchecked: with no complete
// CiviCRM pull for a day, or CiviCRM not answering, a broadcast waits, and
// staff are told once; it goes by itself when it can, unless it's still
// waiting WAIT_DAYS (lib/broadcasts.ts) after its time, when it stops, and whoever scheduled it
// is told who it didn't reach. A text goes by the fake backend a fixture
// build has, and nothing on the live site.

/** Who the audit log says started and finished a broadcast. */
const JOB = "send-mailings";

/** How old the latest complete CiviCRM pull can be, for a broadcast to go. */
const FRESH_HOURS = 24;

/** Why a broadcast is waiting: CiviCRM didn't answer its check, or no pull has completed for a day. */
export type WaitReason = "civicrm" | "pull";

type Due = {
  id: number;
  state: "scheduled" | "sending";
  channel: BroadcastChannel;
  topic: Topic;
  alsoEvents: boolean;
  filter: StoredFilter;
  dueAt: Date;
  title: string;
  waitingSince: Date | null;
};

const DUE_COLUMNS = `id::int AS id, state, channel, topic, also_events AS "alsoEvents", filter, due_at AS "dueAt",
  coalesce(nullif(subject, ''), title) AS title, waiting_since AS "waitingSince"`;

/** Whether a complete CiviCRM pull has finished in the last FRESH_HOURS. */
async function pullFresh(): Promise<boolean> {
  const [row] = await query(
    `SELECT 1 FROM import_runs WHERE job = 'import-civicrm' AND status IN ('ok', 'unchanged')
       AND at > now() - make_interval(hours => $1) LIMIT 1`,
    [FRESH_HOURS],
  );
  return Boolean(row);
}

/** Who scheduled a broadcast, as the audit log says, to tell them of it. */
async function scheduler(id: number): Promise<string | undefined> {
  const [row] = await query<{ actor: string }>(
    `SELECT actor FROM audit_log WHERE action = 'schedule broadcast' AND (details->>'id')::bigint = $1
     ORDER BY id DESC LIMIT 1`,
    [id],
  );
  return row?.actor;
}

/**
 * Stops a broadcast that waited too long: its copies still to go are
 * cancelled, and whoever scheduled it is told how many it didn't reach,
 * which for one that never started is everyone it would go to now.
 */
async function giveUp(broadcast: Due, reason: WaitReason): Promise<void> {
  const cancelled = await query(
    "UPDATE broadcast_messages SET status = 'cancelled' WHERE mailing_id = $1 AND status = 'scheduled' RETURNING id",
    [broadcast.id],
  );
  const notReached =
    broadcast.state === "scheduled"
      ? (await supporterAudience(broadcast.filter, termsOf(broadcast))).recipients.length
      : cancelled.length;
  await query(
    `UPDATE mailings SET state = 'cancelled', gave_up = true, wait_reason = $2,
       waiting_since = coalesce(waiting_since, now()), updated_at = now() WHERE id = $1`,
    [broadcast.id, reason],
  );
  await logChange(JOB, "stop broadcast", { id: broadcast.id, was: broadcast.state });
  const email = staffCopy.notifications.broadcastGaveUp;
  await notifyStaff(
    email.subject(broadcast.title),
    email.body(broadcast.title, notReached, staffLink(`/staff/broadcasts/${broadcast.id}`, undefined)),
    null,
    "staff-alert",
    await scheduler(broadcast.id),
  );
}

/**
 * Has a broadcast wait for `reason`, from now if it wasn't, telling staff
 * once; or stops it, if it's been WAIT_DAYS past its time.
 */
async function wait(broadcast: Due, reason: WaitReason): Promise<void> {
  if (now() >= stopsAt(broadcast.dueAt)) return giveUp(broadcast, reason);
  await query("UPDATE mailings SET waiting_since = coalesce(waiting_since, now()), wait_reason = $2 WHERE id = $1", [
    broadcast.id,
    reason,
  ]);
  if (broadcast.waitingSince) return;
  const email = staffCopy.notifications.broadcastWaiting;
  await notifyStaff(
    email.subject(broadcast.title),
    email.body(
      broadcast.title,
      reason,
      staffTime(stopsAt(broadcast.dueAt)),
      staffLink(`/staff/broadcasts/${broadcast.id}`, undefined),
    ),
    null,
    "staff-alert",
    await scheduler(broadcast.id),
  );
}

/** A broadcast's terms, as its row keeps them. */
const termsOf = (broadcast: Pick<Due, "channel" | "topic" | "alsoEvents">): BroadcastTerms => ({
  channel: broadcast.channel,
  topic: broadcast.topic,
  alsoEvents: broadcast.alsoEvents,
});

/**
 * Starts a broadcast that's due: a copy for each it goes to now, once to
 * each address, each with its Message-ID and the topics whose yes it goes
 * under. Its unsubscribe link's token is made as it goes (sendEmailBatch).
 */
async function start(broadcast: Due): Promise<void> {
  const { recipients } = await supporterAudience(broadcast.filter, termsOf(broadcast));
  for (const recipient of recipients) {
    await query(
      `INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status, merge_values, rfc_message_id, topics)
       VALUES ($1, $2, $3, 'scheduled', $4, $5, $6) ON CONFLICT DO NOTHING`,
      [
        broadcast.id,
        recipient.id,
        recipient.address,
        JSON.stringify({ name: recipient.name, values: recipient.values, meets: recipient.meets }),
        newMessageId(),
        recipient.topics,
      ],
    );
  }
  await query(
    "UPDATE mailings SET state = 'sending', waiting_since = NULL, wait_reason = NULL, updated_at = now() WHERE id = $1",
    [broadcast.id],
  );
  await logChange(JOB, "start mailing", { id: broadcast.id });
}

/**
 * Starts every broadcast that's due, but none overnight, as mailings to
 * politicians: an email only once a CiviCRM pull has completed in the last
 * day, or it waits. Returns those it started.
 */
export async function startDueBroadcasts(): Promise<number[]> {
  if (now().getUTCHours() < SENDING.firstHour) return [];
  const due = await query<Due>(
    `SELECT ${DUE_COLUMNS} FROM mailings
     WHERE audience = 'supporters' AND state = 'scheduled' AND due_at <= $1 ORDER BY due_at, id`,
    [now()],
  );
  const started: number[] = [];
  const fresh = await pullFresh();
  for (const broadcast of due) {
    if (broadcast.channel === "email" && !fresh) {
      await wait(broadcast, "pull");
      continue;
    }
    await start(broadcast);
    started.push(broadcast.id);
  }
  return started;
}

/** A copy still to go, as kept. */
type Copy = {
  id: number;
  address: string;
  rfcMessageId: string;
  topics: Topic[];
  mergeValues: MailingRecipientValues & { name: string };
};

/** Each copy's answer now: whether any of its topics says yes, and if none, why. */
async function answers(copies: Copy[]): Promise<Map<number, "yes" | "blocked" | "unsubscribed" | "no-permission">> {
  const rows = await query<{ id: number; yes: boolean; blocked: boolean; unsubscribed: boolean }>(
    `SELECT c.id::int AS id, bool_or(d.send = 'yes') AS yes, bool_or(d.reason = 'blocked') AS blocked,
       bool_or(d.reason = 'unsubscribed') AS unsubscribed
     FROM broadcast_messages c CROSS JOIN LATERAL unnest(c.topics) t (topic)
       JOIN mailings m ON m.id = c.mailing_id
       CROSS JOIN LATERAL contact_permission(t.topic, CASE WHEN m.channel = 'email' THEN 'email' ELSE 'text' END, c.address) d
     WHERE c.id = ANY($1::bigint[]) GROUP BY c.id`,
    [copies.map((copy) => copy.id)],
  );
  const said = new Map(rows.map((row) => [row.id, row]));
  return new Map(
    copies.map((copy) => {
      const row = said.get(copy.id);
      if (row?.yes) return [copy.id, "yes"];
      if (row?.blocked) return [copy.id, "blocked"];
      return [copy.id, row?.unsubscribed ? "unsubscribed" : "no-permission"];
    }),
  );
}

async function skip(id: number, reason: "blocked" | "unsubscribed" | "no-permission" | "suppressed"): Promise<void> {
  await query(
    "UPDATE broadcast_messages SET status = 'skipped', skip_reason = $2, sending_since = NULL WHERE id = $1",
    [id, reason],
  );
}

/** CiviCRM's block on each address, SUPPRESSION_BATCH a call; throws if it doesn't answer. */
async function suppressions(addresses: string[]): Promise<Map<string, Block>> {
  const key = civicrmKey();
  const blocks = new Map<string, Block>();
  for (let i = 0; i < addresses.length; i += SUPPRESSION_BATCH) {
    for (const [address, block] of await checkSuppression(key, addresses.slice(i, i + SUPPRESSION_BATCH))) {
      blocks.set(address, block);
    }
  }
  return blocks;
}

/** A copy's email, as its person gets it: the broadcast's words for them, its unsubscribe link at its foot and in its headers. */
function copyEmail(
  broadcast: { subject: string; body: unknown; sentFrom: string; fromName: string },
  copy: Copy & { linkToken: string },
): BroadcastCopyEmail {
  const { html, text } = emailFor(
    { subject: broadcast.subject, body: checkMailingDoc(broadcast.body)! },
    copy.mergeValues,
  );
  const settings = siteUrl(`/email-settings/m/${copy.linkToken}`, undefined).toString();
  const oneClick = siteUrl(`/api/unsubscribe/${copy.linkToken}`, undefined).toString();
  const footer = emailSettingsCopy.footer;
  return {
    copyId: copy.id,
    rfcMessageId: copy.rfcMessageId,
    email: {
      From: nameLine(broadcast.fromName, broadcast.sentFrom),
      To: nameLine(copy.mergeValues.name, copy.address),
      Subject: broadcast.subject,
      TextBody: `${text}\n\n--\n${footer.text(settings)}`,
      HtmlBody: `${html}<hr><p style="font-size:13px;color:#666">${footer.html(settings)}</p>`,
      TrackLinks: "None",
      Tag: "broadcast",
      Headers: [
        { Name: "Message-ID", Value: `<${copy.rfcMessageId}>` },
        { Name: "List-Unsubscribe", Value: `<${oneClick}>` },
        { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
      ],
    },
  };
}

/** What a run of sending broadcasts did, and how many copies of those sending are left to go. */
export type BroadcastRun = { sent: number; skipped: number; failed: number; waiting: number; left: number };

type Sending = Due & { subject: string; body: unknown; sentFrom: string; fromName: string };

/**
 * Takes the next copies of a broadcast still to go, a batch's worth, as
 * `sending`, so no other run takes them, and none goes twice should this
 * run stop before Postmark's answer is kept.
 */
async function nextCopies(id: number): Promise<Copy[]> {
  return query<Copy>(
    `WITH next AS (
       SELECT id FROM broadcast_messages WHERE mailing_id = $1 AND status = 'scheduled' AND address IS NOT NULL
       ORDER BY id LIMIT $2 FOR UPDATE SKIP LOCKED)
     UPDATE broadcast_messages c SET status = 'sending', sending_since = now() FROM next WHERE c.id = next.id
     RETURNING c.id::int AS id, c.address, c.rfc_message_id AS "rfcMessageId", c.topics, c.merge_values AS "mergeValues"`,
    [id, BATCH_SIZE],
  ).then((copies) => copies.sort((a, b) => a.id - b.id));
}

/** Puts copies taken for a batch that waits back to go later. */
async function putBack(copies: Copy[]): Promise<void> {
  await query("UPDATE broadcast_messages SET status = 'scheduled', sending_since = NULL WHERE id = ANY($1::bigint[])", [
    copies.map((copy) => copy.id),
  ]);
}

/** A copy failed, with an event saying so. */
async function fail(id: number): Promise<void> {
  await query(
    `WITH copy AS (UPDATE broadcast_messages SET status = 'failed', sending_since = NULL WHERE id = $1 RETURNING id)
     INSERT INTO broadcast_message_events (message_id, kind) SELECT id, 'failed' FROM copy`,
    [id],
  );
}

/** How long a copy can be `sending` before the run that took it must have stopped: longer than any run. */
const STOPPED_MINUTES = 30;

/**
 * The copies a run took and stopped before keeping Postmark's answer for:
 * failed, as they may have gone, and sending them again could send twice.
 */
async function failLeftSending(run: BroadcastRun): Promise<void> {
  const left = await query<{ id: number }>(
    `SELECT id::int AS id FROM broadcast_messages
     WHERE status = 'sending' AND sending_since < now() - make_interval(mins => $1) ORDER BY id`,
    [STOPPED_MINUTES],
  );
  for (const { id } of left) await fail(id);
  run.failed += left.length;
}

/** Keeps what became of each copy sent. */
async function keepSent(results: BroadcastCopyResult[], run: BroadcastRun): Promise<void> {
  for (const result of results) {
    if (result.sent) {
      await query(
        `WITH copy AS (UPDATE broadcast_messages SET status = 'sent', provider_message_id = $2, sent_at = now(),
                         sending_since = NULL
                       WHERE id = $1 RETURNING id)
         INSERT INTO broadcast_message_events (message_id, kind) SELECT id, 'sent' FROM copy`,
        [result.copyId, result.id],
      );
      run.sent++;
    } else if (result.reason === "blocked") {
      await skip(result.copyId, "blocked");
      run.skipped++;
    } else {
      await fail(result.copyId);
      run.failed++;
    }
  }
}

/** Gives each copy about to go its unsubscribe link's token, keeping only the token's hash. */
async function withTokens(copies: Copy[]): Promise<(Copy & { linkToken: string })[]> {
  const tokened = copies.map((copy) => ({ ...copy, linkToken: randomBytes(18).toString("base64url") }));
  await query(
    `UPDATE broadcast_messages c SET link_token_hash = t.hash
     FROM unnest($1::bigint[], $2::text[]) t (id, hash) WHERE c.id = t.id`,
    [tokened.map((copy) => copy.id), tokened.map((copy) => hashOf(copy.linkToken))],
  );
  return tokened;
}

/**
 * Sends one batch of an email broadcast's copies: those whose answer is no
 * now are skipped with why; CiviCRM's check drops anyone blocked, keeping it
 * as an opt-out of ours; the rest go. Returns false when the broadcast
 * waits, as CiviCRM didn't answer, and true otherwise.
 */
async function sendEmailBatch(broadcast: Sending, copies: Copy[], run: BroadcastRun): Promise<boolean> {
  const said = await answers(copies);
  const going: Copy[] = [];
  for (const copy of copies) {
    const answer = said.get(copy.id)!;
    if (answer === "yes") going.push(copy);
    else {
      await skip(copy.id, answer);
      run.skipped++;
    }
  }
  if (going.length === 0) return true;
  let blocks: Map<string, Block>;
  try {
    blocks = await suppressions(going.map((copy) => copy.address));
  } catch (error) {
    // Nothing is sent unchecked.
    problem(staffCopy.problems.job.civicrmCheckFailed, error);
    await putBack(going);
    await wait(broadcast, "civicrm");
    return false;
  }
  const lifting = await liftsOnTheirWay(going.map((copy) => copy.address));
  const checked: Copy[] = [];
  for (const copy of going) {
    const block = blocks.get(copy.address)!;
    if (block === "none") {
      checked.push(copy);
      continue;
    }
    // CiviCRM hasn't had the person's lift of "No bulk emails" yet: this copy can't go, but their choice stands.
    if (block === "all" || !lifting.has(copy.address)) {
      await recordOptOut({
        address: copy.address,
        list: block === "all" ? "all" : "bulk",
        source: "civicrm-check",
        sourceRef: `check ${copy.id}`,
        unsubscribedAt: now(),
        messageId: copy.id,
      });
    }
    await skip(copy.id, "suppressed");
    run.skipped++;
  }
  if (broadcast.waitingSince) {
    await query("UPDATE mailings SET waiting_since = NULL, wait_reason = NULL WHERE id = $1", [broadcast.id]);
    broadcast.waitingSince = null;
  }
  if (checked.length) {
    const emails = (await withTokens(checked)).map((copy) => copyEmail(broadcast, copy));
    await keepSent(await sendBroadcastCopies(emails), run);
  }
  return true;
}

/** Those of `addresses` whose lift of "No bulk emails" waits to go to CiviCRM. */
async function liftsOnTheirWay(addresses: string[]): Promise<Set<string>> {
  const rows = await query<{ email: string }>(
    `SELECT DISTINCT email FROM civicrm_updates
     WHERE change = 'allow_bulk_email' AND status IS NULL AND email = ANY($1::text[])`,
    [addresses],
  );
  return new Set(rows.map((row) => row.email));
}

/** Sends a text broadcast's copies by the backend a fixture build has; none on the live site, where texts can't be scheduled. */
async function sendTextBatch(broadcast: Sending, copies: Copy[], run: BroadcastRun): Promise<boolean> {
  const backend = broadcastBackend();
  if (!backend) {
    await putBack(copies);
    return false;
  }
  const body = checkMailingDoc(broadcast.body)!;
  for (const copy of copies) {
    const { text } = emailFor({ subject: "", body }, copy.mergeValues);
    const result = await backend.send({ channel: "text", to: copy.address, subject: broadcast.title, text });
    await keepSent([{ copyId: copy.id, ...result }], run);
  }
  return true;
}

/** Marks every broadcast sending with no copy left to go as sent. */
async function finishBroadcasts(): Promise<void> {
  const finished = await query<{ id: number }>(
    `UPDATE mailings m SET state = 'sent', updated_at = now()
     WHERE m.state = 'sending' AND m.audience = 'supporters'
       AND NOT EXISTS (SELECT 1 FROM broadcast_messages c WHERE c.mailing_id = m.id AND c.status IN ('scheduled', 'sending'))
     RETURNING m.id::int AS id`,
  );
  for (const { id } of finished) await logChange(JOB, "finish mailing", { id });
}

/**
 * Sends the copies of every broadcast that's sending, oldest due first, a
 * batch at a time, until there are none or it's `until` (a time in ms). A
 * broadcast that waits for CiviCRM sends no more this run. First, copies an
 * earlier run took and never finished are failed (failLeftSending).
 */
export async function sendDueBroadcasts(until: number): Promise<BroadcastRun> {
  const run: BroadcastRun = { sent: 0, skipped: 0, failed: 0, waiting: 0, left: 0 };
  await failLeftSending(run);
  const sending = await query<Sending>(
    `SELECT ${DUE_COLUMNS}, subject, body, sent_from AS "sentFrom", from_name AS "fromName"
     FROM mailings WHERE audience = 'supporters' AND state = 'sending' ORDER BY due_at, id`,
  );
  for (const broadcast of sending) {
    while (Date.now() < until) {
      const copies = await nextCopies(broadcast.id);
      if (copies.length === 0) break;
      const went = await (broadcast.channel === "email" ? sendEmailBatch : sendTextBatch)(broadcast, copies, run);
      if (!went) {
        run.waiting++;
        break;
      }
    }
  }
  await finishBroadcasts();
  const [{ left }] = await query<{ left: number }>(
    `SELECT count(*)::int AS left FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id
     WHERE m.state = 'sending' AND m.audience = 'supporters' AND c.status = 'scheduled' AND c.address IS NOT NULL`,
  );
  run.left = left;
  return run;
}
