// Each night, starts the press survey: it searches Google News for coverage
// and reads what it finds, call after call while finds are left, for up to
// 12 minutes (netlify/scheduled.ts).
import { startsJob } from "../../scheduled";

export default startsJob("import-press");

// 06:29 UTC, after the other nightly jobs, in the same wake of the database (import-luma.ts).
export const config = { schedule: "29 6 * * *" };
