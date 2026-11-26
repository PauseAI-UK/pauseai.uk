// The nightly import of MSPs from the Scottish Parliament's list (netlify/scheduled.ts).
import { startsJob } from "../../scheduled";

export default startsJob("import-scottish-parliament");

// 06:22 UTC, a minute after Parliament's import, in the same wake of the database (import-luma.ts).
export const config = { schedule: "22 6 * * *" };
