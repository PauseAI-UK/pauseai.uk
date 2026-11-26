// Every 15 minutes, starts the sending: the mailings that are due, and what
// the letters inbox has queued, call after call while there's more to send,
// for up to 12 minutes (netlify/scheduled.ts).
import { startsJob } from "../../scheduled";

export default startsJob("send-mailings");

// At 3, 18, 33 and 48 minutes past every hour, overnight too, for the letters
// inbox's queue and for broadcasts still going. The staff pages offer these
// times (SENDING in lib/staff-time.ts), so a change here is a change there.
// Netlify reads the schedule without running the code, so it's written out,
// not built from SENDING.
export const config = { schedule: "3,18,33,48 * * * *" };
