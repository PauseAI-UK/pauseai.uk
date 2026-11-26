// The nightly deletion of what the import log and the audit log no longer
// keep (netlify/scheduled.ts).
import { startsJob } from "../../scheduled";

export default startsJob("tidy-logs");

// 06:27 UTC, after the day's other jobs, sharing their wake of the database
// rather than waking it overnight (import-luma.ts).
export const config = { schedule: "27 6 * * *" };
