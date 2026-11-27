// Pure helpers for the Email your MP tool: picking a campaign and writing
// the letter. Used by the form in the browser and by the server, which
// checks what it's sent against the same campaigns.
import { campaigns, type Campaign, type LetterDetails, type MpStatuses } from "@/lib/content/email-your-mp";
import type { SpamReason } from "@/lib/content/spam-check";
import type { FormResult } from "@/lib/form-result";
import type { QueueReason } from "@/lib/letters/sending.server";
import type { Inline, LetterDoc } from "@/lib/letters/format";
import {
  answerCondition,
  isBlankMailing,
  letterFor,
  type MailingDoc,
  type MailingRecipientValues,
} from "@/lib/mailings/doc";
import { normalisePostcode } from "@/lib/postcodes";
import type { Place } from "@/lib/site-events";

/** An MP as the form sees them. */
export type Mp = {
  name: string;
  /** "Ms Dummy", or built from the name when Parliament has none. */
  salutation: string;
  constituency: string;
  /** null when Parliament lists no email for them. */
  email: string | null;
  /** Their address bounced, so letters can't reach them: the lookup then gives no email. */
  unreachable?: boolean;
};

export type { MpStatuses };

/**
 * What /api/email-your-mp/lookup answers: the MP for a postcode, what
 * they've done for each campaign, and where the postcode is, if known; or
 * why there's none.
 */
export type MpLookup = FormResult<
  "postcode-required" | "not-found" | "no-constituency" | "no-mp" | "failed",
  { mp: Mp; statuses: MpStatuses; place: Place | null }
>;

/**
 * What /api/email-your-mp/letters answers: the letter kept, and sent, or
 * `queued` and why; or why it's refused, and nothing kept.
 */
export type LetterSubmitted = FormResult<
  | SpamReason
  | "missing-fields"
  | "invalid-email"
  | "our-address"
  | "unknown-campaign"
  | "no-recipient"
  | "test-mp-only"
  | "already-sent"
  | "failed",
  { queued?: QueueReason }
>;

export function campaignBySlug(slug: string): Campaign | undefined {
  return campaigns.find((campaign) => campaign.slug === slug);
}

/** The first campaign, in priority order, that makes this ask. */
export function campaignForAsk(ask: string): Campaign | undefined {
  return campaigns.find((campaign) => campaign.ask === ask);
}

/** The campaigns an MP can have done: those with `done`. */
export const trackedCampaigns = campaigns.filter((campaign) => campaign.done !== undefined);

/** The asks staff record a status for by hand: those of the campaigns an MP can have done. */
export const trackedAsks: string[] = trackedCampaigns.map((campaign) => campaign.ask!);

/** Whether the MP has met the campaign's ask. Nobody has done a campaign without `done`. */
export function isDone(campaign: Campaign, statuses: MpStatuses): boolean {
  return campaign.done !== undefined && statuses[campaign.ask] === campaign.done;
}

/**
 * The first campaign, in priority order, that this MP hasn't done. There's
 * always one: the last campaign is one nobody has done.
 */
export function chooseCampaign(statuses: MpStatuses): Campaign {
  return campaigns.find((campaign) => !isDone(campaign, statuses))!;
}

/**
 * Where a campaign's page sends someone whose MP has already done it: the
 * first campaign they haven't. None if they haven't done this one.
 */
export function campaignToMoveTo(campaign: Campaign, statuses: MpStatuses): Campaign | undefined {
  return isDone(campaign, statuses) ? chooseCampaign(statuses) : undefined;
}

/**
 * A campaign's letter as staff publish it (campaign_letters): the subject,
 * and the letter, with the MP's fields and the sender's name
 * (CAMPAIGN_FIELDS), and parts only for MPs with an answer to an ask.
 */
export type CampaignLetter = { id: number; subject: string; body: MailingDoc };

/** Why a campaign's draft letter can't be published as it is: no subject, or no letter. */
export type UnpublishableReason = "no-subject" | "no-letter";

/** What stops a campaign's draft letter being published, if anything. */
export function unpublishable(draft: { subject: string; body: MailingDoc }): UnpublishableReason | undefined {
  if (!draft.subject.trim()) return "no-subject";
  if (isBlankMailing(draft.body)) return "no-letter";
  return undefined;
}

/** The merge fields a campaign's letter can have: the MP's, then the sender's name. */
export const CAMPAIGN_FIELDS = ["salutation", "name", "constituency", "sender"] as const;

/** What a campaign's letter is filled in with for one sender to one MP. */
export function letterValues(details: LetterDetails): MailingRecipientValues {
  return {
    values: {
      salutation: details.salutation,
      name: details.mpName,
      constituency: details.constituency,
      sender: details.senderName,
    },
    meets: Object.entries(details.statuses).flatMap(([ask, status]) => (status ? [answerCondition(ask, status)] : [])),
  };
}

/**
 * The letter the form starts with: the campaign's, filled in for the MP,
 * which ends with the sender's name, then a paragraph of their address, a
 * line each. All of it is theirs to edit, a town added, say, and it's sent
 * as they leave it.
 */
export function draftLetter(letter: MailingDoc, details: LetterDetails, address: string[]): LetterDoc {
  const body = letterFor(letter, letterValues(details));
  const lines = address.flatMap((line, i): Inline[] => [
    ...(i > 0 ? [{ type: "hardBreak" } as const] : []),
    { type: "text", text: line },
  ]);
  return { type: "doc", content: [...body.content, { type: "paragraph", content: lines }] };
}

/**
 * The address the letter starts with, under the sender's name: their first
 * line, then the postcode their MP was found from, unless they typed it.
 */
export function signatureAddress(address: string, postcode: string): string[] {
  const lines = addressLines(address);
  const typed = lines.some((line) => normalisePostcode(line).endsWith(normalisePostcode(postcode)));
  return typed ? lines : [...lines, postcode.trim().toUpperCase()];
}

/** A typed address, as signature lines: trimmed, without blank lines. */
export function addressLines(address: string): string[] {
  return address
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
