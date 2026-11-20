// A copy `c` of a broadcast's email that's delayed, as SQL: where the page
// says how each copy stands (COPY_STATE in pages.server.ts), and where
// stopping one all sent but for those gives up on them (stopBroadcast).
import { SILENT_MINUTES } from "./days";

export const SOFT_BOUNCED =
  "EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id AND e.kind = 'soft-bounced')";

// Postmark took it SILENT_MINUTES ago or more and has said nothing of it since: no delivery, bounce, soft bounce or
// complaint. Gmail and WhatsApp aren't asked, as Gmail never says, and a text's receipts are WhatsApp's own.
const SILENT = `c.sent_at <= now() - make_interval(mins => ${SILENT_MINUTES})
  AND EXISTS (SELECT 1 FROM mailings g WHERE g.id = c.mailing_id AND g.channel = 'email' AND g.send_by = 'postmark')
  AND NOT EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id AND e.kind <> 'sent')`;

/** Sent, and not there yet, as Postmark is still trying it (a soft bounce) or has said nothing of it (SILENT). */
export const DELAYED = `c.status = 'sent' AND (${SOFT_BOUNCED} OR (${SILENT}))`;
