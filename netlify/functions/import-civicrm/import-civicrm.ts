// The hourly pull of Global's UK chapter contacts from CiviCRM (netlify/scheduled.ts).
import { startsJob } from "../../scheduled";

export default startsJob("import-civicrm");

// At 49 minutes past every hour.
export const config = { schedule: "49 * * * *" };
