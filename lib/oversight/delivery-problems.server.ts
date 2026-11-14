import "server-only";
import type { DeliveryProblem } from "@/lib/email/email.server";
import { liftBlock } from "@/lib/email/email.server";
import { handleDeliveryProblemWith, type DeliveryHooks } from "@/lib/email/delivery-problems.server";
import { broadcastBounces } from "@/lib/broadcasts/bounces.server";
import { letterBounces } from "@/lib/letters/bounces.server";
import { resendAfterFix } from "@/lib/letters/relays.server";
import { optOutOnComplaint } from "@/lib/supporters/opt-outs.server";

// The sending layer's bounces and complaints (lib/email/delivery-problems.server.ts),
// with what each feature that sends does about its own emails', and the
// unblocking of an address that the pages of blocked addresses do.

/** What letters', broadcasts' and supporters' code does about a bounce or complaint. */
const HOOKS: DeliveryHooks = {
  purposes: { ...letterBounces, ...broadcastBounces },
  complained: optOutOnComplaint,
};

/**
 * Records a bounce or complaint and hands it to its email's purpose
 * (handleDeliveryProblemWith). `request` is the call that brought it, for
 * links in alerts.
 */
export function handleDeliveryProblem(problem: DeliveryProblem, request?: Request): Promise<void> {
  return handleDeliveryProblemWith(HOOKS, problem, request);
}

/**
 * Unblocks an address for staff (liftBlock, which says when it's refused),
 * then sends what the letters inbox held for it (resendAfterFix). Returns
 * whether it was unblocked.
 */
export async function unblock(address: string, staff: string, note: string): Promise<boolean> {
  const unblocked = await liftBlock(address, staff, note);
  if (unblocked) await resendAfterFix({ address });
  return unblocked;
}
