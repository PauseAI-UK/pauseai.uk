// The nightly import of MLAs from the Northern Ireland Assembly's list (netlify/scheduled.ts).
import { runsJob } from "../../scheduled";

export default runsJob("import-ni-assembly");

// 06:24 UTC, in the same wake of the database as the other bodies' imports (import-luma.ts).
export const config = { schedule: "24 6 * * *" };
