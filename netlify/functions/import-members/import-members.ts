// The hourly copy of PauseAI's UK members (netlify/scheduled.ts).
import { runsJob } from "../../scheduled";

export default runsJob("import-members");

// At 19 minutes past every hour, two minutes after a Luma import (at most 30
// seconds) starts, so the two, which both link supporters, never overlap.
export const config = { schedule: "19 * * * *" };
