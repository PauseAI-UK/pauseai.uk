// Netlify background function (its name ends -background): started by the
// send-mailings function, every 15 minutes, when there's more to send than
// one call sends. It asks the site to send again and again, for up to 12
// minutes, until none is left or every account sending has reached its
// limit for the day; the next run takes up what's left
// (netlify/scheduled.ts).
import { callSite, fromSchedule } from "../../scheduled";
import { moreToSend } from "../send-mailings/more-to-send";

/**
 * When to stop asking: short of Netlify's 15 minutes, and of the next
 * scheduled run, which a run still going would turn away, with room for
 * the scheduled call before this started and the last call it makes.
 */
const RUN_MS = 12 * 60_000;

export default async function sendMailingsBackground(request: Request): Promise<void> {
  if (!fromSchedule(request)) return;
  const until = Date.now() + RUN_MS;
  while (Date.now() < until) {
    if (!moreToSend(JSON.parse(await callSite("send-mailings")))) return;
  }
}
