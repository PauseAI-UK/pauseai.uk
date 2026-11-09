// Every 5 minutes, starts the background function that asks the site to copy
// the Luma calendar's events, guests and contacts (import-luma-background,
// netlify/scheduled.ts). A run takes up to about 25 seconds, and Netlify
// invokes a scheduled function again when it hasn't answered after about 15,
// so this one answers as soon as the background function has started.
import { startBackground } from "../../scheduled";

export default async function importLuma(): Promise<Response> {
  await startBackground("import-luma-background");
  return new Response("Started");
}

// Every 5 minutes from 2 minutes past the hour (2, 7, 12 … 57), off the hour,
// away from everyone else's on-the-hour fetches of Luma, night and day. The
// database sleeps after five minutes without a query (Netlify's default
// "Sleep on inactivity"), so with this and the Gmail reading it never sleeps.
export const config = { schedule: "2-59/5 * * * *" };
