import "server-only";
import { send } from "@/lib/accounts/email-sending.server";
import { GMAIL_DAILY_LIMIT, sentToday } from "@/lib/accounts/gmail-accounts.server";
import { mailbox, type MailingChannel } from "@/lib/letters/channels.server";
import { deliveryProblem, type PostmarkProblem } from "@/lib/email/postmark-webhooks.server";
import { headerName, notifyDomain } from "@/lib/server/outside-services/postmark.server";

// The channels a mailing's messages and a broadcast's go out by, as a
// letter's do (lib/letters/channels.server.ts): email by Postmark, for test
// copies and broadcasts, and by a staff member's Gmail, for mailings.

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
 * (gmail-reading.server.ts), not reported.
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
 * (lib/email/postmark-webhooks.server.ts), which go by the copy's own ID, not through report.
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

/** The channel a mailing is sent by. */
export function mailingChannel(channel: "email" | "text" | "whatsapp"): MailingChannel | undefined {
  return channel === "email" ? gmailEmail : undefined;
}
