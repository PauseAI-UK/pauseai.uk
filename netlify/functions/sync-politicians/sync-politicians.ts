// The nightly copy of the politicians from Airtable (netlify/scheduled.ts).
import { runsJob } from "../../scheduled";

export default runsJob("sync-politicians");

// 06:21 UTC, just after the day's first Luma (06:17) and members (06:19)
// imports, sharing their wake of the database rather than waking it overnight
// (import-luma.ts).
export const config = { schedule: "21 6 * * *" };
