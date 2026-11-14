import "server-only";
import { randomBytes } from "node:crypto";
import { FAILURES_TO_STOP } from "./days";
import {
  REST_MINUTES,
  sendingStopsAt,
  waitEndsAt,
  waitStopsAt,
  type BroadcastChannel,
  type BroadcastSendBy,
  type BroadcastTerms,
} from "./broadcasts";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { staffCopy } from "@/lib/content/staff-interface";
import type { Topic } from "@/lib/supporters/contact-permissions";
import { checkMailingDoc, type MailingRecipientValues } from "@/lib/mailings/doc";
import { now } from "@/lib/now";
import type { StoredFilter } from "@/lib/staff-search";
import { SENDING, staffTime } from "@/lib/staff-time";
import { siteUrl } from "@/lib/site-url.server";
import { logChange } from "@/lib/server/audit.server";
import { SEND_AGAIN, TOPICS_OF } from "./drafts.server";
import { broadcastEmailChannel, textBackend } from "./channels.server";
import { supporterAudience } from "./recipients.server";
import { query } from "@/lib/server/db.server";
import { hashOf } from "@/lib/supporters/email-settings.server";
import { gmailAccount } from "@/lib/accounts/gmail-accounts.server";
import { paced, type ChannelMessage, type ChannelResult } from "@/lib/letters/channels.server";
import { attachmentsOf, emailFor } from "@/lib/mailings/drafts.server";
import { newMessageId } from "@/lib/server/mime.server";
import { notifyStaff, staffLink } from "@/lib/email/notifications.server";
import { recordOptOut, type OptOut } from "@/lib/supporters/opt-outs.server";
import {
  checkSuppression,
  civicrmKey,
  SUPPRESSION_BATCH,
  type Suppressions,
} from "@/lib/server/outside-services/civicrm.server";
import type { Attachment } from "@/lib/server/outside-services/postmark.server";
import { sendTemplate } from "@/lib/server/outside-services/whatsapp.server";
import { problem } from "@/lib/server/problems.server";
import { recordWhatsAppStop } from "./whatsapp-stops.server";
import { markUnreachable, templateParams, textResult, textsLeftToday, unreachable } from "./whatsapp-texts.server";
import { broadcastsCopy } from "./copy";

// Sending broadcasts to supporters, in the send-mailings run every 15 minutes, as
// mailings to politicians go. A broadcast that's due starts: who it goes to
// is found then (supporterAudience), a copy each, once to each address,
// each with its own unsubscribe link. Its copies go in batches, each checked
// just before: anyone who has opted out since is skipped, and every address
// or number is checked with CiviCRM's checkSuppression, which drops anyone
// PauseAI mustn't bulk email, keeping that as an opt-out of ours, or text.
// Each channel has a sender (CopySender), and one loop sends by either. An
// email goes by the channel its broadcast says (broadcast-channels.server.ts), one
// copy at a time at the channel's pace: hello@'s Gmail, which sends up to a
// day's limit and carries on the next day, or Postmark's broadcast stream.
// A text goes by the fake backend a fixture build has, and nothing on the
// live site. Nothing goes unchecked: with no complete CiviCRM pull for a
// day, or CiviCRM not answering, a broadcast waits, and staff are told
// once; it goes by itself when it can. One that has waited WAIT_DAYS, or is
// still sending SENDING_DAYS after its time (lib/broadcasts/days.ts), stops,
// and whoever scheduled it is told who it didn't reach. A broadcast whose
// sender can't send for now, or two of whose copies fail in a row, rests a
// while (REST_MINUTES), so nothing that fails every copy can fail everyone;
// a limit or an outage it rests through for as long as it lasts, telling
// staff once it's been hours (heldBack).

/** Who the audit log says started and finished a broadcast. */
const JOB = "send-mailings";

/** How old the latest complete CiviCRM pull can be, for a broadcast to go. */
const FRESH_HOURS = 24;

/** Why a broadcast is waiting: CiviCRM didn't answer its check, or no pull has completed for a day. */
export type WaitReason = "civicrm" | "pull";

/**
 * Why a broadcast stopped before it had all gone: it waited too long, a
 * day's limit left it too slow, WhatsApp paused or disabled a text's
 * template, its days ran out while it waited for CiviCRM ("late"), or its
 * copies kept failing ("failing").
 */
export type StopReason = WaitReason | "limit" | "template" | "late" | "failing";

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
  // Those Resume sends to: the cancelled, and for one that kept failing, those refused too (SEND_AGAIN).
  const refused =
    reason === "failing"
      ? (
          await query<{ n: number }>(
            `SELECT count(*)::int AS n FROM broadcast_messages c WHERE c.mailing_id = $1 AND ${SEND_AGAIN}`,
            [broadcast.id],
          )
        )[0].n
      : 0;
  const notReached =
    broadcast.state === "scheduled"
      ? (await supporterAudience(broadcast.filter, termsOf(broadcast))).recipients.length
      : cancelled.length + refused;
  await query(
    `UPDATE mailings SET state = 'cancelled', gave_up = true, wait_reason = $2,
       waiting_since = coalesce(waiting_since, $3), updated_at = now() WHERE id = $1`,
    [broadcast.id, reason, now()],
  );
  await logChange(JOB, "stop broadcast", { id: broadcast.id, was: broadcast.state });
  const email = broadcastsCopy.notifications.broadcastGaveUp;
  await notifyStaff(
    email.subject(broadcast.title, reason),
    email.body(
      broadcast.title,
      reason,
      notReached,
      staffLink(`/staff/broadcasts/${broadcast.id}`, undefined),
      broadcast.channel,
    ),
    null,
    "staff-alert",
    await scheduler(broadcast.id),
  );
}

/**
 * Stops every text on a template WhatsApp paused or disabled, scheduled or
 * sending, as one that hasn't all gone in time stops (giveUp), each
 * whoever scheduled it told. Returns how many it stopped.
 */
export async function stopTextsOn(templateId: number): Promise<number> {
  const texts = await query<Due>(
    `SELECT ${DUE_COLUMNS} FROM mailings
     WHERE audience = 'supporters' AND template_id = $1 AND state IN ('scheduled', 'sending') ORDER BY id`,
    [templateId],
  );
  for (const text of texts) await giveUp(text, "template");
  return texts.length;
}

/**
 * Has a broadcast wait for `reason`, from now if it wasn't, telling staff
 * once; or stops it, if it has waited WAIT_DAYS. Those run from when it
 * began to wait, by the site's clock, not from its time: one that's days
 * into sending when CiviCRM first fails has them all, unless its
 * SENDING_DAYS run out first, which staff are told (waitEndsAt).
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
  const email = broadcastsCopy.notifications.broadcastWaiting;
  await notifyStaff(
    email.subject(broadcast.title),
    email.body(
      broadcast.title,
      reason,
      staffTime(waitEndsAt(began, broadcast.state === "sending" ? broadcast : null)),
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
 * politicians: only once a CiviCRM pull has completed in the last day, or
 * it waits. Returns those it started.
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
    if (!fresh) {
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

/** Why a copy didn't go. */
type SkipReason = "blocked" | "unsubscribed" | "no-permission" | "suppressed" | "not-on-whatsapp";

async function skip(id: number, reason: SkipReason): Promise<void> {
  await query(
    "UPDATE broadcast_messages SET status = 'skipped', skip_reason = $2, sending_since = NULL WHERE id = $1",
    [id, reason],
  );
}

/** What CiviCRM says of some addresses, or some numbers, SUPPRESSION_BATCH a call; throws if it doesn't answer. */
async function suppressions(values: string[], of: "email" | "phone"): Promise<Suppressions> {
  const key = civicrmKey();
  const found: Suppressions = { emails: new Map(), phones: new Map() };
  for (let i = 0; i < values.length; i += SUPPRESSION_BATCH) {
    const batch = values.slice(i, i + SUPPRESSION_BATCH);
    const { emails, phones } = await checkSuppression(key, of === "email" ? batch : [], of === "phone" ? batch : []);
    for (const [address, block] of emails) found.emails.set(address, block);
    for (const [number, block] of phones) found.phones.set(number, block);
  }
  return found;
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

type Sending = Due & {
  subject: string;
  body: unknown;
  sentFrom: string;
  fromName: string;
  /** Whether its tries were failing in the last REST_MINUTES (tryFailed). */
  resting: boolean;
  /** How many tries at its copies have failed one after another (failedInARow). */
  failedInARow: number;
  /** Since when its sender has said at every try that it can't send for now (heldBack); null if it hasn't. */
  heldBackSince: Date | null;
};

/** How long a broadcast's sender can say it can't send for now, with nothing going, before staff are told. */
const HELD_BACK_HOURS = 6;

/**
 * Notes that a broadcast's sender said it can't send for now, as at a day's
 * limit, which passes by itself: it rests (tryFailed), and never stops for
 * it, but once nothing has gone for HELD_BACK_HOURS, whoever scheduled it
 * is told, once, with what the sender last `said`.
 */
async function heldBack(broadcast: Sending, said: string): Promise<void> {
  const [{ since }] = await query<{ since: Date }>(
    `UPDATE mailings SET try_failed_at = now(), held_back_since = coalesce(held_back_since, $2)
     WHERE id = $1 RETURNING held_back_since AS since`,
    [broadcast.id, now()],
  );
  broadcast.heldBackSince = since;
  if (now().getTime() - since.getTime() < HELD_BACK_HOURS * 60 * 60 * 1000) return;
  // Told once, whichever run gets here first.
  const telling = await query(
    "UPDATE mailings SET held_back_told = true WHERE id = $1 AND NOT held_back_told RETURNING id",
    [broadcast.id],
  );
  if (telling.length === 0) return;
  const email = broadcastsCopy.notifications.broadcastHeldBack;
  await notifyStaff(
    email.subject(broadcast.title),
    email.body(
      broadcast.title,
      broadcast.channel,
      staffTime(since),
      said,
      staffTime(sendingStopsAt(broadcast.dueAt)),
      staffLink(`/staff/broadcasts/${broadcast.id}`, undefined),
    ),
    null,
    "staff-alert",
    await scheduler(broadcast.id),
  );
}

/** Notes that a broadcast held back (heldBack) has sent a copy, so it isn't any more. */
async function notHeldBack(broadcast: Sending): Promise<void> {
  if (!broadcast.heldBackSince) return;
  await query("UPDATE mailings SET held_back_since = NULL, held_back_told = false WHERE id = $1", [broadcast.id]);
  broadcast.heldBackSince = null;
}

/**
 * Notes that a broadcast's tries are failing as of now, for it to rest
 * from (REST_MINUTES), however often the sending is called, which the
 * background function does again at once while anything else is going.
 */
async function tryFailed(broadcast: Sending): Promise<void> {
  await query("UPDATE mailings SET try_failed_at = now() WHERE id = $1", [broadcast.id]);
}

/**
 * Keeps how many of a broadcast's copies have failed one after another: one
 * more for a copy that failed, none for one that went. Others, skipped or
 * held, leave it as it was. Returns how many.
 */
async function failedInARow(broadcast: Sending, failed: boolean): Promise<number> {
  const count = failed ? broadcast.failedInARow + 1 : 0;
  if (count !== broadcast.failedInARow) {
    await query("UPDATE mailings SET failed_in_a_row = $2 WHERE id = $1", [broadcast.id, count]);
    broadcast.failedInARow = count;
  }
  return count;
}

/**
 * The most copies of a broadcast taken at once, to be checked with CiviCRM
 * together: few, as those a run doesn't get to are put back.
 */
const TAKE = 20;

/**
 * Takes the next copies of a broadcast still to go, up to `limit`, as
 * `sending`, so no other run takes them, and none goes twice should this
 * run stop before its channel's answer is kept. Those never tried go first,
 * then those that failed before and are to go again (Resume): those most
 * likely to fail again, so they can't stop it before the rest have gone.
 */
async function nextCopies(id: number, limit: number): Promise<Copy[]> {
  const failedBefore = (copy: string) =>
    `EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = ${copy}.id AND e.kind = 'failed')`;
  const copies = await query<Copy & { failedBefore: boolean }>(
    `WITH next AS (
       SELECT id FROM broadcast_messages b WHERE mailing_id = $1 AND status = 'scheduled' AND address IS NOT NULL
         AND (not_before IS NULL OR not_before <= now())
       ORDER BY ${failedBefore("b")}, id LIMIT $2 FOR UPDATE SKIP LOCKED)
     UPDATE broadcast_messages c SET status = 'sending', sending_since = now() FROM next WHERE c.id = next.id
     RETURNING c.id::int AS id, c.address, c.rfc_message_id AS "rfcMessageId", c.topics, c.merge_values AS "mergeValues",
       ${failedBefore("c")} AS "failedBefore"`,
    [id, limit],
  );
  return copies.sort((a, b) => Number(a.failedBefore) - Number(b.failedBefore) || a.id - b.id);
}

/**
 * Puts copies taken and not sent back to go later: those still sending, not
 * one skipped or kept meanwhile. None went, so each is as one never handed
 * to its channel (hand).
 */
async function putBack(copies: Copy[]): Promise<void> {
  await query(
    `UPDATE broadcast_messages SET status = 'scheduled', sending_since = NULL, handed_at = NULL
     WHERE id = ANY($1::bigint[]) AND status = 'sending'`,
    [copies.map((copy) => copy.id)],
  );
}

/**
 * Marks a copy as handed to its channel, just before it is. From then,
 * until the channel's answer is kept, it may have gone, which is what
 * failLeftSending goes by.
 */
async function hand(copy: Copy): Promise<void> {
  await query("UPDATE broadcast_messages SET handed_at = now() WHERE id = $1", [copy.id]);
}

/**
 * Sends a batch of copies a run has taken, by `send`, which marks each that
 * went (`went`) and says whether to go on with the broadcast. Anything it
 * throws, which is only before a copy reaches its channel (send in
 * email.server.ts never throws after), puts back every copy of the batch that
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
    problem(words.notSentYet(broadcastsCopy.problems.copyOf(taken[0].id)), error);
    return false;
  }
}

/**
 * Keeps what became of a copy (keepSent), marking one that went, or may
 * have (`went`). Keeping one of those, if that fails, is reported, and the
 * copy left sending (failLeftSending), as it mustn't go twice; for one that
 * didn't go, it's thrown, for withCare to put it back.
 */
async function keep(copy: Copy, result: ChannelResult, run: BroadcastRun, went: (id: number) => void): Promise<void> {
  const copyId = copy.id;
  const mayHaveGone = result.sent || Boolean(result.mayHaveGone);
  if (mayHaveGone) went(copyId);
  try {
    await keepSent(copy, result, run);
  } catch (error) {
    if (!mayHaveGone) throw error;
    const words = staffCopy.problems.anywhere;
    problem(words.sentUnrecorded(broadcastsCopy.problems.copyOf(copyId)), error);
  }
}

/**
 * A copy failed, with an event saying so and why: what its provider said,
 * or that its send never finished.
 */
async function fail(id: number, why: { reason?: string } | { unfinished: true }): Promise<void> {
  await query(
    `WITH copy AS (UPDATE broadcast_messages SET status = 'failed', sending_since = NULL WHERE id = $1 RETURNING id)
     INSERT INTO broadcast_message_events (message_id, kind, details) SELECT id, 'failed', $2 FROM copy`,
    [id, JSON.stringify(why)],
  );
}

/** How long a copy can be `sending` before the run that took it must have stopped: longer than any run. */
const STOPPED_MINUTES = 30;

/**
 * Deals with the copies a run took and stopped before finishing with. One
 * it had handed to its channel (hand) may have gone, so it's failed:
 * sending it again could send twice. One it had only taken never went, so
 * it's put back to go, or cancelled if its broadcast has stopped since.
 */
async function failLeftSending(run: BroadcastRun): Promise<void> {
  const stopped = "c.status = 'sending' AND c.sending_since < now() - make_interval(mins => $1)";
  await query(
    `UPDATE broadcast_messages c
     SET status = CASE WHEN m.state = 'sending' THEN 'scheduled' ELSE 'cancelled' END, sending_since = NULL
     FROM mailings m
     WHERE m.id = c.mailing_id AND c.handed_at IS NULL AND ${stopped}`,
    [STOPPED_MINUTES],
  );
  const left = await query<{ id: number }>(
    `SELECT c.id::int AS id FROM broadcast_messages c WHERE ${stopped} ORDER BY c.id`,
    [STOPPED_MINUTES],
  );
  for (const { id } of left) await fail(id, { unfinished: true });
  run.failed += left.length;
}

/** How long WhatsApp asks a copy to wait when the person has had enough marketing messages lately. */
const HELD_HOURS = 24;

/**
 * Puts back a copy WhatsApp held, as the person has had enough marketing
 * messages lately, to go no sooner than a day from now, while its
 * broadcast still has time to send.
 */
export async function holdCopy(copyId: number): Promise<void> {
  await query(
    `UPDATE broadcast_messages SET status = 'scheduled', sending_since = NULL, handed_at = NULL,
       provider_message_id = NULL, sent_at = NULL, not_before = now() + make_interval(hours => $2)
     WHERE id = $1`,
    [copyId, HELD_HOURS],
  );
}

/**
 * Keeps what became of a copy sent: its channel's ID for it, and the
 * Message-ID it went with, where the channel gave it another. A text
 * WhatsApp refused marks its number as not on WhatsApp, or records the
 * person's stop, or is held a day.
 */
async function keepSent({ id: copyId, address }: Copy, result: ChannelResult, run: BroadcastRun): Promise<void> {
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
  } else if (result.reason === "unreachable") {
    await markUnreachable(address, copyId);
    await skip(copyId, "not-on-whatsapp");
    run.skipped++;
  } else if (result.reason === "stopped") {
    await recordWhatsAppStop(address, "refused", `copy-${copyId}`, now(), copyId);
    await skip(copyId, "unsubscribed");
    run.skipped++;
  } else if (result.reason === "held") {
    await holdCopy(copyId);
  } else {
    // One whose send broke off may have gone: kept as never finished, so Resume never sends it again.
    await fail(copyId, result.mayHaveGone ? { unfinished: true } : { reason: result.detail });
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
 * A copy that can't go, as CiviCRM's check blocks it, and the opt-out of
 * ours that keeps that, where it's ours to keep; or as its number isn't on
 * WhatsApp.
 */
type Blocked = { copy: Copy; optOut?: OptOut; reason?: "not-on-whatsapp" };

/**
 * How a broadcast's copies go, by its channel, for a run: its pace, whether
 * it can send now, how many more it can send today, CiviCRM's check of its
 * copies' addresses or numbers, and sending one.
 */
type CopySender = {
  /** The ms between two sends. */
  gap: number;
  /** Whether it can send now: by Gmail, only while the account it's from is connected. */
  ready(): Promise<boolean>;
  /** How many more it can send today; null for no limit. */
  remainingToday(): Promise<number | null>;
  /** What CiviCRM says of the copies' addresses or numbers; throws if it doesn't answer. */
  ask(copies: Copy[]): Promise<Suppressions>;
  /** Which of the copies that answer blocks. */
  blocked(copies: Copy[], said: Suppressions): Promise<Blocked[]>;
  send(copy: Copy): Promise<ChannelResult>;
};

/**
 * Checks copies just before they go: those whose answer is no now are
 * skipped with why; CiviCRM's check drops anyone blocked, keeping it as an
 * opt-out of ours where it's ours to keep. Returns those that can go; or
 * undefined when the broadcast waits, as CiviCRM didn't answer, with its
 * copies put back.
 */
async function checkCopies(
  broadcast: Sending,
  sender: CopySender,
  copies: Copy[],
  run: BroadcastRun,
): Promise<Copy[] | undefined> {
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
  let suppressed: Suppressions;
  try {
    suppressed = await sender.ask(going);
  } catch (error) {
    // Nothing is sent unchecked.
    problem(broadcastsCopy.problems.civicrmCheckFailed, error);
    await putBack(going);
    await wait(broadcast, "civicrm");
    return undefined;
  }
  const blocked = await sender.blocked(going, suppressed);
  for (const { copy, optOut, reason } of blocked) {
    if (optOut) await recordOptOut(optOut);
    await skip(copy.id, reason ?? "suppressed");
    run.skipped++;
  }
  if (broadcast.waitingSince) {
    await query("UPDATE mailings SET waiting_since = NULL, wait_reason = NULL WHERE id = $1", [broadcast.id]);
    broadcast.waitingSince = null;
  }
  return going.filter((copy) => !blocked.some((one) => one.copy === copy));
}

/**
 * The copies of an email CiviCRM blocks: any it says mustn't be emailed at
 * all, or bulk emailed, each kept as an opt-out of ours, but not "No bulk
 * emails" while the person's lift of it waits to go to CiviCRM, as their
 * choice stands.
 */
async function blockedEmails(copies: Copy[], said: Suppressions): Promise<Blocked[]> {
  const lifting = await liftsOnTheirWay(copies.map((copy) => copy.address));
  return copies.flatMap((copy): Blocked[] => {
    const block = said.emails.get(copy.address)!;
    // One CiviCRM hasn't checked follows our own records, which said yes.
    if (block === "none" || block === "unchecked") return [];
    if (block === "bulk" && lifting.has(copy.address)) return [{ copy }];
    const optOut: OptOut = {
      address: copy.address,
      list: block === "all" ? "all" : "bulk",
      source: "civicrm-check",
      sourceRef: `check ${copy.id}`,
      unsubscribedAt: now(),
      messageId: copy.id,
    };
    return [{ copy, optOut }];
  });
}

/**
 * The copies of a text that can't go: any whose number has CiviCRM's "Do
 * not SMS", which stops WhatsApp too, and any whose number isn't on
 * WhatsApp. None is kept as an opt-out of ours: CiviCRM's import already
 * brings its flag into consent.
 */
async function blockedNumbers(copies: Copy[], said: Suppressions): Promise<Blocked[]> {
  const off = await unreachable(copies.map((copy) => copy.address));
  return copies.flatMap((copy): Blocked[] => {
    if (said.phones.get(copy.address)!.doNotSms) return [{ copy }];
    return off.has(copy.address) ? [{ copy, reason: "not-on-whatsapp" }] : [];
  });
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
 * An email's sender: by the channel its broadcast says, `gap` ms apart, each
 * copy with its unsubscribe link and the broadcast's files. By Gmail, none
 * while the account it's from isn't connected.
 */
async function emailSender(broadcast: Sending, gapOverride?: number): Promise<CopySender> {
  const { channel, gapMs } = broadcastEmailChannel(broadcast.sendBy);
  const gap = gapOverride ?? gapMs;
  const pacedChannel = paced(channel, gap);
  const attachments = await attachmentsOf(broadcast.id);
  return {
    gap,
    ready: async () => broadcast.sendBy !== "gmail" || Boolean(await gmailAccount(broadcast.sentFrom)),
    remainingToday: () => channel.remainingToday(broadcast.sentFrom),
    ask: (copies) =>
      suppressions(
        copies.map((copy) => copy.address),
        "email",
      ),
    blocked: blockedEmails,
    send: async (copy) =>
      pacedChannel.send(copyMessage(broadcast, copy, await newToken(copy), attachments), "broadcast"),
  };
}

/**
 * A text's sender: by WhatsApp, its template filled in for each person, up
 * to our number's daily limit. None where WhatsApp doesn't send, or doesn't
 * answer; `template` when the text's template isn't approved now, as
 * WhatsApp paused or disabled it, which stops the text.
 */
async function textSender(broadcast: Sending): Promise<CopySender | "template" | undefined> {
  const backend = await textBackend();
  if (!backend) return undefined;
  const [template] = await query<{ name: string; status: string; body: unknown }>(
    `SELECT coalesce(t.meta_name, t.name) AS name, t.status, t.body
     FROM mailings m JOIN whatsapp_templates t ON t.id = m.template_id WHERE m.id = $1`,
    [broadcast.id],
  );
  if (template?.status !== "approved") return "template";
  // Its fields are the template's, as WhatsApp has them.
  const body = checkMailingDoc(template.body)!;
  return {
    gap: 0,
    ready: async () => true,
    remainingToday: () => textsLeftToday(backend.number.dailyLimit),
    ask: (copies) =>
      suppressions(
        copies.map((copy) => copy.address),
        "phone",
      ),
    blocked: blockedNumbers,
    send: async (copy) => {
      // Its words can't be made: thrown, as nothing has gone, so it's put back.
      const params = templateParams(body, copy.mergeValues);
      try {
        return textResult(
          await sendTemplate(backend.keys, backend.number.id, copy.address, { name: template.name, params }),
        );
      } catch (error) {
        // The send broke off, and WhatsApp may have taken it by then: failed, as an email is, never sent twice.
        problem(staffCopy.problems.anywhere.sendFailed("broadcast"), error);
        return { sent: false, reason: "failed", mayHaveGone: true };
      }
    },
  };
}

/**
 * Sends a broadcast's copies by its sender, one at a time, its gap apart,
 * until there are none, it's `until`, or the sender can send no more today,
 * when the rest wait for a later run: a few taken at a time, checked, and
 * each handed over and sent, or put back. A copy that fails is failed alone,
 * as one address's or number's trouble is its own, and the rest go on. But
 * no more go, and the broadcast rests (REST_MINUTES), once the sender
 * answers that it can't send for now (`retry`), which fails none, or two
 * copies have failed one after the other, here or in runs before, as
 * whatever failed them may fail them all. FAILURES_TO_STOP failed tries in
 * a row stop it, counting the sender's refusals that last till someone
 * fixes its account (`fixNeeded`), but never one that passes by itself, as
 * a day's limit does: it goes on after that, however long it rests
 * (heldBack). Counts the broadcast as waiting when CiviCRM didn't answer.
 */
async function sendCopies(broadcast: Sending, sender: CopySender, run: BroadcastRun, until: number): Promise<void> {
  const { gap } = sender;
  while (Date.now() + gap < until) {
    if (!(await sender.ready())) return;
    const remaining = (await sender.remainingToday()) ?? TAKE;
    // No more than there's time to send at the sender's pace, nor than it can send today.
    const room = gap ? Math.max(1, Math.floor((until - Date.now()) / gap)) : TAKE;
    const copies = await nextCopies(broadcast.id, Math.min(TAKE, room, remaining));
    if (copies.length === 0) return;
    const going = await withCare(copies, async (went) => {
      const checked = await checkCopies(broadcast, sender, copies, run);
      if (!checked) {
        run.waiting++;
        return false;
      }
      for (const [i, copy] of checked.entries()) {
        if (Date.now() + gap >= until) {
          await putBack(checked.slice(i));
          return false;
        }
        await hand(copy);
        const result = await sender.send(copy);
        const retry = !result.sent && result.retry;
        // It can't send for now, as Gmail sometimes says: this copy and the rest wait, rather than fail.
        if (retry) await putBack(checked.slice(i));
        else await keep(copy, result, run, went);
        if (result.sent) await notHeldBack(broadcast);
        // A limit, or the provider busy or down, passes by itself: it rests, and goes on after, however long that takes.
        if (!result.sent && result.retry && !result.fixNeeded) {
          // Every such answer says what the provider said.
          await heldBack(broadcast, result.detail!);
          return false;
        }
        if (!result.sent && result.reason !== "failed") continue;
        // A try refused till someone fixes the account counts too, as it would never end, though it fails nobody.
        const inARow = await failedInARow(broadcast, !result.sent);
        if (inARow < 2 && !retry) continue;
        // Two in a row, or the sender can't send now: the rest wait, so nothing fails everyone.
        await putBack(checked.slice(i + 1));
        if (inARow >= FAILURES_TO_STOP) await giveUp(broadcast, "failing");
        else await tryFailed(broadcast);
        return false;
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
 * between two emails, in place of their channel's own. A broadcast that
 * hasn't all gone by when it stops (sendingStopsAt) is stopped, as its days
 * ran out ("limit"), or, if it's waiting for CiviCRM then, as CiviCRM was
 * down when they did ("late"). One with no sender, a text on the live site,
 * counts as waiting, and one resting after a failed try sends none. First,
 * copies an earlier run took and never finished are failed, or put back if
 * they never reached their channel (failLeftSending).
 */
export async function sendDueBroadcasts(until: number, gap?: number): Promise<BroadcastRun> {
  const run: BroadcastRun = { sent: 0, skipped: 0, failed: 0, waiting: 0, left: 0 };
  await failLeftSending(run);
  const sending = await query<Sending>(
    `SELECT ${DUE_COLUMNS}, subject, body, sent_from AS "sentFrom", from_name AS "fromName",
       coalesce(try_failed_at > now() - make_interval(mins => $1), false) AS resting,
       failed_in_a_row AS "failedInARow", held_back_since AS "heldBackSince"
     FROM mailings WHERE audience = 'supporters' AND state = 'sending' ORDER BY due_at, id`,
    [REST_MINUTES],
  );
  for (const broadcast of sending) {
    if (now() >= sendingStopsAt(broadcast.dueAt)) {
      await giveUp(broadcast, broadcast.waitingSince ? "late" : "limit");
      continue;
    }
    // Resting after failed tries: nothing to ask of its channel till it's done.
    if (broadcast.resting) continue;
    const sender = broadcast.channel === "email" ? await emailSender(broadcast, gap) : await textSender(broadcast);
    if (sender === "template") await giveUp(broadcast, "template");
    else if (sender) await sendCopies(broadcast, sender, run, until);
    else run.waiting++;
  }
  await finishBroadcasts();
  const [{ left }] = await query<{ left: number }>(
    `SELECT count(*)::int AS left FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id
     WHERE m.state = 'sending' AND m.audience = 'supporters' AND c.status = 'scheduled' AND c.address IS NOT NULL`,
  );
  run.left = left;
  return run;
}
