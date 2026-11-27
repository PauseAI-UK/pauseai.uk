import "server-only";
import { askClaude } from "@/lib/server/outside-services/anthropic.server";
import { orFallback } from "@/lib/server/outside-services/fallback.server";
import { waitingRoomCopy, waitingRoomProblems } from "./waiting-room-copy";

// The waiting room's check: Claude reads someone's reply to our welcome and
// says whether it reads as a real person answering us, leniently, and pulls
// out the postcode and email they gave. Tried on made-up replies shaped like
// the old waiting room group's, from short sincere ones to adverts and
// gibberish. Claude Haiku, as anthropic.server.ts asks it, is enough.

/** What the check says of a reply. */
export type Checked = {
  verdict: "pass" | "hold";
  /** One sentence for staff on why. */
  reason: string;
  /** A UK postcode, whole or its first half alone, if they gave one. */
  postcode: string | null;
  email: string | null;
};

const SYSTEM = `You check replies to PauseAI UK's WhatsApp waiting room.

PauseAI UK is a UK campaign group that wants a pause on building the most powerful AI. Someone has asked to join our WhatsApp community. We messaged them: "${waitingRoomCopy.texts.welcome}"

Their reply is below. Decide whether it reads as a real person answering us.

Pass any sincere answer from a person, however short, in any language, whatever their reason: worried about AI, its effect on jobs, art, children or the climate, a friend or event told them about us, they want to help, or they're curious. Spelling, grammar and length don't matter. A question back to us is fine if it comes with some reason for joining.

Hold, for a person to check:
- an empty answer: a greeting alone, "ok", emoji alone, or "I want to join" with no reason at all;
- an advert, a promotion, or a link to another group, channel or website;
- gibberish, or text that doesn't answer us;
- anything abusive or threatening.

Our people will read every reply you hold, so when unsure, hold.

Also pull out, only if they gave them: their UK postcode, whole ("LS6 1AA") or its first half alone ("LS6", "E15"), and their email address. An MP's or a town's name is not a postcode.`;

const SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["pass", "hold"] },
    reason: { type: "string", description: "One short sentence for staff on why." },
    postcode: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
  },
  required: ["verdict", "reason", "postcode", "email"],
  additionalProperties: false,
};

/** What Claude says of `reply`, their messages since our welcome; null if it couldn't be asked, which is reported. */
export function checkReply(reply: string): Promise<Checked | null> {
  return orFallback(waitingRoomProblems.checkFailed(), null, async () => {
    const answer = (await askClaude({
      system: SYSTEM,
      prompt: `Their reply:\n<reply>\n${reply}\n</reply>`,
      schema: SCHEMA,
    })) as Checked;
    return { ...answer, postcode: answer.postcode?.trim().toUpperCase() || null, email: answer.email?.trim() || null };
  });
}
