import "server-only";
import { LETTER_STATUSES } from "./status";
import { query } from "@/lib/server/db.server";
import type { DeliveryProblem, Purpose } from "@/lib/email/email.server";
import { bounceLink, type PurposeHook } from "@/lib/email/delivery-problems.server";
import { notifyStaff, staffLink } from "@/lib/email/notifications.server";
import { letterEvent, transition } from "./lifecycle.server";
import { noticeToSender } from "./sending.server";
import { relayBounced } from "./relays.server";
import { staffCopy } from "@/lib/content/staff-interface";

// What a bounce or complaint of a letter's email does (each purpose's hook,
// which the sending layer calls once it has recorded the problem:
// lib/email/delivery-problems.server.ts).

/** Tells the notification inbox an MP's address bounced, as nobody can write to them until someone fixes it. */
async function alertBouncedMp(
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
 * Marks a letter bounced or complained about, with an event saying why,
 * whatever its status: the email went, whatever has happened to the letter
 * since. Returns the politician's name.
 */
async function markLetter(letterId: number, problem: DeliveryProblem): Promise<string | undefined> {
  const status = problem.kind === "complaint" ? "spam_complaint" : "bounced";
  const [moved] = await transition(letterId, LETTER_STATUSES, status, {
    event: status,
    details: { ...problem.details, reason: problem.reason, email: problem.address },
  });
  if (!moved) return undefined;
  const [letter] = await query<{ mpName: string }>(
    'SELECT p.name AS "mpName" FROM letters l JOIN notable_people p ON p.id = l.notable_person_id WHERE l.id = $1',
    [moved],
  );
  return letter.mpName;
}

/**
 * A letter's bounce or complaint: the letter says so, and for a hard bounce
 * or complaint, staff are told, as the MP can't be written to until someone
 * fixes their address. One from the sender, who's on Cc, says nothing of the
 * letter.
 */
const letterProblem: PurposeHook = async ({ letterId }, problem, request) => {
  const [fromSender] = await query(
    `SELECT 1 FROM letters_from_supporters s JOIN form_entries f ON f.id = s.entry_id
     WHERE s.id = $1 AND lower(trim(f.email)) = lower(trim($2))`,
    [letterId, problem.address],
  );
  if (fromSender) return false;
  const mpName = await markLetter(letterId!, problem);
  if (!mpName || problem.kind === "soft") return false;
  // One from the letters inbox: its sender is told it hasn't reached their MP, in our own words, never the bounce.
  const [proxied] = await query("SELECT 1 FROM letters_from_supporters WHERE id = $1 AND proxy_id IS NOT NULL", [
    letterId,
  ]);
  if (proxied && problem.kind === "hard") await noticeToSender(letterId!, "bounced");
  await alertBouncedMp(mpName, problem.address, problem.reason, request, bounceLink(problem));
  return true;
};

/**
 * A relay's bounce. One to the MP that bounced hard is marked so, the
 * supporter told and staff alerted, as a letter's is; one to the
 * supporter blocks their address (recordProblem), so later relays to them
 * are held. Either way the letter's history says so; a soft bounce is
 * only noted, as Gmail keeps trying.
 */
const relayProblem: PurposeHook = async ({ letterId, rfcMessageId }, problem, request) => {
  const [toMp] = await query<{ id: number; mpName: string }>(
    `SELECT r.id::int AS id, n.name AS "mpName" FROM letter_relays r JOIN letters l ON l.id = r.letter_id
       JOIN notable_people n ON n.id = l.notable_person_id
     WHERE r.rfc_message_id = $1 AND NOT r.to_supporter`,
    [rfcMessageId],
  );
  await letterEvent(letterId!, problem.kind === "soft" ? "relay_delayed" : "relay_bounced", {
    email: problem.address,
    reason: problem.reason,
  });
  if (!toMp || problem.kind === "soft") return false;
  await relayBounced(toMp.id, letterId!);
  await alertBouncedMp(toMp.mpName, problem.address, problem.reason, request, bounceLink(problem));
  return true;
};

/** The supporter's copy bounced: their address is blocked (recordProblem), and the history says so. */
const copyProblem: PurposeHook = async ({ letterId }, problem) => {
  await letterEvent(letterId!, problem.kind === "soft" ? "copy_delayed" : "copy_bounced", {
    email: problem.address,
    reason: problem.reason,
  });
  return false;
};

/**
 * A mailing's letter's bounce: the letter says so, and its mailing's page
 * counts it. As a mailing goes to many, staff are told of them together, in
 * the day's report (reportMailingBounces).
 */
const mailingProblem: PurposeHook = async ({ letterId }, problem) => {
  await markLetter(letterId!, problem);
  return true;
};

/** What each of letters' emails does about its bounce or complaint. */
export const letterBounces: Partial<Record<Purpose, PurposeHook>> = {
  letter: letterProblem,
  "letter-copy": copyProblem,
  relay: relayProblem,
  mailing: mailingProblem,
};
