// The nightly copy of the supporters of ControlAI's statement into its ask's statuses (netlify/scheduled.ts).
import { runsJob } from "../../scheduled";

export default runsJob("import-controlai-statement");

// 06:26 UTC, after every body's import (06:21 to 06:24) and ControlAI's letter's (06:25), so the politicians it matches are that day's, in the same wake of the database (import-luma.ts).
export const config = { schedule: "26 6 * * *" };
