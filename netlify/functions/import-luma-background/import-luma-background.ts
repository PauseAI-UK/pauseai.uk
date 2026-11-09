// Netlify background function (its name ends -background): started by the
// import-luma function every 5 minutes, it asks the site to copy the Luma
// calendar's events, guests and contacts (netlify/scheduled.ts). Netlify
// tries it twice more, a minute and then two minutes apart, if it fails; a
// run started while another is going only records that it stopped.
import { callSite, fromSchedule } from "../../scheduled";

export default async function importLumaBackground(request: Request): Promise<void> {
  if (fromSchedule(request)) await callSite("import-luma");
}
