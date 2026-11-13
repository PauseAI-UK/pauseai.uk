import "server-only";
import { randomBytes } from "node:crypto";
import {
  sendingStopsAt,
  waitStopsAt,
  type BroadcastChannel,
  type BroadcastSendBy,
  type BroadcastTerms,
} from "@/lib/broadcasts";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { staffCopy } from "@/lib/content/staff-interface";
import type { Topic } from "@/lib/contact-permissions";
import { checkMailingDoc, type MailingRecipientValues } from "@/lib/mailing-doc";
import { now } from "@/lib/now";
import type { StoredFilter } from "@/lib/staff-search";
import { SENDING, staffTime } from "@/lib/staff-time";
import { siteUrl } from "@/lib/site-url";
import { logChange } from "./audit";
import { TOPICS_OF } from "./broadcast-drafts";
import { broadcastBackend, broadcastEmailChannel } from "./broadcast-channels";
import { supporterAudience } from "./broadcast-recipients";
import { query } from "./db";
import { hashOf } from "./email-settings";
import { gmailAccount } from "./gmail-accounts";
import { paced, type ChannelMessage, type ChannelResult } from "./mailing-channels";
import { attachmentsOf, emailFor } from "./mailing-drafts";
import { newMessageId } from "./mime";
import { notifyStaff, staffLink } from "./notifications";
import { recordOptOut } from "./opt-outs";
import { checkSuppression, civicrmKey, SUPPRESSION_BATCH, type Block } from "./outside-services/civicrm";
import type { Attachment } from "./outside-services/postmark";
import { problem } from "./problems";

// Sending broadcasts to supporters, in the send-mailings run every 15 minutes, as
// mailings to politicians go. A broadcast that's due starts: who it goes to
// is found then (supporterAudience), a copy each, once to each address,
// each with its own unsubscribe link. Its copies go in batches, each checked
// just before: anyone who has opted out since is skipped, and every address
// is checked with CiviCRM's checkSuppression, which drops anyone PauseAI
// mustn't bulk email and keeps that as an opt-out of ours. An email goes by
// the channel its broadcast says (broadcast-channels.ts), one copy at a
// time at the channel's pace: hello@'s Gmail, which sends up to a day's
// limit and carries on the next day, or Postmark's broadcast stream.
// Nothing goes unchecked: with no complete CiviCRM pull for a day, or
// CiviCRM not answering, a broadcast waits, and staff are told once; it
// goes by itself when it can. One that has waited WAIT_DAYS, or is still
// sending SENDING_DAYS after its time (lib/broadcast-days.ts), stops, and
// whoever scheduled it is told who it didn't reach. A text goes by the fake backend
// a fixture build has, and nothing on the live site.

/** Who the audit log says started and finished a broadcast. */
const JOB = "send-mailings";

/** How old the latest complete CiviCRM pull can be, for a broadcast to go. */
const FRESH_HOURS = 24;

/** Why a broadcast is waiting: CiviCRM didn't answer its check, or no pull has completed for a day. */
export type WaitReason = "civicrm" | "pull";

/** Why a broadcast stopped before it had all gone: it waited too long, or a day's limit of emails left it too slow. */
export type StopReason = WaitReason | "limit";

type Due = {
  id: number;
  state: "scheduled" | "sending";
  channel: BroadcastChannel;
  sendBy: BroadcastSendBy;
  topics: Topic[];
  filter: StoredFilter;
  dueAt: Date;
  title: string;
  waitingSince: Date | null;
};

const DUE_COLUMNS = `id::int AS id, state, channel, send_by AS "sendBy", ${TOPICS_OF} AS topics, filter, due_at AS "dueAt",
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
 * Stops a broadcast that hasn't all gone in time: its copies still to go
 * are cancelled, and whoever scheduled it is told why and how many it
 * didn't reach, which for one that never started is everyone it would go to
 * now.
 */
async function giveUp(broadcast: Due, reason: StopReason): Promise<void> {
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
       waiting_since = coalesce(waiting_since, $3), updated_at = now() WHERE id = $1`,
    [broadcast.id, reason, now()],
  );
  await logChange(JOB, "stop broadcast", { id: broadcast.id, was: broadcast.state });
  const email = staffCopy.notifications.broadcastGaveUp;
  await notifyStaff(
    email.subject(broadcast.title, reason),
    email.body(broadcast.title, reason, notReached, staffLink(`/staff/broadcasts/${broadcast.id}`, undefined)),
    null,
    "staff-alert",
    await scheduler(broadcast.id),
  );
}

/**
 * Has a broadcast wait for `reason`, from now if it wasn't, telling staff
 * once; or stops it, if it has waited WAIT_DAYS. Those run from when it
 * began to wait, by the site's clock, not from its time: one that's days
 * into sending when CiviCRM first fails has them all.
 */
async function wait(broadcast: Due, reason: WaitReason): Promise<void> {
  if (broadcast.waitingSince && now() >= waitStopsAt(broadcast.waitingSince)) return giveUp(broadcast, reason);
  const began = now();
  await query("UPDATE mailings SET waiting_since = coalesce(waiting_since, $3), wait_reason = $2 WHERE id = $1", [
    broadcast.id,
    reason,
    began,
  ]);
  if (broadcast.waitingSince) return;
  const email = staffCopy.notifications.broadcastWaiting;
  await notifyStaff(
    email.subject(broadcast.title),
    email.body(
      broadcast.title,
      reason,
      staffTime(waitStopsAt(began)),
      staffLink(`/staff/broadcasts/${broadcast.id}`, undefined),
    ),
    null,
    "staff-alert",
    await scheduler(broadcast.id),
  );
}

/** A broadcast's terms, as its row keeps them. */
const termsOf = (broadcast: Pick<Due, "channel" | "topics">): BroadcastTerms => ({
  channel: broadcast.channel,
  topics: broadcast.topics,
});

/**
 * Starts a broadcast that's due: a copy for each it goes to now, once to
 * each address, each with its Message-ID and the topics whose yes it goes
 * under. All in one statement, as a broadcast can go to thousands and a
 * run has seconds. Its unsubscribe link's token is made as it goes
 * (newToken).
 */
async function start(broadcast: Due): Promise<void> {
  const { recipients } = await supporterAudience(broadcast.filter, termsOf(broadcast));
  const rows = recipients.map((recipient) => ({
    supporter_id: recipient.id,
    address: recipient.address,
    merge_values: { name: recipient.name, values: recipient.values, meets: recipient.meets },
    rfc_message_id: newMessageId(),
    topics: recipient.topics,
  }));
  await query(
    `INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status, merge_values, rfc_message_id, topics)
     SELECT $1, r.supporter_id, r.address, 'scheduled', r.merge_values, r.rfc_message_id,
       ARRAY(SELECT jsonb_array_elements_text(r.topics))
     FROM jsonb_to_recordset($2::jsonb)
       AS r(supporter_id bigint, address text, merge_values jsonb, rfc_message_id text, topics jsonb)
     ON CONFLICT DO NOTHING`,
    [broadcast.id, JSON.stringify(rows)],
  );
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
  /** Their name with them, none for someone who has none. */
  mergeValues: MailingRecipientValues & { name: string | null };
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

/** CiviCRM's block on each address it answers for, SUPPRESSION_BATCH a call; throws if it doesn't answer. */
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

/**
 * A copy's message, as its person gets it: the broadcast's words for them
 * and its files, its unsubscribe link at its foot and in its headers.
 */
function copyMessage(broadcast: Sending, copy: Copy, linkToken: string, attachments: Attachment[]): ChannelMessage {
  const { html, text } = emailFor(
    { subject: broadcast.subject, body: checkMailingDoc(broadcast.body)! },
    copy.mergeValues,
  );
  const settings = siteUrl(`/contact-preferences/m/${linkToken}`, undefined).toString();
  const oneClick = siteUrl(`/api/unsubscribe/${linkToken}`, undefined).toString();
  const footer = emailSettingsCopy.footer;
  return {
    from: { name: broadcast.fromName, address: broadcast.sentFrom },
    to: { name: copy.mergeValues.name, address: copy.address },
    subject: broadcast.subject,
    text: `${text}\n\n--\n${footer.text(settings)}`,
    html: `${html}<hr><p style="font-size:13px;color:#666">${footer.html(settings)}</p>`,
    attachments,
    copyId: copy.id,
    messageId: copy.rfcMessageId,
    headers: [
      { Name: "List-Unsubscribe", Value: `<${oneClick}>` },
      { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
    ],
  };
}

/** What a run of sending broadcasts did, and how many copies of those sending are left to go. */
export type BroadcastRun = { sent: number; skipped: number; failed: number; waiting: number; left: number };

type Sending = Due & { subject: string; body: unknown; sentFrom: string; fromName: string };

/**
 * The most copies of a broadcast taken at once, to be checked with CiviCRM
 * together: few, as those a run doesn't get to are put back.
 */
const TAKE = 20;

/**
 * Takes the next copies of a broadcast still to go, up to `limit`, as
 * `sending`, so no other run takes them, and none goes twice should this
 * run stop before its channel's answer is kept.
 */
async function nextCopies(id: number, limit: number): Promise<Copy[]> {
  return query<Copy>(
    `WITH next AS (
       SELECT id FROM broadcast_messages WHERE mailing_id = $1 AND status = 'scheduled' AND address IS NOT NULL
       ORDER BY id LIMIT $2 FOR UPDATE SKIP LOCKED)
     UPDATE broadcast_messages c SET status = 'sending', sending_since = now() FROM next WHERE c.id = next.id
     RETURNING c.id::int AS id, c.address, c.rfc_message_id AS "rfcMessageId", c.topics, c.merge_values AS "mergeValues"`,
    [id, limit],
  ).then((copies) => copies.sort((a, b) => a.id - b.id));
}

/**
 * Puts copies taken and not sent back to go later: those still sending, not
 * one skipped or kept meanwhile. None went, so the link token one was given
 * to go with is dropped, and it gets another when it does go: a copy that's
 * `sending` with a token is one handed to its channel (failLeftSending).
 */
async function putBack(copies: Copy[]): Promise<void> {
  await query(
    `UPDATE broadcast_messages SET status = 'scheduled', sending_since = NULL, link_token_hash = NULL
     WHERE id = ANY($1::bigint[]) AND status = 'sending'`,
    [copies.map((copy) => copy.id)],
  );
}

/**
 * Sends a batch of copies a run has taken, by `send`, which marks each that
 * went (`went`) and says whether to go on with the broadcast. Anything it
 * throws, which is only before a copy reaches its channel (send in
 * email.ts never throws after), puts back every copy of the batch that
 * didn't go, to go next run, and is reported: they never went, so they're
 * tried again, never failed.
 */
async function withCare(taken: Copy[], send: (went: (id: number) => void) => Promise<boolean>): Promise<boolean> {
  const went = new Set<number>();
  try {
    return await send((id) => went.add(id));
  } catch (error) {
    const left = taken.filter((copy) => !went.has(copy.id));
    await putBack(left);
    const words = staffCopy.problems.anywhere;
    // Named by the batch's first, which is always there.
    problem(words.notSentYet(words.copyOf(taken[0].id)), error);
    return false;
  }
}

/**
 * Keeps what became of a copy (keepSent), marking one that went (`went`).
 * Keeping one that went, if that fails, is reported, and the copy left
 * sending (failLeftSending), as it went and mustn't go twice; for one that
 * didn't, it's thrown, for withCare to put it back.
 */
async function keep(
  copyId: number,
  result: ChannelResult,
  run: BroadcastRun,
  went: (id: number) => void,
): Promise<void> {
  if (result.sent) went(copyId);
  try {
    await keepSent(copyId, result, run);
  } catch (error) {
    if (!result.sent) throw error;
    const words = staffCopy.problems.anywhere;
    problem(words.sentUnrecorded(words.copyOf(copyId)), error);
  }
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
 * Deals with the copies a run took and stopped before finishing with. One
 * it had handed to its channel, which an email has its link token for
 * (newToken), may have gone, so it's failed: sending it again could send
 * twice. An email the run had only taken has no token and never went, so
 * it's put back to go, or cancelled if its broadcast has stopped since. A
 * text has no token, so every one left is failed.
 */
async function failLeftSending(run: BroadcastRun): Promise<void> {
  const stopped = "c.status = 'sending' AND c.sending_since < now() - make_interval(mins => $1)";
  await query(
    `UPDATE broadcast_messages c
     SET status = CASE WHEN m.state = 'sending' THEN 'scheduled' ELSE 'cancelled' END, sending_since = NULL
     FROM mailings m
     WHERE m.id = c.mailing_id AND m.channel = 'email' AND c.link_token_hash IS NULL AND ${stopped}`,
    [STOPPED_MINUTES],
  );
  const left = await query<{ id: number }>(
    `SELECT c.id::int AS id FROM broadcast_messages c WHERE ${stopped} ORDER BY c.id`,
    [STOPPED_MINUTES],
  );
  for (const { id } of left) await fail(id);
  run.failed += left.length;
}

/**
 * Keeps what became of a copy sent: its channel's ID for it, and the
 * Message-ID it went with, where the channel gave it another.
 */
async function keepSent(copyId: number, result: ChannelResult, run: BroadcastRun): Promise<void> {
  if (result.sent) {
    await query(
      `WITH copy AS (UPDATE broadcast_messages SET status = 'sent', provider_message_id = $2, sent_at = now(),
                       sending_since = NULL, rfc_message_id = coalesce($3, rfc_message_id)
                     WHERE id = $1 RETURNING id)
       INSERT INTO broadcast_message_events (message_id, kind) SELECT id, 'sent' FROM copy`,
      [copyId, result.id, result.messageId ?? null],
    );
    run.sent++;
  } else if (result.reason === "blocked") {
    await skip(copyId, "blocked");
    run.skipped++;
  } else {
    await fail(copyId);
    run.failed++;
  }
}

/** Gives a copy about to go its unsubscribe link's token, keeping only the token's hash. */
async function newToken(copy: Copy): Promise<string> {
  const token = randomBytes(18).toString("base64url");
  await query("UPDATE broadcast_messages SET link_token_hash = $2 WHERE id = $1", [copy.id, hashOf(token)]);
  return token;
}

/**
 * Checks copies of an email broadcast just before they go: those whose
 * answer is no now are skipped with why; CiviCRM's check drops anyone
 * blocked, keeping it as an opt-out of ours. One whose address CiviCRM's
 * answer leaves out can't go unchecked, and asking again would hold up
 * everyone after it, so it's failed alone, and reported. Returns those
 * that can go; or undefined when the broadcast waits, as CiviCRM didn't
 * answer, with its copies put back.
 */
async function checkCopies(broadcast: Sending, copies: Copy[], run: BroadcastRun): Promise<Copy[] | undefined> {
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
  if (going.length === 0) return [];
  let blocks: Map<string, Block>;
  try {
    blocks = await suppressions(going.map((copy) => copy.address));
  } catch (error) {
    // Nothing is sent unchecked.
    problem(staffCopy.problems.job.civicrmCheckFailed, error);
    await putBack(going);
    await wait(broadcast, "civicrm");
    return undefined;
  }
  const lifting = await liftsOnTheirWay(going.map((copy) => copy.address));
  const checked: Copy[] = [];
  for (const copy of going) {
    const block = blocks.get(copy.address);
    if (!block) {
      problem(
        staffCopy.problems.anywhere.sendFailed("broadcast"),
        new Error(`CiviCRM didn't say whether the address of broadcast copy ${copy.id} is blocked`),
      );
      await fail(copy.id);
      run.failed++;
      continue;
    }
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
  return checked;
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

/**
 * Sends an email broadcast's copies by its channel, one at a time, `gap` ms
 * apart, until there are none, it's `until`, or the channel can send no
 * more today, when the rest wait for a later run: a few taken at a time,
 * checked, and each sent or put back. By Gmail, none while the account it's
 * from isn't connected, and none more this run once Gmail answers that it
 * can't send for now (`retry`), which fails none, or once a copy fails,
 * which fails that one alone: the rest wait for the next run, as whatever
 * failed it may fail them too. Counts the broadcast as waiting when
 * CiviCRM didn't answer.
 */
async function sendEmails(broadcast: Sending, run: BroadcastRun, until: number, gapOverride?: number): Promise<void> {
  const { channel, gapMs } = broadcastEmailChannel(broadcast.sendBy);
  const gap = gapOverride ?? gapMs;
  const pacedChannel = paced(channel, gap);
  const attachments = await attachmentsOf(broadcast.id);
  while (Date.now() + gap < until) {
    if (broadcast.sendBy === "gmail" && !(await gmailAccount(broadcast.sentFrom))) return;
    const remaining = (await channel.remainingToday(broadcast.sentFrom)) ?? TAKE;
    // No more than there's time to send at the channel's pace, nor than it can send today.
    const room = gap ? Math.max(1, Math.floor((until - Date.now()) / gap)) : TAKE;
    const copies = await nextCopies(broadcast.id, Math.min(TAKE, room, remaining));
    if (copies.length === 0) return;
    const going = await withCare(copies, async (went) => {
      const checked = await checkCopies(broadcast, copies, run);
      if (!checked) {
        run.waiting++;
        return false;
      }
      for (const [i, copy] of checked.entries()) {
        if (Date.now() + gap >= until) {
          await putBack(checked.slice(i));
          return false;
        }
        const message = copyMessage(broadcast, copy, await newToken(copy), attachments);
        const result = await pacedChannel.send(message, "broadcast");
        if (!result.sent && result.retry) {
          // Gmail can't send for now: this copy and the rest wait for the next run, rather than fail.
          await putBack(checked.slice(i));
          return false;
        }
        await keep(copy.id, result, run, went);
        if (!result.sent && result.reason === "failed") {
          // Whatever failed this one may fail the next: the rest wait for the next run, so nothing fails everyone.
          await putBack(checked.slice(i + 1));
          return false;
        }
      }
      return true;
    });
    if (!going) return;
  }
}

/**
 * Sends a text broadcast's copies by the backend a fixture build has; on the
 * live site, where texts can't be scheduled, none, and it counts as waiting.
 */
async function sendTexts(broadcast: Sending, run: BroadcastRun, until: number): Promise<void> {
  const backend = broadcastBackend();
  if (!backend) {
    run.waiting++;
    return;
  }
  const body = checkMailingDoc(broadcast.body)!;
  while (Date.now() < until) {
    const copies = await nextCopies(broadcast.id, TAKE);
    if (copies.length === 0) return;
    const going = await withCare(copies, async (went) => {
      for (const copy of copies) {
        const { text } = emailFor({ subject: "", body }, copy.mergeValues);
        const result = await backend.send({ channel: "text", to: copy.address, subject: broadcast.title, text });
        await keep(copy.id, result, run, went);
      }
      return true;
    });
    if (!going) return;
  }
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
 * Sends the copies of every broadcast that's sending, oldest due first,
 * until there are none or it's `until` (a time in ms); `gap` is the ms
 * between two emails, in place of their channel's own. An email broadcast
 * that hasn't all gone by when it stops (sendingStopsAt) is stopped, unless it's
 * waiting for CiviCRM, when that stops it. First, copies an earlier run
 * took and never finished are failed, or put back if they never reached
 * their channel (failLeftSending).
 */
export async function sendDueBroadcasts(until: number, gap?: number): Promise<BroadcastRun> {
  const run: BroadcastRun = { sent: 0, skipped: 0, failed: 0, waiting: 0, left: 0 };
  await failLeftSending(run);
  const sending = await query<Sending>(
    `SELECT ${DUE_COLUMNS}, subject, body, sent_from AS "sentFrom", from_name AS "fromName"
     FROM mailings WHERE audience = 'supporters' AND state = 'sending' ORDER BY due_at, id`,
  );
  for (const broadcast of sending) {
    if (broadcast.channel !== "email") await sendTexts(broadcast, run, until);
    else if (!broadcast.waitingSince && now() >= sendingStopsAt(broadcast.dueAt)) await giveUp(broadcast, "limit");
    else await sendEmails(broadcast, run, until, gap);
  }
  await finishBroadcasts();
  const [{ left }] = await query<{ left: number }>(
    `SELECT count(*)::int AS left FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id
     WHERE m.state = 'sending' AND m.audience = 'supporters' AND c.status = 'scheduled' AND c.address IS NOT NULL`,
  );
  run.left = left;
  return run;
}
