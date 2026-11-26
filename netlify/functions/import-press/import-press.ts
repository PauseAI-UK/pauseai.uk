// Each night, asks the site to search Google News for coverage and read
// what it finds for a few seconds (netlify/scheduled.ts). If finds are left
// unread it starts the background function, which goes on for up to 12
// minutes.
import { callSite, startBackground } from "../../scheduled";
import { moreToRead } from "./more-to-read";

export default async function importPress(): Promise<Response> {
  const body = await callSite("import-press");
  if (moreToRead(JSON.parse(body))) await startBackground("import-press-background");
  return new Response(body);
}

// 06:29 UTC, after the other nightly jobs, in the same wake of the database (import-luma.ts).
export const config = { schedule: "29 6 * * *" };
