import { NextResponse } from "next/server";
import { handleDeliveryProblem } from "@/lib/oversight/delivery-problems.server";
import { deliveryProblem, isPostmark, recordDelivery } from "@/lib/email/postmark-webhooks.server";
import { recordAutoResponder } from "@/lib/letters/inbound.server";
import { readJsonIfAny } from "@/lib/server/json.server";
import { problem } from "@/lib/server/problems.server";
import { serverCopy } from "@/lib/server/copy";

/**
 * Postmark's bounce, spam complaint and delivery webhooks, the bounce one
 * bringing the automatic replies sent to our bounce address too. Says
 * whether it was one it could record.
 */
export async function POST(request: Request) {
  if (!isPostmark(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const payload = await readJsonIfAny(request);
  if (payload === undefined) problem(serverCopy.problems.logs.badBody("Postmark"));
  if (await recordDelivery(payload ?? {})) return NextResponse.json({ recorded: true });
  if (await recordAutoResponder(payload ?? {})) return NextResponse.json({ recorded: true });
  const found = deliveryProblem(payload ?? {});
  if (found) await handleDeliveryProblem(found, request);
  return NextResponse.json({ recorded: !!found });
}
