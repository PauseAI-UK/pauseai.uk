import "server-only";
import { query } from "@/lib/server/db.server";
import type { Purpose } from "@/lib/email/email.server";
import type { PurposeHook } from "@/lib/email/delivery-problems.server";

// What a bounce or complaint of a copy of a broadcast does (its purpose's
// hook, which the sending layer calls once it has recorded the problem:
// lib/email/delivery-problems.server.ts).

/**
 * A copy of a broadcast's bounce or complaint, in its history: a hard
 * bounce marks it failed; a complaint is an opt-out of every bulk email,
 * which recordProblem keeps. A soft bounce changes nothing, as Postmark
 * tries again.
 */
const broadcastProblem: PurposeHook = async (_sent, problem) => {
  if (problem.kind === "soft") return true;
  const kind = problem.kind === "hard" ? "bounced" : "opted-out";
  await query(
    `WITH copy AS (
       UPDATE broadcast_messages SET status = CASE WHEN $2 = 'bounced' THEN 'failed' ELSE status END
       WHERE provider_message_id = $1 RETURNING id)
     INSERT INTO broadcast_message_events (message_id, kind, details)
     SELECT id, $2, jsonb_build_object('reason', $3::text) FROM copy`,
    [problem.messageId, kind, problem.reason],
  );
  return true;
};

/** What broadcasts' emails do about a bounce or complaint. */
export const broadcastBounces: Partial<Record<Purpose, PurposeHook>> = { broadcast: broadcastProblem };
