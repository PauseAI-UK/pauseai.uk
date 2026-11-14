import "server-only";
import type { Purpose } from "@/lib/email/email.server";
import { send } from "@/lib/accounts/email-sending.server";
import { sentToday } from "@/lib/accounts/gmail-accounts.server";
import { headerName, type Attachment } from "@/lib/server/outside-services/postmark.server";
import { LETTERS_DAILY_LIMIT, lettersInbox } from "./letters-inbox.server";

// How a letter, or any message sent to many, goes out. A channel sends one
// message, says how many more it can send today and what one costs, and
// turns its provider's report on a message into an event. A letter is sent
// by one (sendLetterVia in lifecycle.server.ts): a supporter's by the
// letters inbox's, here; a mailing's and a broadcast's by theirs
// (lib/mailings/channels.server.ts). Each has a fake for fixture builds, the
// dev server and tests, which writes each message to the outbox
// (lib/server/fixtures/outbox.ts); for email, that's sendEmail's own.

/** One message, as a channel sends it. */
export type ChannelMessage = {
  /**
   * The name it's from, and the account it's sent from; and who it's to. The sender's name may be blank, and
   * someone it's to may have none, as a supporter may: it's then to their address alone (mailbox).
   */
  from: { name: string; address: string };
  to: { name: string | null; address: string };
  subject: string;
  html: string;
  text: string;
  attachments: Attachment[];
  /** The letter it is, for a mailing's. */
  letterId?: number;
  /** The copy of a broadcast it is, kept with the try (email_sends). */
  copyId?: number;
  /** The Message-ID it goes with, without its angle brackets, where what it is has one already. */
  messageId?: string;
  /** Other headers, as they're written: a broadcast's unsubscribe link. */
  headers?: { Name: string; Value: string }[];
};

/**
 * A send, with the Message-ID it went with and its Gmail thread, if it had
 * them; or why not, and whether to try again (SendResult). A text can also
 * be refused as the number isn't on WhatsApp (`unreachable`), as the person
 * stopped marketing messages there (`stopped`), or held back a day, as
 * they've had enough marketing messages lately (`held`).
 */
export type ChannelResult =
  | { sent: true; id: string; messageId?: string | null; threadId?: string | null }
  | {
      sent: false;
      reason: "blocked" | "failed" | "unreachable" | "stopped" | "held";
      retry?: true;
      /** The refusal that's to be tried later lasts till someone fixes the account (SendResult). */
      fixNeeded?: true;
      /** Its send broke off with no answer, so the provider may have taken it: it's never sent again (SendResult). */
      mayHaveGone?: true;
      /** What the provider said of a failure, as it said it. */
      detail?: string;
    };

/** What a provider reported about a message it sent: its ID, and what happened. */
export type ChannelReport = { messageId: string; kind: "delivered" | "failed" | "bounced" | "opted-out" | "replied" };

/**
 * Who an email is from or to, as its header says: their name, made safe
 * for it and in quotes, and address; or the address alone, with no name or
 * one that's nothing once made safe, never a stand-in for one.
 */
export function mailbox({ name, address }: { name: string | null; address: string }): string {
  const safe = headerName(name ?? "");
  return safe ? `"${safe}" <${address}>` : address;
}

export type MailingChannel = {
  /** Whether it sends a scheduled mailing. One that doesn't yet still sends test copies. */
  sendsMailings: boolean;
  send(message: ChannelMessage, purpose: Purpose): Promise<ChannelResult>;
  /** How many more it can send from `from` today; null for no limit. */
  remainingToday(from: string): Promise<number | null>;
  /** What one message costs, in pence. */
  cost(message: ChannelMessage): number;
  report(payload: unknown): ChannelReport | undefined;
};

/**
 * Email by the letters inbox, for a supporter's letter to their MP: from
 * the supporter's proxy, "Jane Smith (via PauseAI)", so the MP's reply
 * comes back through us (lib/letters/sending.server.ts). Its limit is the inbox's own,
 * lower than Gmail's.
 */
export const lettersInboxEmail: MailingChannel = {
  sendsMailings: false,
  send: (message, purpose) =>
    send(
      {
        From: `"${headerName(message.from.name)} (via PauseAI)" <${message.from.address}>`,
        To: mailbox(message.to),
        Subject: message.subject,
        TextBody: message.text,
        HtmlBody: message.html,
        Attachments: message.attachments,
      },
      purpose,
      message.letterId ?? null,
      { backend: { name: "gmail", account: lettersInbox()! } },
    ),
  remainingToday: async () => Math.max(0, LETTERS_DAILY_LIMIT - (await sentToday(lettersInbox()!))),
  cost: () => 0,
  report: () => undefined,
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** `channel`, each send at least `gap` ms after the one before, as its provider's pace allows. */
export function paced(channel: MailingChannel, gap: number): MailingChannel {
  let last = 0;
  return {
    ...channel,
    async send(message, purpose) {
      await wait(Math.max(0, last + gap - Date.now()));
      last = Date.now();
      return channel.send(message, purpose);
    },
  };
}
