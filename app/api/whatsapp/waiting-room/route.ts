// The WhatsApp waiting room's page's endpoint (app/(site)/whatsapp/beta):
// past the spam check, a link that opens a chat with our number, a message
// asking to join typed in it, with the code of the button they came by. Our
// number is in no page, so a bot reading the site doesn't find it. A route
// rather than a Server Action, as an action's ID changes with every build.
import { NextResponse } from "next/server";
import { textSenderNumber } from "@/lib/broadcasts/channels.server";
import { waitingRoomJoinCopy } from "@/lib/content/whatsapp";
import { readJsonIfAny } from "@/lib/server/json.server";
import { checkNotSpam } from "@/lib/server/outside-services/turnstile.server";
import { cameFromCode, chatLink, joinMessage, type ChatLinkResult } from "@/lib/broadcasts/waiting-room";

/** Answers with a ChatLinkResult, always 200. */
export async function POST(request: Request) {
  const body = await readJsonIfAny(request);
  const fields = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return NextResponse.json(await answer(text(fields.turnstileToken), text(fields.utmSource)));
}

async function answer(turnstileToken: string, utmSource: string): Promise<ChatLinkResult> {
  const spam = await checkNotSpam({ turnstileToken });
  if (!spam.drop && spam.reason) return { ok: false, reason: spam.reason };
  const number = await textSenderNumber();
  if (!number) return { ok: false, reason: "closed" };
  return { ok: true, link: chatLink(number, joinMessage(waitingRoomJoinCopy.message, cameFromCode(utmSource))) };
}
