import "server-only";
import type { BroadcastChannel } from "@/lib/broadcasts";
import { config } from "./config";
import type { ChannelResult } from "./mailing-channels";

// What sends a message to a supporter once it's written: a real backend for
// each channel is still to come, so on the live site nothing does, and the
// pages say so. A fixture build has a fake, so its flows can be driven whole.

/** One message to one supporter, as a backend sends it. */
export type SupporterMessage = { channel: BroadcastChannel; to: string; subject: string; text: string };

export type BroadcastBackend = { send(message: SupporterMessage): Promise<ChannelResult> };

const fakeBackend: BroadcastBackend = { send: async ({ to }) => ({ sent: true, id: `fake-${to}` }) };

/** What sends texts to supporters, if anything does yet. */
export function broadcastBackend(): BroadcastBackend | undefined {
  return config.fixtures ? fakeBackend : undefined;
}

/** Whether a broadcast by `channel` can be sent: an email always, a text only with a backend. */
export function channelSends(channel: BroadcastChannel): boolean {
  return channel === "email" || Boolean(broadcastBackend());
}

/** The WhatsApp business account's number, as texts appear from it, if one is set. */
export function textSenderNumber(): string | null {
  return config.whatsappNumber ?? null;
}
