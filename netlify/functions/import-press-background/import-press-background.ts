// Netlify background function (its name ends -background): started by the
// import-press function, each night, when finds are left unread after its
// call. It asks the site to read again and again, for up to 12 minutes,
// until none is left or a call reads nothing; the next night takes up what's
// left (netlify/scheduled.ts).
import { callSite, fromSchedule } from "../../scheduled";
import { moreToRead } from "../import-press/more-to-read";

/** When to stop asking: short of Netlify's 15 minutes, with room for the scheduled call before this started and the last call it makes. */
const RUN_MS = 12 * 60_000;

export default async function importPressBackground(request: Request): Promise<void> {
  if (!fromSchedule(request)) return;
  const until = Date.now() + RUN_MS;
  while (Date.now() < until) {
    if (!moreToRead(JSON.parse(await callSite("import-press")))) return;
  }
}
