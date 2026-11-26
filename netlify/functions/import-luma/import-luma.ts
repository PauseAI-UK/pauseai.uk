// Every 5 minutes, starts the copy of the Luma calendar's events, guests and
// contacts (netlify/scheduled.ts). A run takes up to about 25 seconds.
import { startsJob } from "../../scheduled";

export default startsJob("import-luma");

// Every 5 minutes from 2 minutes past the hour (2, 7, 12 … 57), off the hour,
// away from everyone else's on-the-hour fetches of Luma, night and day. The
// database sleeps after five minutes without a query (Netlify's default
// "Sleep on inactivity"), so with this and the Gmail reading it never sleeps.
export const config = { schedule: "2-59/5 * * * *" };
