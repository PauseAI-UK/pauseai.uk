import "server-only";
import { IMPORT_JOBS, type ImportJob } from "@/lib/import-runs";
import { query } from "@/lib/server/db.server";
import {
  ANSWERED_WITHIN_DAYS,
  BROADCAST_ENOUGH,
  BROADCAST_QUIET_DAYS,
  EMAILS_FAILED_IN_A_ROW,
  type Found,
  goingWrong,
  type GroupFound,
  groupFound,
  HEALTH_GROUP_NAMES,
  HEALTH_GROUPS,
  type HealthCheck,
  type HealthGroup,
  hoursBefore,
  lateJob,
  MAILING_ENOUGH,
  MAILING_QUIET_DAYS,
  QUIET_LIMIT_HOURS,
  type RunSeen,
  RUNS_READ,
  sinceLast,
  TEXTS_FROM_HOURS,
  TEXTS_TO_HOURS,
  textsFound,
  type Unanswered,
  unansweredFound,
  WRONG_IN_A_ROW,
} from "./health";

// The health checks, which /api/health answers an outside monitor with
// (lib/oversight/health.ts has their groups and limits). Each reads what the
// site has recorded of its own work and calls no outside service, so a
// monitor asking every few minutes costs a few small queries. None catches
// an error: with the database down a check throws, the route answers 500,
// and the monitor counts that as down, as it should.

/** The database answers. */
async function database(): Promise<Found> {
  await query("SELECT 1");
  return { status: "ok" };
}

/**
 * Every scheduled job has run when it was due (lateJob), and hasn't gone
 * wrong at its last few times (goingWrong), from each job's newest runs. A
 * run has gone wrong when it failed or recorded a problem.
 */
async function jobs(now: Date): Promise<Found> {
  const rows = await query<RunSeen & { job: ImportJob }>(
    `SELECT j.job, r.at, r.wrong FROM unnest($1::text[]) AS j(job)
     CROSS JOIN LATERAL (
       SELECT at, id, (status = 'failed' OR problems <> '[]'::jsonb) AS wrong FROM import_runs
       WHERE job = j.job ORDER BY at DESC, id DESC LIMIT $2) r
     ORDER BY j.job, r.at DESC, r.id DESC`,
    [IMPORT_JOBS, RUNS_READ],
  );
  const runsOf = (job: ImportJob) => rows.filter((row) => row.job === job);
  const late = IMPORT_JOBS.flatMap((job) => lateJob(job, runsOf(job)[0], now) ?? []);
  const wrong = IMPORT_JOBS.filter((job) => goingWrong(runsOf(job))).map((job) => ({ job, runs: WRONG_IN_A_ROW }));
  return { status: late.length || wrong.length ? "bad" : "ok", late, goingWrong: wrong };
}

/**
 * The newest emails the site tried to send didn't all fail. One refused
 * for a blocked address was never tried, and one imported from a mailbox
 * wasn't the site's to send.
 */
async function emailSending(): Promise<Found> {
  const newest = await query<{ outcome: string }>(
    `SELECT outcome FROM email_sends WHERE outcome <> 'refused' AND NOT imported ORDER BY at DESC, id DESC LIMIT $1`,
    [EMAILS_FAILED_IN_A_ROW],
  );
  const firstThatWent = newest.findIndex((send) => send.outcome !== "failed");
  const failedInARow = firstThatWent === -1 ? newest.length : firstThatWent;
  return { status: failedInARow === EMAILS_FAILED_IN_A_ROW ? "bad" : "ok", failedInARow };
}

/**
 * Most of the texts handed to WhatsApp lately were delivered (textsFound).
 * Bad when WhatsApp refuses our texts, and when it has stopped telling the
 * site which arrived.
 */
async function whatsappSending(now: Date): Promise<Found> {
  const [{ handed, delivered }] = await query<{ handed: number; delivered: number }>(
    `SELECT count(*)::int AS handed, (count(*) FILTER (WHERE c.status = 'delivered'))::int AS delivered
     FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id
     WHERE m.channel = 'text' AND c.sent_at > $1 AND c.sent_at <= $2`,
    [hoursBefore(now, TEXTS_FROM_HOURS), hoursBefore(now, TEXTS_TO_HOURS)],
  );
  return textsFound(handed, delivered);
}

/** How long since the newest row by `lastSql`, a query of one `last` column, against the check's limit. */
async function quiet(check: keyof typeof QUIET_LIMIT_HOURS, lastSql: string, now: Date): Promise<Found> {
  const [{ last }] = await query<{ last: Date | null }>(lastSql);
  return sinceLast(last, QUIET_LIMIT_HOURS[check], now);
}

/**
 * The mailings to politicians that got nothing back: sent to enough, long
 * enough ago to have been answered, and with no reply from a politician's
 * side to any of their letters. An automatic reply isn't one (an
 * 'auto_reply' event names it, as in lib/letters/copy-states.ts).
 */
async function mailingReplies(now: Date): Promise<Found> {
  const unanswered = await query<Unanswered>(
    `WITH sent AS (
       SELECT p.mailing_id, min(l.sent_at) AS first, count(*) AS letters
       FROM letters_from_pauseai p JOIN letters l ON l.id = p.id WHERE l.sent_at IS NOT NULL GROUP BY p.mailing_id)
     SELECT s.mailing_id::int AS id, s.first AS sent FROM sent s
     WHERE s.first > $1 AND s.first <= $2 AND s.letters >= $3
       AND NOT EXISTS (
         SELECT 1 FROM letter_replies r JOIN letters_from_pauseai p ON p.id = r.letter_id
         WHERE p.mailing_id = s.mailing_id AND NOT r.from_us AND NOT r.from_supporter
           AND NOT EXISTS (SELECT 1 FROM letter_events e WHERE e.letter_id = r.letter_id AND e.status = 'auto_reply'
             AND e.details->>'gmailMessageId' = r.gmail_message_id))
     ORDER BY s.mailing_id`,
    [hoursBefore(now, ANSWERED_WITHIN_DAYS * 24), hoursBefore(now, MAILING_QUIET_DAYS * 24), MAILING_ENOUGH],
  );
  return unansweredFound(unanswered);
}

/**
 * The broadcasts to supporters that got nothing back, the same way, by how
 * many each channel needs. Anything that came back counts, an automatic
 * reply or a reaction too: each shows that what comes back is collected.
 */
async function broadcastReplies(now: Date): Promise<Found> {
  const unanswered = await query<Unanswered>(
    `WITH sent AS (
       SELECT c.mailing_id, min(c.sent_at) AS first, count(*) AS copies
       FROM broadcast_messages c WHERE c.sent_at IS NOT NULL GROUP BY c.mailing_id)
     SELECT m.id::int AS id, s.first AS sent FROM sent s JOIN mailings m ON m.id = s.mailing_id
     WHERE s.first > $1 AND s.first <= $2 AND s.copies >= CASE m.channel WHEN 'text' THEN $3::int ELSE $4::int END
       AND NOT EXISTS (
         SELECT 1 FROM broadcast_replies r JOIN broadcast_messages c ON c.id = r.message_id
         WHERE c.mailing_id = m.id)
     ORDER BY m.id`,
    [
      hoursBefore(now, ANSWERED_WITHIN_DAYS * 24),
      hoursBefore(now, BROADCAST_QUIET_DAYS * 24),
      BROADCAST_ENOUGH.text,
      BROADCAST_ENOUGH.email,
    ],
  );
  return unansweredFound(unanswered);
}

/** What runs each check. */
const CHECKS: Record<HealthCheck, (now: Date) => Promise<Found>> = {
  database,
  jobs,
  "email-sending": emailSending,
  "whatsapp-sending": whatsappSending,
  "new-civicrm-people": (now) =>
    quiet("new-civicrm-people", "SELECT max(first_seen_at) AS last FROM civicrm_contacts", now),
  "new-luma-sign-ups": (now) => quiet("new-luma-sign-ups", "SELECT max(registered_at) AS last FROM luma_guests", now),
  "letters-written": (now) =>
    quiet("letters-written", "SELECT max(created_at) AS last FROM letters WHERE kind = 'supporter'", now),
  // Any reply from the politician's side, an automatic one too: it came by the same way.
  "letter-replies": (now) =>
    quiet(
      "letter-replies",
      `SELECT max(r.at) AS last FROM letter_replies r JOIN letters l ON l.id = r.letter_id
       WHERE l.kind = 'supporter' AND NOT r.from_us AND NOT r.from_supporter`,
      now,
    ),
  "mailing-replies": mailingReplies,
  "broadcast-replies": broadcastReplies,
};

/** One group's checks, run together, as its address answers. */
export async function checkHealth(group: HealthGroup, now: Date): Promise<GroupFound> {
  return groupFound(group, await Promise.all(HEALTH_GROUPS[group].map((check) => CHECKS[check](now))));
}

/** Every group's checks, as /api/health answers. */
export async function checkAllHealth(now: Date): Promise<GroupFound[]> {
  return Promise.all(HEALTH_GROUP_NAMES.map((group) => checkHealth(group, now)));
}
