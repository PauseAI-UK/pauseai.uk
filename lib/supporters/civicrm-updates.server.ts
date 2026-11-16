import "server-only";
import type { CivicrmUpdatesResult } from "@/lib/import-runs";
import { query, type Queryable } from "@/lib/server/db.server";
import {
  updateSubscriptions,
  UPDATE_BATCH,
  type SubscriptionEvent,
  type SubscriptionResult,
} from "@/lib/server/outside-services/civicrm.server";
import { problem } from "@/lib/server/problems.server";
import { supportersCopy } from "./copy";

// Our opt-outs of email sent to CiviCRM's updateSubscriptions, so Global's
// records and mail honour them too, and the opt-ins a person makes on the
// contact preferences page that CiviCRM takes: a lift of "No bulk emails", and a box ticked for the
// newsletter or volunteering by email, as a resubscribe to its list. Each
// is queued in civicrm_updates in the transaction that records it, then
// sent by the hourly CiviCRM import, before it pulls, oldest first, so an
// opt-in goes after the opt-out it undoes, and the pull sees both. A stop by
// text or call stays ours, as a stop of email never goes as "Do not email":
// CiviCRM's "Do not SMS" and "Do not phone" are a person's word to Global,
// which we honour (contact_permission()) and never set.

/** What an opt-out of ours is to CiviCRM, if it's anything: the newsletter or volunteering by email, or every bulk email. */
export function civicrmChange(list: string, way: string): Pick<SubscriptionEvent, "change" | "list"> | undefined {
  if (way !== "email") return undefined;
  if (list === "newsletter") return { change: "unsubscribe", list: "newsletter" };
  if (list === "volunteering") return { change: "unsubscribe", list: "volunteer_updates" };
  if (list === "bulk") return { change: "no_bulk_email" };
  return undefined;
}

/** What a yes from the contact preferences page is to CiviCRM, if it's anything: a resubscribe to the list it unsubscribes from. */
export function civicrmResubscribe(topic: string, way: string): Pick<SubscriptionEvent, "change" | "list"> | undefined {
  const list = civicrmChange(topic, way)?.list;
  return list && { change: "resubscribe", list };
}

/** Where a person did it, as CiviCRM is told: our name for the source, as from pauseai.uk. */
const sourceName = (source: string): string => `pauseai.uk:${source}`;

/** An opt-out of ours, as queued for CiviCRM. */
type Queued = { id: number; address: string; list: string; way: string; source: string; at: Date };

/**
 * Queues an opt-out of ours for CiviCRM, if it's one it takes (civicrmChange)
 * and not one CiviCRM told us of, with the contact ID of the address's
 * contact in the last pull, if it has one. An unsubscribe from a list goes
 * only for an address the last pull has on it: CiviCRM would mark one never
 * on the list unsubscribed from it, which nothing could undo. Returns
 * whether it queued it.
 */
export async function queueOptOut(optOut: Queued, db?: Queryable): Promise<boolean> {
  if (optOut.source === "civicrm" || optOut.source === "civicrm-check") return false;
  const change = civicrmChange(optOut.list, optOut.way);
  if (!change) return false;
  const queued = await query(
    `INSERT INTO civicrm_updates (opt_out_id, change, list, email, contact_id, occurred_at, source)
     SELECT $1, $2, $3, $4,
       (SELECT min(contact_id) FROM civicrm_contacts WHERE email = $4 AND gone_at IS NULL), $5, $6
     WHERE $3::text IS NULL OR EXISTS (
       SELECT 1 FROM civicrm_contacts c
       WHERE c.email = $4 AND c.gone_at IS NULL
         AND CASE WHEN $3 = 'newsletter' THEN c.newsletter ELSE c.volunteer_updates END = 'subscribed')
     RETURNING id`,
    [optOut.id, change.change, change.list ?? null, optOut.address, optOut.at, sourceName(optOut.source)],
    db,
  );
  return queued.length > 0;
}

/** Queues a lift of "No bulk emails", chosen on the contact preferences page beside `wording`. */
export async function queueBulkLift(
  choice: { id: number; address: string; at: Date; wording: string },
  db?: Queryable,
): Promise<void> {
  await query(
    `INSERT INTO civicrm_updates (choice_id, change, email, occurred_at, source, wording)
     VALUES ($1, 'allow_bulk_email', $2, $3, $4, $5)`,
    [choice.id, choice.address, choice.at, sourceName("preferences"), choice.wording],
    db,
  );
}

/**
 * Queues a resubscribe to a CiviCRM list, for a box ticked on the contact
 * preferences page beside `wording`, if CiviCRM has a list for it
 * (civicrmResubscribe). Returns whether it queued it.
 */
export async function queueResubscribe(
  choice: { id: number; address: string; topic: string; way: string; at: Date; wording: string },
  db?: Queryable,
): Promise<boolean> {
  const change = civicrmResubscribe(choice.topic, choice.way);
  if (!change) return false;
  await query(
    `INSERT INTO civicrm_updates (choice_id, change, list, email, occurred_at, source, wording)
     VALUES ($1, 'resubscribe', $2, $3, $4, $5, $6)`,
    [choice.id, change.list, choice.address, choice.at, sourceName("preferences"), choice.wording],
    db,
  );
  return true;
}

/** An update CiviCRM hasn't answered, as kept: null where it has none of a field. */
type Waiting = Omit<SubscriptionEvent, "list" | "contactId" | "wording"> & {
  id: number;
  choiceId: number | null;
  list: SubscriptionEvent["list"] | null;
  contactId: number | null;
  wording: string | null;
};

/** An update as CiviCRM is sent it, with only the fields it has. */
function eventOf(waiting: Waiting): SubscriptionEvent {
  const { eventId, email, change, list, contactId, occurredAt, source, wording } = waiting;
  return {
    eventId,
    email,
    change,
    occurredAt,
    source,
    ...(list && { list }),
    ...(contactId && { contactId }),
    ...(wording && { wording }),
  };
}

/**
 * Applies CiviCRM's results to the updates sent: each answered is kept with
 * its result, and a refused lift of "No bulk emails" is marked so, as a
 * newer "No bulk emails" there still stands. A refused resubscribe changes
 * nothing of ours: the person's yes stands for what we send, and CiviCRM's
 * list stays as CiviCRM has it. Every one sent counts a try.
 */
async function keepResults(sent: Waiting[], results: Map<string, SubscriptionResult>): Promise<void> {
  for (const update of sent) {
    const result = results.get(update.eventId);
    const reason = result?.reason ?? null;
    await query(
      `UPDATE civicrm_updates SET tries = tries + 1, tried_at = now(),
         status = $2, reason = $3, answered_at = CASE WHEN $2::text IS NULL THEN NULL ELSE now() END
       WHERE id = $1`,
      [update.id, result?.status ?? null, reason],
    );
    if (result?.status === "refused" && update.change === "allow_bulk_email") {
      await query("UPDATE preference_choices SET refused_at = now() WHERE id = $1", [update.choiceId]);
    }
    if (result?.status === "accepted" && update.list) await keepListChange(update);
  }
}

/**
 * Keeps what an accepted unsubscribe or resubscribe made of the address's
 * contacts' list, from when the person did it, as the pull would see it
 * otherwise only after, from when it pulled. So the pull sees no change,
 * and the stop it brings into our records (recordCivicrmLists) is as old as
 * the person's own, and a yes they gave since still wins.
 */
async function keepListChange(update: Waiting): Promise<void> {
  const column = update.list === "newsletter" ? "newsletter" : "volunteer_updates";
  const status = update.change === "unsubscribe" ? "unsubscribed" : "subscribed";
  await query(
    `UPDATE civicrm_contacts SET ${column} = $2, ${column}_since = $3
     WHERE email = $1 AND ${column} <> $2`,
    [update.email, status, update.occurredAt],
  );
}

/**
 * Sends every update of an address CiviCRM hasn't answered, oldest first, UPDATE_BATCH a
 * call, so a lift goes before an opt-out made after it. One CiviCRM leaves
 * unanswered, or a call that fails, is tried again next time; a failure
 * stops this run's sending, and is a problem of the run it's in.
 */
export async function sendCivicrmUpdates(key: string): Promise<CivicrmUpdatesResult> {
  const waiting = await query<Waiting>(
    `SELECT id::int AS id, choice_id::int AS "choiceId",
       CASE WHEN opt_out_id IS NULL THEN 'lift:' || choice_id ELSE 'opt-out:' || opt_out_id END AS "eventId",
       email, change, list, contact_id::int AS "contactId", occurred_at AS "occurredAt", source, wording
     FROM civicrm_updates WHERE status IS NULL AND email IS NOT NULL ORDER BY id`,
  );
  const counts: CivicrmUpdatesResult = { sent: 0, refused: 0, unanswered: 0 };
  const invalid: string[] = [];
  let skipped = 0;
  for (let start = 0; start < waiting.length; start += UPDATE_BATCH) {
    const batch = waiting.slice(start, start + UPDATE_BATCH);
    let results: Map<string, SubscriptionResult>;
    try {
      results = await updateSubscriptions(key, batch.map(eventOf));
    } catch (error) {
      problem(supportersCopy.problems.civicrmUpdatesFailed, error);
      counts.unanswered += waiting.length - start;
      break;
    }
    await keepResults(batch, results);
    for (const update of batch) {
      const result = results.get(update.eventId);
      if (!result) skipped++;
      else if (result.status === "accepted") counts.sent++;
      else if (result.status === "refused") counts.refused++;
      else invalid.push(`${update.eventId}: ${result.reason}`);
    }
  }
  counts.unanswered += skipped + invalid.length;
  if (skipped) problem(supportersCopy.problems.civicrmUpdatesUnanswered(skipped));
  if (invalid.length) problem(supportersCopy.problems.civicrmUpdatesInvalid(invalid.length), invalid.join("; "));
  return counts;
}
