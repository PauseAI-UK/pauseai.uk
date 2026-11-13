import "server-only";
import { send, type Purpose } from "./email";
import { GMAIL_DAILY_LIMIT, sentToday } from "./gmail-accounts";
import { LETTERS_DAILY_LIMIT, lettersInbox } from "./letters-inbox";
import { deliveryProblem, type PostmarkProblem } from "./postmark-webhooks";
import { headerName, notifyDomain, type Attachment } from "./outside-services/postmark";

// How a letter or a mailing's messages go out. A channel sends one message, says how
// many more it can send today and what one costs, and turns its provider's
// report on a message into an event. Each has a fake for fixture builds,
// the dev server and tests, which writes each message to the outbox
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

/** A send, with the Message-ID it went with and its Gmail thread, if it had them; or why not, and whether to try again (SendResult). */
export type ChannelResult =
  | { sent: true; id: string; messageId?: string | null; threadId?: string | null }
  | { sent: false; reason: "blocked" | "failed"; retry?: true };

/** What a provider reported about a message it sent: its ID, and what happened. */
export type ChannelReport = { messageId: string; kind: "delivered" | "failed" | "bounced" | "opted-out" | "replied" };

/**
 * Who an email is from or to, as its header says: their name, in quotes,
 * and address; or with no name the address alone, never a stand-in for one.
 */
const mailbox = ({ name, address }: { name: string | null; address: string }): string =>
  name ? `"${headerName(name)}" <${address}>` : address;

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
 * Email by Postmark, from our notification domain in the sender's name,
 * with replies to them. It sends test copies; a mailing to politicians is
 * sent from the sender's own Gmail, so this one doesn't send mailings.
 */
export const postmarkEmail: MailingChannel = {
  sendsMailings: false,
  send: (message, purpose) =>
    send(
      {
        From: `"${headerName(message.from.name)}" <noreply@${notifyDomain()}>`,
        ReplyTo: `"${headerName(message.from.name)}" <${message.from.address}>`,
        To: mailbox(message.to),
        Subject: message.subject,
        TextBody: message.text,
        HtmlBody: message.html,
        Attachments: message.attachments,
        Tag: purpose,
      },
      purpose,
    ),
  remainingToday: async () => null,
  cost: () => 0,
  report(payload) {
    const problem = deliveryProblem(payload as PostmarkProblem);
    if (!problem?.messageId) return undefined;
    return { messageId: problem.messageId, kind: "bounced" };
  },
};

/**
 * Email by a staff member's connected Gmail, from their own address, as a
 * person writes: one letter at a time, kept in their Sent mail, with
 * replies coming back to them. Its bounces are read from the mailbox
 * (gmail-reading.ts), not reported.
 */
export const gmailEmail: MailingChannel = {
  sendsMailings: true,
  send: (message, purpose) =>
    send(
      {
        // Without a name, Gmail sends it in the account's own.
        From: mailbox(message.from),
        To: mailbox(message.to),
        Subject: message.subject,
        TextBody: message.text,
        HtmlBody: message.html,
        Attachments: message.attachments,
        Headers: message.headers,
      },
      purpose,
      message.letterId ?? null,
      {
        backend: { name: "gmail", account: message.from.address },
        messageId: message.messageId,
        copyId: message.copyId,
      },
    ),
  remainingToday: async (from) => Math.max(0, GMAIL_DAILY_LIMIT - (await sentToday(from))),
  cost: () => 0,
  report: () => undefined,
};

/**
 * Email by Postmark's broadcast stream, for a broadcast to supporters: from
 * the address it's written from, with no limit of ours on how many a day.
 * Its bounces and complaints come by Postmark's webhooks
 * (postmark-webhooks.ts), which go by the copy's own ID, not through report.
 */
export const postmarkBroadcast: MailingChannel = {
  sendsMailings: true,
  send: (message, purpose) =>
    send(
      {
        From: `"${headerName(message.from.name)}" <${message.from.address}>`,
        To: mailbox(message.to),
        Subject: message.subject,
        TextBody: message.text,
        HtmlBody: message.html,
        Attachments: message.attachments,
        Headers: message.headers,
        TrackLinks: "None",
        Tag: purpose,
      },
      purpose,
      null,
      { stream: "broadcast", messageId: message.messageId, copyId: message.copyId },
    ),
  remainingToday: async () => null,
  cost: () => 0,
  report: () => undefined,
};

/**
 * Email by the letters inbox, for a supporter's letter to their MP: from
 * the supporter's proxy, "Jane Smith (via PauseAI)", so the MP's reply
 * comes back through us (letter-sending.ts). Its limit is the inbox's own,
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

/** The channel a mailing is sent by. */
export function mailingChannel(channel: "email" | "text" | "whatsapp"): MailingChannel | undefined {
  return channel === "email" ? gmailEmail : undefined;
}
