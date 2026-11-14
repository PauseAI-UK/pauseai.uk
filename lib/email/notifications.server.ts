import "server-only";
import { config } from "@/lib/server/config.server";
import { siteUrlIfKnown } from "@/lib/site-url.server";
import { query } from "@/lib/server/db.server";
import { sendWith, type Purpose, type SendHooks } from "./email.server";
import { nameLine, notifyDomain } from "@/lib/server/outside-services/postmark.server";
import { problem } from "@/lib/server/problems.server";
import { staffAddressLine } from "./staff-address.server";
import { emailCopy } from "./copy";

// Emails to the notification inbox (NOTIFICATION_INBOX): something on the
// site needs a person. An MP's address bouncing, mail in the letters inbox
// it can't relay, an import failing or held, a Gmail account Google has
// disconnected, letters waiting too long to go. Each is sent once for each
// time it happens, by the code that finds it. Nothing is sent where the
// variable isn't set.

/**
 * The address of `path` on the site, for a link in a notification: from
 * siteUrl(), or where this build can't say, as a Server Action on a local
 * build can't, the path alone.
 */
export function staffLink(path: string, request: Request | undefined): string {
  return siteUrlIfKnown(path, request)?.href ?? path;
}

/**
 * What sending does about an address the provider's refusal just blocked:
 * tells staff if it's a politician's (alertIfPoliticianBlocked). For every
 * email, notifications' own and those sent by send() (lib/accounts/email-sending.server.ts).
 */
export const sendHooks: SendHooks = {
  blocked: (address, reason) => alertIfPoliticianBlocked(address, reason, undefined),
};

/**
 * Emails the notification inbox `subject` and `text`, as a staff alert or
 * report (`purpose`), logged against `letterId` if it's about one letter,
 * and copied to `cc`, a staff member it's about, if any. Says whether it went.
 */
export async function notifyStaff(
  subject: string,
  text: string,
  letterId: number | null = null,
  purpose: Extract<Purpose, "staff-alert" | "staff-report"> = "staff-alert",
  cc?: string,
): Promise<boolean> {
  const inbox = config.notificationInbox;
  if (!inbox) {
    problem(emailCopy.problems.noInbox);
    return false;
  }
  const result = await sendWith(
    sendHooks,
    {
      From: `PauseAI UK <noreply@${notifyDomain()}>`,
      To: nameLine(emailCopy.inboxNames.notifications, inbox),
      ...(cc && { Cc: await staffAddressLine(cc) }),
      Subject: subject,
      TextBody: text,
      Tag: purpose,
    },
    purpose,
    letterId,
  );
  return result.sent;
}

/**
 * Tells the notification inbox of an address just blocked, if it's that of
 * a politician in office, whom the dashboard then shows as waiting on a person.
 * `bounce` links to the bounce in Gmail, for one read from there.
 */
export async function alertIfPoliticianBlocked(
  address: string,
  reason: string,
  request: Request | undefined,
  bounce?: string,
): Promise<void> {
  const politicians = await query<{ name: string }>(
    "SELECT name FROM notable_people WHERE lower(email) = $1 AND status = 'in_office' ORDER BY id",
    [address],
  );
  const words = emailCopy.alert.notALetter;
  const link = staffLink("/staff/politicians/addresses-to-fix", request);
  for (const { name } of politicians) {
    await notifyStaff(words.subject(name), words.body(name, address, reason, link, bounce));
  }
}
