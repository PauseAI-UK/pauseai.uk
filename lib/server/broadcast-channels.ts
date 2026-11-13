import "server-only";
import { BROADCAST_SEND_BY, type BroadcastChannel, type BroadcastSendBy } from "@/lib/broadcasts";
import { config } from "./config";
import { gmailEmail, postmarkBroadcast, type ChannelResult, type MailingChannel } from "./mailing-channels";

// What sends a message to a supporter once it's written. An email goes by
// one of the channels mailings go by (mailing-channels.ts), as the broadcast
// says (send_by). A text's real backend is still to come, so on the live
// site nothing sends one, and the pages say so; a fixture build has a fake,
// so its flows can be driven whole.

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

/** One message to one supporter, as a backend sends it. */
export type SupporterMessage = { channel: BroadcastChannel; to: string; subject: string; text: string };

export type BroadcastBackend = { send(message: SupporterMessage): Promise<ChannelResult> };

const fakeBackend: BroadcastBackend = { send: async ({ to }) => ({ sent: true, id: `fake-${to}` }) };

/** What sends texts to supporters, if anything does yet. */
export function broadcastBackend(): BroadcastBackend | undefined {
  return config.fixtures ? fakeBackend : undefined;
}

/**
 * Whether a broadcast by `channel` can be sent: an email by `sendBy`, if
 * that's available yet, Gmail unless it says; a text only with a backend.
 */
export function channelSends(channel: BroadcastChannel, sendBy: BroadcastSendBy = "gmail"): boolean {
  return channel === "email" ? BROADCAST_SEND_BY[sendBy].available : Boolean(broadcastBackend());
}

/** The WhatsApp business account's number, as texts appear from it, if one is set. */
export function textSenderNumber(): string | null {
  return config.whatsappNumber ?? null;
}
