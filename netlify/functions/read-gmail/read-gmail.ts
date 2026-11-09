// Every 5 minutes, reads the connected Gmail accounts for replies to our
// letters and for bounces (netlify/scheduled.ts).
import { runsJob } from "../../scheduled";

export default runsJob("read-gmail");

// Every 5 minutes, on the minute that's a multiple of 5, night and day, so a
// reply is relayed within minutes of reaching the letters inbox.
export const config = { schedule: "*/5 * * * *" };
