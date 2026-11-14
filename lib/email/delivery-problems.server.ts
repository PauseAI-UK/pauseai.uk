import "server-only";
import { query } from "@/lib/server/db.server";
import { recordProblem, type Complained, type DeliveryProblem, type Purpose } from "./email.server";
import { alertIfPoliticianBlocked } from "./notifications.server";
import { bareAddress } from "@/lib/email-parsing/addresses";
import { gmailMessageLink } from "./gmail-links";

// What happens when an email bounces or is complained about: the address is
// recorded and, for a hard bounce or complaint, blocked (email.server.ts), then the
// email's own purpose decides what else to do. What each purpose does is its
// feature's, handed in as DeliveryHooks (lib/oversight/delivery-problems.server.ts).

/** The email a problem is about, as we sent it. */
export type Sent = { purpose: Purpose; letterId: number | null; rfcMessageId: string | null };

/** What a purpose does about its email's problem. Says whether staff have been told, or will be. */
export type PurposeHook = (sent: Sent, problem: DeliveryProblem, request: Request | undefined) => Promise<boolean>;

/**
 * What the features that send do about a problem: each purpose's own hook,
 * a purpose without one doing nothing more; and what a complaint means.
 */
export type DeliveryHooks = { purposes: Partial<Record<Purpose, PurposeHook>>; complained: Complained };

/** A link to the bounce in the Gmail mailbox it came back to; none for one Postmark reported. */
export function bounceLink({ gmailAccount, gmailMessageId }: DeliveryProblem): string | undefined {
  return gmailAccount && gmailMessageId ? gmailMessageLink(gmailAccount, gmailMessageId) : undefined;
}

/**
 * Records a bounce or complaint, then hands it to the purpose of the email
 * it was about, if we sent it. A politician's address it blocks, from any
 * email or none we can place, is told to staff once, unless its purpose
 * sees to that. `request` is the call that brought it,
 * Postmark's webhook or the job that reads Gmail, for staffLink(); none when
 * staff read Gmail from its page.
 */
export async function handleDeliveryProblemWith(
  hooks: DeliveryHooks,
  problem: DeliveryProblem,
  request?: Request,
): Promise<void> {
  const blocked = await recordProblem(problem, hooks.complained);
  const [sent] = await query<Sent>(
    `SELECT purpose, letter_id::int AS "letterId", rfc_message_id AS "rfcMessageId" FROM email_sends WHERE message_id = $1`,
    [problem.messageId],
  );
  const hook = sent && hooks.purposes[sent.purpose];
  const told = hook ? await hook(sent, problem, request) : false;
  if (blocked && !told) {
    await alertIfPoliticianBlocked(bareAddress(problem.address), problem.reason, request, bounceLink(problem));
  }
}
