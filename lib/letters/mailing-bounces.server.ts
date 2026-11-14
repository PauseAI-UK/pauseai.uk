import "server-only";
import { now } from "@/lib/now";
import { query } from "@/lib/server/db.server";
import { notifyStaff, staffLink } from "@/lib/email/notifications.server";
import { gmailMessageLink } from "@/lib/email/gmail-links";
import { staffCopy } from "@/lib/content/staff-interface";

// The day's report to staff of the MPs whose addresses bounced a mailing's
// letters, which the letters inbox's hourly run sends (queue.server.ts).

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
