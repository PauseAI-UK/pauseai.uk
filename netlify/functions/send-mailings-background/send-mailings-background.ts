// Netlify background function (its name ends -background): started by the
// hourly send-mailings function when a mailing has more letters than one
// call sends. It asks the site to send again and again, for up to 15
// minutes, until none are left or every account sending has reached its
// limit for the day; the next hour's run takes up what's left
// (netlify/scheduled.ts).
import { callSite, fromSchedule } from "../../scheduled";
import { moreToSend } from "../send-mailings/more-to-send";

/** When to stop asking, short of Netlify's 15 minutes. */
const RUN_MS = 14 * 60_000;

export default async function sendMailingsBackground(request: Request): Promise<void> {
  if (!fromSchedule(request)) return;
  const until = Date.now() + RUN_MS;
  while (Date.now() < until) {
    if (!moreToSend(JSON.parse(await callSite("send-mailings")))) return;
  }
}
