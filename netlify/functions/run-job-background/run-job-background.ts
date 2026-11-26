// Netlify background function (its name ends -background): runs a job,
// started by the job's scheduled function or by a staff member's button
// (netlify/scheduled.ts). It asks the site to run the job, and again while
// the job has more to do, for up to 12 minutes; the next run takes up
// what's left. It asks the deploy it was called on, so a deploy preview's
// button runs the preview's job, not production's. Netlify tries it twice
// more, a minute and then two minutes apart, if it fails; a run started
// while another of its job is going does nothing.
import { callSite, hasSecret, type JobStart } from "../../scheduled";
import { moreToDo } from "../../more-to-do";

/**
 * When to stop asking: short of Netlify's 15 minutes, and of the next run
 * of a job every 15 minutes, which a run still going would turn away, with
 * room for the last call it makes.
 */
const RUN_MS = 12 * 60_000;

export default async function runJobBackground(request: Request): Promise<void> {
  if (!hasSecret(request)) return;
  const start = (await request.json()) as JobStart;
  const origin = new URL(request.url).origin;
  const until = Date.now() + RUN_MS;
  // Only the first call finds the job marked running by whoever started it; each after marks it itself.
  let marked = start.marked;
  do {
    const said = JSON.parse(await callSite(origin, { ...start, marked })) as object;
    if (!moreToDo(start.job, said)) return;
    marked = false;
  } while (Date.now() < until);
}
