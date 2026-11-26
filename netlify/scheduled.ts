// What the functions in netlify/functions/ share. Every job runs in one
// background function, run-job-background, which can go on for 15 minutes:
// it asks the site to run the job, at /api/cron/<job> (app/api/cron/[job]),
// with CRON_SECRET, and again while the job has more to do (./more-to-do.ts).
// Each job's scheduled function (a folder, so its test can sit beside it
// without becoming a function too) only starts it, on the schedule's behalf,
// and a job's button on the staff pages starts it on a staff member's
// (lib/jobs/start-job.server.ts). A scheduled function gets 30 seconds, and
// Netlify calls one again when it hasn't answered after about 15, so it
// answers as soon as the background function has started. Scheduled
// functions run only on published production deploys; a background function
// runs on any. URL is set by Netlify; CRON_SECRET by us.
//
// Netlify reads each function's schedule from its source without running
// it, so each is written out in its `config`; scheduled.test.ts checks it
// against how often lib/import-runs.ts says the job runs.
import { NIGHTLY } from "../lib/import-runs";

/** The background function that runs every job. */
export const RUN_JOB = "run-job-background";

/**
 * What the background function is started with, and passes on to the site:
 * the job, who started it (NIGHTLY for its schedule, else a staff member's
 * email), and whether the job is marked running already for its first call,
 * as a staff member's button marks it before starting this.
 */
export type JobStart = { job: string; startedBy: string; marked?: boolean };

const secret = () => `Bearer ${process.env.CRON_SECRET}`;

/** Asks the site at `origin` to run a job, and gives its answer. Throws if the site fails, for Netlify's log. */
export async function callSite(origin: string, { job, startedBy, marked = false }: JobStart): Promise<string> {
  const res = await fetch(`${origin}/api/cron/${job}`, {
    method: "POST",
    headers: { Authorization: secret(), "Content-Type": "application/json" },
    body: JSON.stringify({ startedBy, marked }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`/api/cron/${job} returned ${res.status}: ${body}`);
  return body;
}

/** A scheduled function: starts the background function, which answers 202 at once, to run `job` on its schedule's behalf. Throws if it doesn't start. */
export function startsJob(job: string): () => Promise<Response> {
  return async () => {
    const start: JobStart = { job, startedBy: NIGHTLY };
    const res = await fetch(`${process.env.URL}/.netlify/functions/${RUN_JOB}`, {
      method: "POST",
      headers: { Authorization: secret(), "Content-Type": "application/json" },
      body: JSON.stringify(start),
    });
    if (res.status !== 202) throw new Error(`${RUN_JOB} returned ${res.status}`);
    return new Response("Started");
  };
}

/**
 * Whether a call to the background function is ours, with CRON_SECRET. A
 * background function answers 202 at once, whoever calls it, so it does
 * nothing for a call without it, or when none is set.
 */
export function hasSecret(request: Request): boolean {
  return Boolean(process.env.CRON_SECRET) && request.headers.get("authorization") === secret();
}
