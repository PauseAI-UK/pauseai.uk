// The nightly import of members of the Senedd from its list (netlify/scheduled.ts).
import { runsJob } from "../../scheduled";

export default runsJob("import-senedd");

// 06:23 UTC, in the same wake of the database as the other bodies' imports (import-luma.ts).
export const config = { schedule: "23 6 * * *" };
