// The nightly check of the MPs against Parliament's (netlify/scheduled.ts).
import { runsJob } from "../../scheduled";

export default runsJob("check-mps");

// 06:23 UTC, two minutes after the sync (06:21, at most 30 seconds), so it
// checks that day's copy, sharing the same wake of the database
// (import-luma.ts).
export const config = { schedule: "23 6 * * *" };
