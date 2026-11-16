import "server-only";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { checkMailingDoc, type MailingRecipientValues } from "@/lib/mailings/doc";
import { emailFor } from "@/lib/mailings/drafts.server";
import { siteUrl } from "@/lib/site-url.server";
import type { ChannelMessage } from "@/lib/letters/channels.server";
import type { Attachment } from "@/lib/server/outside-services/postmark.server";

/** Where an email's unsubscribe links go: the contact preferences page at its foot, and the one click in its headers. */
export type UnsubscribeLinks = { settings: string; oneClick: string };

/** A copy's own unsubscribe links, by its token. */
export const copyLinks = (token: string): UnsubscribeLinks => ({
  settings: siteUrl(`/contact-preferences/m/${token}`, undefined).toString(),
  oneClick: siteUrl(`/api/unsubscribe/${token}`, undefined).toString(),
});

/**
 * A test copy's links, which change nothing: the contact preferences page
 * itself, where anyone asks for a link of their own, and a one click whose
 * token is no copy's, so it unsubscribes no one.
 */
export const testLinks = (): UnsubscribeLinks => ({
  settings: siteUrl("/contact-preferences", undefined).toString(),
  oneClick: siteUrl("/api/unsubscribe/test-copy", undefined).toString(),
});

/**
 * A broadcast's email as one person gets it: its words for them and its
 * files, from its sender, with its unsubscribe links at its foot and in its
 * headers.
 */
export function broadcastEmail(
  broadcast: { subject: string; body: unknown; sentFrom: string; fromName: string },
  to: { address: string; values: MailingRecipientValues & { name: string | null } },
  links: UnsubscribeLinks,
  attachments: Attachment[],
): ChannelMessage {
  const { html, text } = emailFor({ subject: broadcast.subject, body: checkMailingDoc(broadcast.body)! }, to.values);
  const footer = emailSettingsCopy.footer;
  return {
    from: { name: broadcast.fromName, address: broadcast.sentFrom },
    to: { name: to.values.name, address: to.address },
    subject: broadcast.subject,
    text: `${text}\n\n--\n${footer.text(links.settings)}`,
    html: `${html}<hr><p style="font-size:13px;color:#666">${footer.html(links.settings)}</p>`,
    attachments,
    headers: [
      { Name: "List-Unsubscribe", Value: `<${links.oneClick}>` },
      { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
    ],
  };
}
