// The nightly import of MSPs from the Scottish Parliament's list (netlify/scheduled.ts).
import { runsJob } from "../../scheduled";

export default runsJob("import-scottish-parliament");

// 06:22 UTC, a minute after Parliament's import, in the same wake of the database (import-luma.ts).
export const config = { schedule: "22 6 * * *" };
