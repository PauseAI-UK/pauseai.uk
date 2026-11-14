import "server-only";
import { BROADCAST_SEND_BY, type BroadcastChannel, type BroadcastSendBy } from "@/lib/broadcasts";
import { staffCopy } from "@/lib/content/staff-interface";
import { config } from "./config";
import { FIXTURE_KEYS } from "./fixtures/whatsapp";
import { gmailEmail, postmarkBroadcast, type MailingChannel } from "@/lib/mailings/channels";
import { businessNumber, type BusinessNumber, type WhatsAppKeys } from "./outside-services/whatsapp";
import { problem } from "./problems";

// What sends a message to a supporter once it's written. An email goes by
// one of the channels mailings go by (mailing-channels.ts), as the broadcast
// says (send_by). A text goes by WhatsApp (outside-services/whatsapp.ts)
// where its keys are set: on the live site alone, and a fixture build's
// fake. Anywhere else, such as a deploy preview, nothing sends a text, and
// the pages say so.

/** The channel each way of sending an email to supporters goes by, and the gap it keeps between two sends, in ms. */
const EMAIL_CHANNELS: Record<BroadcastSendBy, { channel: MailingChannel; gapMs: number }> = {
  // Gmail takes 60 a minute from one account.
  gmail: { channel: gmailEmail, gapMs: 1000 },
  postmark: { channel: postmarkBroadcast, gapMs: 0 },
};

/** What an email to supporters goes by, and its pace. */
export function broadcastEmailChannel(sendBy: BroadcastSendBy): { channel: MailingChannel; gapMs: number } {
  return EMAIL_CHANNELS[sendBy];
}

/**
 * WhatsApp's keys, where they're set. A fixture build without them uses the
 * fake's, as it needs no keys for any other service: its every call goes to
 * the fakes (outside-fetch.ts), so they can't reach Meta.
 */
export function whatsAppKeys(): WhatsAppKeys | undefined {
  const token = config.whatsappToken;
  const accountId = config.whatsappAccountId;
  if (token && accountId) return { token, accountId };
  return config.fixtures ? FIXTURE_KEYS : undefined;
}

/** What sends texts: WhatsApp's keys, and our number there. */
export type TextBackend = { keys: WhatsAppKeys; number: BusinessNumber };

/** What sends texts, if anything does here; undefined too while WhatsApp doesn't answer, which is reported. */
export async function textBackend(): Promise<TextBackend | undefined> {
  const keys = whatsAppKeys();
  if (!keys) return undefined;
  try {
    return { keys, number: await businessNumber(keys) };
  } catch (error) {
    problem(staffCopy.problems.anywhere.whatsAppUnanswered, error);
    return undefined;
  }
}

/**
 * Whether a broadcast by `channel` can be sent: an email by `sendBy`, if
 * that's available yet, Gmail unless it says; a text where WhatsApp's keys
 * are set.
 */
export function channelSends(channel: BroadcastChannel, sendBy: BroadcastSendBy = "gmail"): boolean {
  return channel === "email" ? BROADCAST_SEND_BY[sendBy].available : Boolean(whatsAppKeys());
}

/** Our WhatsApp number, as texts appear from it, if it can be had. */
export async function textSenderNumber(): Promise<string | null> {
  return (await textBackend())?.number.number ?? null;
}
