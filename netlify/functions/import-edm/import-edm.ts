// The nightly copy of the superintelligence EDM's signers into its ask's statuses (netlify/scheduled.ts).
import { runsJob } from "../../scheduled";

export default runsJob("import-edm");

// 06:28 UTC, after Parliament's import (06:21), so the MPs it matches are that day's, in the same wake of the database (import-luma.ts).
export const config = { schedule: "28 6 * * *" };
