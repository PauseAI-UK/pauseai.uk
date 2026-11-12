import "server-only";
import type { CivicrmUpdatesResult } from "@/lib/import-runs";
import { staffCopy } from "@/lib/content/staff-interface";
import { query, type Queryable } from "./db";
import {
  updateSubscriptions,
  UPDATE_BATCH,
  type SubscriptionEvent,
  type SubscriptionResult,
} from "./outside-services/civicrm";
import { problem } from "./problems";

// Our opt-outs sent to CiviCRM's updateSubscriptions, so Global's records
// and mail honour them too, and lifts of "No bulk emails" made on the email
// settings page. Each is queued in civicrm_updates in the transaction that
// records it, then sent by the hourly CiviCRM import, before it pulls, and
// tried again each hour until CiviCRM answers it. Only opt-outs go, but
// that one opt-in: a yes on our side stays ours, as CiviCRM's lists are its
// own.

/** What an opt-out of ours is to CiviCRM, if it's anything: the newsletter or volunteering by email, or every bulk email. */
export function civicrmChange(list: string, way: string): Pick<SubscriptionEvent, "change" | "list"> | undefined {
  if (way !== "email") return undefined;
  if (list === "newsletter") return { change: "unsubscribe", list: "newsletter" };
  if (list === "volunteering") return { change: "unsubscribe", list: "volunteer_updates" };
  if (list === "bulk") return { change: "no_bulk_email" };
  return undefined;
}

/** Where a person did it, as CiviCRM is told: our name for the source, as from pauseai.uk. */
const sourceName = (source: string): string => `pauseai.uk:${source}`;

/**
 * Queues an opt-out of ours for CiviCRM, if it's one it takes (civicrmChange)
 * and not one CiviCRM told us of, with the contact ID of the address's
 * contact in the last pull, if it has one. Returns whether it queued it.
 */
export async function queueOptOut(
  optOut: { id: number; address: string; list: string; way: string; source: string; at: Date },
  db?: Queryable,
): Promise<boolean> {
  const change = civicrmChange(optOut.list, optOut.way);
  if (!change || optOut.source === "civicrm" || optOut.source === "civicrm-check") return false;
  await query(
    `INSERT INTO civicrm_updates (opt_out_id, change, list, email, contact_id, occurred_at, source)
     VALUES ($1, $2, $3, $4,
       (SELECT min(contact_id) FROM civicrm_contacts WHERE email = $4 AND gone_at IS NULL), $5, $6)`,
    [optOut.id, change.change, change.list ?? null, optOut.address, optOut.at, sourceName(optOut.source)],
    db,
  );
  return true;
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

/** An update CiviCRM hasn't answered, as kept: null where it has none of a field. */
type Waiting = Omit<SubscriptionEvent, "list" | "contactId" | "wording"> & {
  id: number;
  choiceId: number | null;
  list: SubscriptionEvent["list"] | null;
  contactId: number | null;
  wording: string | null;
};

/** An update as CiviCRM is sent it, with only the fields it has. */
function eventOf({ eventId, email, change, list, contactId, occurredAt, source, wording }: Waiting): SubscriptionEvent {
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
 * newer "No bulk emails" there still stands. Every one sent counts a try.
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
    if (result?.status === "refused" && update.choiceId) {
      await query("UPDATE preference_choices SET refused_at = now() WHERE id = $1", [update.choiceId]);
    }
  }
}

/**
 * Sends every update CiviCRM hasn't answered, oldest first, UPDATE_BATCH a
 * call, so a lift goes before an opt-out made after it. One CiviCRM leaves
 * unanswered, or a call that fails, is tried again next time; a failure
 * stops this run's sending, and is a problem of the run it's in.
 */
export async function sendCivicrmUpdates(key: string): Promise<CivicrmUpdatesResult> {
  const waiting = await query<Waiting>(
    `SELECT id::int AS id, choice_id::int AS "choiceId",
       CASE WHEN opt_out_id IS NULL THEN 'lift:' || choice_id ELSE 'opt-out:' || opt_out_id END AS "eventId",
       email, change, list, contact_id::int AS "contactId", occurred_at AS "occurredAt", source, wording
     FROM civicrm_updates WHERE status IS NULL ORDER BY id`,
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
      problem(staffCopy.problems.job.civicrmUpdatesFailed, error);
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
  if (skipped) problem(staffCopy.problems.job.civicrmUpdatesUnanswered(skipped));
  if (invalid.length) problem(staffCopy.problems.job.civicrmUpdatesInvalid(invalid.length), invalid.join("; "));
  return counts;
}
