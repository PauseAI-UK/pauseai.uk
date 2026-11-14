// The fixture build's staff inboxes (lib/server/fixtures/fixture-env.mjs),
// as an email to one is addressed.
import { NOTIFICATION_INBOX } from "@/lib/server/fixtures/fixture-env.mjs";
import { emailCopy } from "@/lib/email/copy";

/** The policy inbox, where replies to letters sent before the letters inbox go. */
export const POLICY_INBOX = "policy@example.org";

/** Where a fixture build emails when something needs a person: with the inbox's name. */
export const TO_NOTIFICATIONS = `"${emailCopy.inboxNames.notifications}" <${NOTIFICATION_INBOX}>`;
