// The health checks' names, groups and limits, and how a job's runs are
// judged: what lib/oversight/health.server.ts asks the database about, and
// what /api/health answers with. docs/development.md, "The health checks",
// says what each monitor is and what to do when one goes red.
import { type ImportJob, type JobSchedule, jobSchedule, nextRun } from "@/lib/import-runs";

/**
 * Each group of checks, by its address after /api/health/. An outside
 * monitor asks a group's address, which is bad when any of its checks is.
 * A technical group going bad means something is broken; a product one,
 * that something has stopped happening, which may be a quiet week.
 */
export const HEALTH_GROUPS = {
  "technical/database-and-jobs": ["database", "jobs"],
  "technical/sending": ["email-sending", "whatsapp-sending"],
  "product/sign-ups": ["new-civicrm-people", "new-luma-sign-ups"],
  "product/letters-written": ["letters-written"],
  "product/replies": ["letter-replies", "mailing-replies", "broadcast-replies"],
} as const;

export type HealthGroup = keyof typeof HEALTH_GROUPS;
export type HealthCheck = (typeof HEALTH_GROUPS)[HealthGroup][number];
export const HEALTH_GROUP_NAMES = Object.keys(HEALTH_GROUPS) as HealthGroup[];

export function isHealthGroup(value: string): value is HealthGroup {
  return Object.hasOwn(HEALTH_GROUPS, value);
}

/**
 * What a check found: whether it's good, and the times, limits and job
 * names that say why. Anyone can read it, so it never holds an error's
 * words, a person's name or an address.
 */
export type Found = { status: "ok" | "bad" } & Record<string, unknown>;

/** A group's answer: bad when any of its checks is. */
export type GroupFound = { group: HealthGroup; status: Found["status"]; checks: Partial<Record<HealthCheck, Found>> };

/** The HTTP status a monitor reads: any but 200 is down to it. */
export const HEALTH_HTTP_STATUS = { ok: 200, bad: 503 } as const;

/** A group's answer from its checks' answers, in the group's order. */
export function groupFound(group: HealthGroup, found: Found[]): GroupFound {
  const checks = Object.fromEntries(HEALTH_GROUPS[group].map((check, i) => [check, found[i]]));
  return { group, status: found.some((f) => f.status === "bad") ? "bad" : "ok", checks };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** How long after a job's run was due it may still arrive, before the job is late. */
export const LATE_AFTER_MS: Record<JobSchedule, number> = {
  frequent: 15 * MINUTE,
  "quarter-hour": 45 * MINUTE,
  hourly: 2 * HOUR,
  nightly: 3 * HOUR,
};

/** How many scheduled times in a row a job goes wrong at before it's bad. One is routine, and staff get its email. */
export const WRONG_IN_A_ROW = 3;

/** Runs this close together are one time: a run that fails and is tried again at once is one bad run. */
export const SAME_TIME_MS = MINUTE;

/** How many of a job's newest runs are read, enough for WRONG_IN_A_ROW times each tried three times. */
export const RUNS_READ = WRONG_IN_A_ROW * 3;

/** One run of a job: when, and whether it failed or recorded a problem. */
export type RunSeen = { at: Date; wrong: boolean };

/** A job that hasn't run when it was due. */
export type LateJob = { job: ImportJob; lastRan: string; nextRunWasDue: string; minutesOverdue: number };

/**
 * Whether a job is late, from its newest run: the run after it was due
 * more than its schedule's grace ago (LATE_AFTER_MS). A job that has never
 * run isn't late, as a new job hasn't until its first time comes.
 */
export function lateJob(job: ImportJob, newest: RunSeen | undefined, now: Date): LateJob | undefined {
  if (!newest) return undefined;
  const due = nextRun(job, newest.at);
  const overdue = now.getTime() - due.getTime();
  if (overdue <= LATE_AFTER_MS[jobSchedule(job)]) return undefined;
  return {
    job,
    lastRan: newest.at.toISOString(),
    nextRunWasDue: due.toISOString(),
    minutesOverdue: Math.floor(overdue / MINUTE),
  };
}

/**
 * Whether a job has gone wrong at its last WRONG_IN_A_ROW times, from its
 * runs, newest first. Runs within SAME_TIME_MS of each other are one time,
 * which went as its newest run did.
 */
export function goingWrong(runs: RunSeen[]): boolean {
  const times = runs.filter((run, i) => i === 0 || runs[i - 1].at.getTime() - run.at.getTime() >= SAME_TIME_MS);
  return times.length >= WRONG_IN_A_ROW && times.slice(0, WRONG_IN_A_ROW).every((run) => run.wrong);
}

/** How long each thing may go without happening before its check is bad, in hours. */
export const QUIET_LIMIT_HOURS = {
  "new-civicrm-people": 24,
  "new-luma-sign-ups": 24,
  "letters-written": 4 * 24,
  "letter-replies": 3 * 24,
} as const satisfies Partial<Record<HealthCheck, number>>;

/** A check of how long since something last happened: bad past `limitHours`, or if it never has. */
export function sinceLast(last: Date | null, limitHours: number, now: Date): Found {
  const hoursSinceLast = last && Math.floor((now.getTime() - last.getTime()) / HOUR);
  const quiet = hoursSinceLast === null || hoursSinceLast >= limitHours;
  return { status: quiet ? "bad" : "ok", hoursSinceLast, limitHours };
}

/** The emails that must all have failed for email sending to be bad: the newest this many. */
export const EMAILS_FAILED_IN_A_ROW = 3;

/**
 * WhatsApp sending looks at the texts handed over between these hours ago:
 * long enough for WhatsApp to say they arrived, and no longer than a fault
 * is worth saying.
 */
export const TEXTS_FROM_HOURS = 3 * 24;
export const TEXTS_TO_HOURS = 2;
/** Fewer texts than this say nothing either way. */
export const TEXTS_ENOUGH = 50;
/** The share of the texts that must have been delivered. A broadcast loses a few to numbers that have left WhatsApp. */
export const TEXTS_DELIVERED_SHARE = 0.5;

/** WhatsApp sending's answer, from how many texts were handed over in its hours and how many of them arrived. */
export function textsFound(handed: number, delivered: number): Found {
  const bad = handed >= TEXTS_ENOUGH && delivered < handed * TEXTS_DELIVERED_SHARE;
  return { status: bad ? "bad" : "ok", handed, delivered };
}

/**
 * A mailing to politicians is asked about from MAILING_QUIET_DAYS after its
 * first letter went until ANSWERED_WITHIN_DAYS after, if it went to
 * MAILING_ENOUGH or more: a smaller one may fairly get no reply.
 */
export const MAILING_QUIET_DAYS = 3;
export const MAILING_ENOUGH = 20;
/** A broadcast to supporters, the same, by how many it went to on each channel. */
export const BROADCAST_QUIET_DAYS = 2;
export const BROADCAST_ENOUGH = { text: 200, email: 2000 } as const;
/** After this long, a mailing or broadcast is no longer asked about, so an old one can't keep a check bad. */
export const ANSWERED_WITHIN_DAYS = 14;

/** What was sent and got nothing back: its ID on the staff pages, and when its first copy went. */
export type Unanswered = { id: number; sent: Date };

/** A "sent, but nothing back" check's answer, from the mailings or broadcasts that got nothing. */
export function unansweredFound(unanswered: Unanswered[]): Found {
  return {
    status: unanswered.length ? "bad" : "ok",
    unanswered: unanswered.map(({ id, sent }) => ({ id, sent: sent.toISOString() })),
  };
}

/** `hours` before `now`. */
export function hoursBefore(now: Date, hours: number): Date {
  return new Date(now.getTime() - hours * HOUR);
}
