import { NextResponse, type NextRequest } from "next/server";
import { staffCopy } from "@/lib/content/staff-interface";
import { config } from "@/lib/server/config.server";
import { parseJsonIfAny } from "@/lib/server/json.server";
import { signedByMeta } from "@/lib/server/outside-services/whatsapp.server";
import { problem } from "@/lib/server/problems.server";
import { recordWhatsAppWebhook, type WhatsAppWebhook } from "@/lib/server/whatsapp-webhooks.server";
import { verifyToken } from "@/lib/server/whatsapp-verify-token.mjs";

/**
 * Meta checking the callback URL as it's set in the App Dashboard: it sends
 * the verify token (`npm run whatsapp:verify-token`), and gets back its
 * challenge if it's ours.
 */
export async function GET(request: NextRequest) {
  const secret = config.whatsappAppSecret;
  const params = request.nextUrl.searchParams;
  const ours =
    secret && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === verifyToken(secret);
  if (!ours) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  return new Response(params.get("hub.challenge") ?? "", { headers: { "Content-Type": "text/plain" } });
}

/**
 * WhatsApp's webhook, signed with the Meta app's secret: what became of
 * texts, messages to us, stops and resumes, and what it decided of
 * templates (lib/server/whatsapp-webhooks.server.ts). Says how many changes it applied, in the
 * answer and the function's log. 500 on a failure to, so Meta sends it again.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const secret = config.whatsappAppSecret;
  if (!secret || !signedByMeta(secret, body, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const payload = parseJsonIfAny(body) as WhatsAppWebhook | undefined;
  if (payload === undefined) return NextResponse.json({ error: "Not JSON" }, { status: 400 });
  try {
    const applied = await recordWhatsAppWebhook(payload);
    console.info(`WhatsApp webhook: ${applied} applied`);
    return NextResponse.json({ applied });
  } catch (error) {
    problem(staffCopy.problems.logs.whatsAppWebhookNotRecorded, error);
    return NextResponse.json({ error: "Not recorded" }, { status: 500 });
  }
}
