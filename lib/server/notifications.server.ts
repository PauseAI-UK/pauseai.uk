import "server-only";
import { config } from "./config.server";
import { now } from "@/lib/now";
import { siteUrlIfKnown } from "@/lib/site-url.server";
import { query } from "./db.server";
import { sendWith, type Purpose, type SendHooks } from "./email.server";
import { nameLine, notifyDomain } from "./outside-services/postmark.server";
import { problem } from "./problems.server";
import { staffCopy } from "@/lib/content/staff-interface";
import { gmailMessageLink } from "@/lib/letters/links";
import { staffAddressLine } from "@/lib/accounts/staff-address.server";

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
 * email, notifications' own and those sent by send() (email-sending.server.ts).
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
    problem(staffCopy.problems.anywhere.noInbox);
    return false;
  }
  const result = await sendWith(
    sendHooks,
    {
      From: `PauseAI UK <noreply@${notifyDomain()}>`,
      To: nameLine(staffCopy.inboxNames.notifications, inbox),
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

/** Tells the notification inbox an MP's address bounced, as nobody can write to them until someone fixes it. */
export async function alertBouncedMp(
  mpName: string,
  address: string,
  reason: string,
  request: Request | undefined,
  bounce?: string,
): Promise<void> {
  await notifyStaff(
    staffCopy.alert.subject(mpName),
    staffCopy.alert.body(mpName, address, reason, staffLink("/staff/politicians/addresses-to-fix", request), bounce),
  );
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
  const words = staffCopy.alert.notALetter;
  const link = staffLink("/staff/politicians/addresses-to-fix", request);
  for (const { name } of politicians) {
    await notifyStaff(words.subject(name), words.body(name, address, reason, link, bounce));
  }
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Emails the notification inbox, at most once a day, each MP in office whose
 * address has bounced or complained about a mailing's letter since it last
 * did (or in the last day), with what its server said. Nothing when none
 * did. Each problem told of says when in its `details`, so this report keeps
 * its own time, whatever other reports go, and one whose email failed is told
 * of next time.
 */
export async function reportMailingBounces(request: Request | undefined): Promise<void> {
  const at = now();
  const [{ last }] = await query<{ last: Date | null }>(
    "SELECT max((details->>'reportedAt')::timestamptz) AS last FROM email_problems",
  );
  const dayAgo = new Date(at.getTime() - DAY);
  if (last && last > dayAgo) return;
  const bounced = await query<{
    id: number;
    name: string;
    address: string;
    reason: string;
    account: string | null;
    gmailId: string | null;
  }>(
    `SELECT pr.id::int AS id, n.name, pr.address, pr.reason, pr.details->>'account' AS account,
       pr.gmail_message_id AS "gmailId"
     FROM email_problems pr JOIN email_sends e ON e.message_id = pr.message_id AND e.purpose = 'mailing'
       JOIN letters l ON l.id = e.letter_id JOIN notable_people n ON n.id = l.notable_person_id
     WHERE pr.kind <> 'soft' AND n.status = 'in_office' AND pr.at > $1 AND pr.details->>'reportedAt' IS NULL
     ORDER BY pr.at, pr.id`,
    [last ?? dayAgo],
  );
  if (!bounced.length) return;
  const words = staffCopy.notifications.mailingBounces;
  const told = await notifyStaff(
    words.subject(bounced.length),
    words.body(
      // Each with a link to its bounce in the Gmail mailbox it came back to, when it came back to one.
      bounced.map(
        ({ name, address, reason, account, gmailId }) =>
          `- ${name} (${address}): ${reason}${account && gmailId ? ` ${gmailMessageLink(account, gmailId)}` : ""}`,
      ),
      staffLink("/staff/politicians/addresses-to-fix", request),
    ),
  );
  if (told) {
    await query(
      "UPDATE email_problems SET details = details || jsonb_build_object('reportedAt', $2::text) WHERE id = ANY($1)",
      [bounced.map(({ id }) => id), at.toISOString()],
    );
  }
}
