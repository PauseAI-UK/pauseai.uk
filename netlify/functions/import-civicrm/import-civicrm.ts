// The hourly pull of Global's UK chapter contacts from CiviCRM (netlify/scheduled.ts).
import { runsJob } from "../../scheduled";

export default runsJob("import-civicrm");

// At 49 minutes past every hour, well away from the members import, which looks up new members in CiviCRM too.
export const config = { schedule: "49 * * * *" };
