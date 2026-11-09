// What the functions in netlify/functions/ share. Each scheduled function
// (a folder, so its test can sit beside it without becoming a function too)
// asks the site to run its job, at /api/cron/<job> (app/api/cron/[job]),
// with CRON_SECRET. The work itself stays in the Next app. A scheduled
// function gets 30 seconds, so a job that needs longer has a background
// function beside it (<job>-background), which the scheduled one starts and
// which can go on for 15 minutes. Scheduled functions run only on published
// production deploys. URL is set by Netlify; CRON_SECRET by us.
//
// Netlify reads each function's schedule from its source without running
// it, so each is written out in its `config`; scheduled.test.ts checks it
// against how often lib/import-runs.ts says the job runs.

const secret = () => `Bearer ${process.env.CRON_SECRET}`;

/** Asks the site to run `job`, and gives its answer. Throws if the site fails, for Netlify's log. */
export async function callSite(job: string): Promise<string> {
  const res = await fetch(`${process.env.URL}/api/cron/${job}`, {
    method: "POST",
    headers: { Authorization: secret() },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`/api/cron/${job} returned ${res.status}: ${body}`);
  return body;
}

/** A scheduled function that asks the site to run `job` once, answering with what the site said. */
export function runsJob(job: string): () => Promise<Response> {
  return async () => new Response(await callSite(job));
}

/** Starts the background function `name`, which answers 202 at once. Throws if it doesn't start. */
export async function startBackground(name: string): Promise<void> {
  const res = await fetch(`${process.env.URL}/.netlify/functions/${name}`, {
    method: "POST",
    headers: { Authorization: secret() },
  });
  if (res.status !== 202) throw new Error(`${name} returned ${res.status}`);
}

/**
 * Whether a background function's call is ours, with CRON_SECRET. A
 * background function answers 202 at once, whoever calls it, so it does
 * nothing for a call without it, or when none is set.
 */
export function fromSchedule(request: Request): boolean {
  return Boolean(process.env.CRON_SECRET) && request.headers.get("authorization") === secret();
}
