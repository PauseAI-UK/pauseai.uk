// The nightly copy of the signatories of ControlAI's letter to the PM into
// the bill's statuses (netlify/scheduled.ts).
import { runsJob } from "../../scheduled";

export default runsJob("import-controlai");

// 06:25 UTC, after the sync (06:21) and the check (06:23), so the MPs it
// matches against are that day's, sharing the same wake of the database
// (import-luma.ts).
export const config = { schedule: "25 6 * * *" };
