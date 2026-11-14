import "server-only";
import { sendWith, type Purpose, type SendOptions, type SendResult } from "./email";
import { gmailAccess } from "@/lib/accounts/gmail-accounts";
import { sendHooks } from "./notifications";
import type { Email } from "./outside-services/postmark";

// send(): how the site's code sends an email, by Postmark or by a staff
// member's connected Gmail (gmail-accounts.ts). It's sendWith() (email.ts),
// which blocks, logs and refuses as it says, with what it needs from the
// modules above that one.

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
