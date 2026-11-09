// Hourly, asks the site to start the mailings that are due and send for a
// few seconds (netlify/scheduled.ts). If letters are left it starts the
// background function, which goes on for up to 15 minutes.
import { callSite, startBackground } from "../../scheduled";
import { moreToSend } from "./more-to-send";

export default async function sendMailings(): Promise<Response> {
  const body = await callSite("send-mailings");
  if (moreToSend(JSON.parse(body))) await startBackground("send-mailings-background");
  return new Response(body);
}

// Every hour at 18 minutes past, overnight too, for the letters inbox's queue.
// A mailing due overnight still starts at 06:18 (startDueMailings). The
// staff pages say so (SENDING in lib/staff-time.ts), so a change here is a
// change there. Netlify reads the schedule without running the code, so
// it's written out, not built from SENDING.
export const config = { schedule: "18 * * * *" };
