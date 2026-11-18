import "server-only";
import { BROADCAST_SEND_BY, DEFAULT_SEND_BY, type BroadcastChannel, type BroadcastSendBy } from "./broadcasts";
import { config } from "@/lib/server/config.server";
import { FIXTURE_KEYS } from "@/lib/server/fixtures/whatsapp";
import { gmailEmail, postmarkBroadcast } from "@/lib/mailings/channels.server";
import type { MailingChannel } from "@/lib/letters/channels.server";
import { businessNumber, type BusinessNumber, type WhatsAppKeys } from "@/lib/server/outside-services/whatsapp.server";
import { problem } from "@/lib/server/problems.server";
import { broadcastsCopy } from "./copy";

// What sends a message to a supporter once it's written. An email goes by
// one of the channels mailings go by (mailing-channels.ts), as the broadcast
// says (send_by). A text goes by WhatsApp (outside-services/whatsapp.server.ts)
// where its keys are set: on the live site alone, and a fixture build's
// fake. Anywhere else, such as a deploy preview, nothing sends a text, and
// the pages say so.

/** The channel each way of sending an email to supporters goes by, and the gap it keeps between two sends, in ms. */
const EMAIL_CHANNELS: Record<BroadcastSendBy, { channel: MailingChannel; gapMs: number }> = {
  // Gmail takes 60 a minute from one account: 3,600 an hour.
  gmail: { channel: gmailEmail, gapMs: 1000 },
  // Postmark asks for no more than 20,000 an hour on a broadcast stream's first day
  // (https://postmarkapp.com/support/article/can-i-send-bulk-emails). 180ms apart is 333 a minute, 20,000 an hour
  // sending without a break; as the sending runs about 12 minutes in each 15 (RUN_MS in
  // netlify/functions/send-mailings-background), about 16,000 an hour in all.
  postmark: { channel: postmarkBroadcast, gapMs: 180 },
};

/** What an email to supporters goes by, and its pace. */
export function broadcastEmailChannel(sendBy: BroadcastSendBy): { channel: MailingChannel; gapMs: number } {
  return EMAIL_CHANNELS[sendBy];
}

/**
 * WhatsApp's keys, where they're set. A fixture build without them uses the
 * fake's, as it needs no keys for any other service: its every call goes to
 * the fakes (outside-fetch.server.ts), so they can't reach Meta.
 */
export function whatsAppKeys(): WhatsAppKeys | undefined {
  const token = config.whatsappToken;
  const accountId = config.whatsappAccountId;
  if (token && accountId) return { token, accountId };
  return config.fixtures ? FIXTURE_KEYS : undefined;
}

/** What sends texts: WhatsApp's keys, and our number there. */
export type TextBackend = { keys: WhatsAppKeys; number: BusinessNumber };

/** How long our number and its daily limit are kept once Meta has said them: the number never changes, and the limit seldom. */
export const NUMBER_KEPT_MS = 10 * 60_000;

/**
 * Our number as Meta last said it, for each set of keys, and when it was
 * asked: kept in this server's memory, so the many things that need it
 * (a broadcast's page, its changes, the sending) ask Meta once in
 * NUMBER_KEPT_MS, not each time, and those that ask at once share the one
 * question. One Meta didn't answer isn't kept, so the next asks again.
 */
const numbers = new Map<string, { at: number; number: Promise<BusinessNumber> }>();

/** Forgets the number Meta said, so the next to need it asks: for a test, which sets Meta's answers its own way. */
export function forgetNumbers(): void {
  numbers.clear();
}

/** Where the number for these keys is kept. */
const numberKey = (keys: WhatsAppKeys) => `${keys.accountId} ${keys.token}`;

/** Our number, as kept, or asked of Meta now. */
function numberFor(keys: WhatsAppKeys): Promise<BusinessNumber> {
  const kept = numbers.get(numberKey(keys));
  if (kept && Date.now() - kept.at < NUMBER_KEPT_MS) return kept.number;
  const number = businessNumber(keys);
  numbers.set(numberKey(keys), { at: Date.now(), number });
  return number;
}

/**
 * What sends texts, if anything does here; undefined too while WhatsApp
 * doesn't answer, which is reported, and isn't kept, so the next asks again.
 */
export async function textBackend(): Promise<TextBackend | undefined> {
  const keys = whatsAppKeys();
  if (!keys) return undefined;
  try {
    return { keys, number: await numberFor(keys) };
  } catch (error) {
    numbers.delete(numberKey(keys));
    problem(broadcastsCopy.problems.whatsAppUnanswered, error);
    return undefined;
  }
}

/**
 * Whether a broadcast by `channel` can be sent: an email by `sendBy`, if
 * that's available yet, by what a new one is unless it says; a text where
 * WhatsApp's keys are set.
 */
export function channelSends(channel: BroadcastChannel, sendBy: BroadcastSendBy = DEFAULT_SEND_BY): boolean {
  return channel === "email" ? BROADCAST_SEND_BY[sendBy].available : Boolean(whatsAppKeys());
}

/** Our WhatsApp number, as texts appear from it, if it can be had. */
export async function textSenderNumber(): Promise<string | null> {
  return (await textBackend())?.number.number ?? null;
}
