import "server-only";
import { sendWith, type Purpose, type SendOptions, type SendResult } from "@/lib/email/email.server";
import { gmailAccess } from "./gmail-accounts.server";
import { sendHooks } from "@/lib/email/notifications.server";
import type { Email } from "@/lib/server/outside-services/postmark.server";

// send(): how the site's code sends an email, by Postmark or by a staff
// member's connected Gmail (gmail-accounts.server.ts). It's the sending
// layer's sendWith() (lib/email/email.server.ts), which blocks, logs and
// refuses as it says, with the connected Gmail accounts, which are staff
// accounts', so every feature that sends stands on accounts for it.

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
