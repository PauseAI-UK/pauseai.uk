// The fixture build's staff inboxes (lib/server/fixtures/fixture-env.mjs),
// as an email to one is addressed.
import { staffCopy } from "@/lib/content/staff-interface";
import { NOTIFICATION_INBOX } from "@/lib/server/fixtures/fixture-env.mjs";

/** The policy inbox, where replies to letters sent before the letters inbox go. */
export const POLICY_INBOX = "policy@example.org";

/** Where a fixture build emails when something needs a person: with the inbox's name. */
export const TO_NOTIFICATIONS = `"${staffCopy.inboxNames.notifications}" <${NOTIFICATION_INBOX}>`;
