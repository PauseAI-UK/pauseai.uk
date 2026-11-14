import "server-only";
import { sendWith, type Purpose, type SendOptions, type SendResult } from "./email.server";
import { gmailAccess } from "./gmail-accounts.server";
import { sendHooks } from "./notifications.server";
import type { Email } from "@/lib/server/outside-services/postmark.server";

// send(): how the site's code sends an email, by Postmark or by a staff
// member's connected Gmail (gmail-accounts.server.ts). It's sendWith()
// (email.server.ts), which blocks, logs and refuses as it says, with the
// connected Gmail accounts' access. It's apart from sendWith() because the
// connected accounts email staff when Google disconnects one, through
// notifications.server.ts, which sends with sendWith().

const hooks = { ...sendHooks, gmailAccess };

/** Sends an email as sendWith() does, by Postmark or a connected Gmail, telling staff of a politician's address it blocks. */
export function send(
  written: Email,
  purpose: Purpose,
  letterId: number | null = null,
  options: SendOptions = {},
): Promise<SendResult> {
  return sendWith(hooks, written, purpose, letterId, options);
}
