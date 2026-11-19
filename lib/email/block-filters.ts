import type { BlockSort } from "@/lib/staff-lists";
import type { SortSpec } from "@/lib/staff-sort";

// What the list of blocked addresses and numbers can be filtered by
// (lib/oversight/blocks.server.ts): what blocked one, and what kind of email
// or text found it out.

/** What blocks an address or number: a hard bounce, a complaint, a hold in CiviCRM, or WhatsApp refusing a text. */
export const BLOCK_KINDS = ["hard", "complaint", "hold", "not-on-whatsapp"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

/**
 * What was being sent when an address or number was blocked: a broadcast
 * (an email or a text), a letter or something to do with one, a mailing, or
 * any other email the site sent; or nothing the site sent, as it's a hold in
 * CiviCRM, a bounce of an email sent from a mailbox, or a bounce the site
 * can't place.
 */
export const FOUND_BY = ["broadcast", "letter", "mailing", "other", "held", "mailbox", "unrecorded"] as const;
export type FoundBy = (typeof FOUND_BY)[number];

/**
 * Who told us of a block: Postmark, of a bounce or complaint; a staff
 * member's Gmail, where a bounce was read; CiviCRM, of a hold; or WhatsApp,
 * refusing a text.
 */
export const BACKENDS = ["postmark", "gmail", "civicrm", "whatsapp"] as const;
export type BlockBackend = (typeof BACKENDS)[number];

/**
 * Which blocks to list: by what blocked them, who told us, what found them
 * out, and those with `search` in their address or number; and in what
 * order, newest blocked first without one.
 */
export type BlocksFilter = {
  kind?: BlockKind;
  backend?: BlockBackend;
  found?: FoundBy;
  search?: string;
  sort?: SortSpec<BlockSort>;
};

/** A page of the list. */
export const BLOCKS_PAGE_SIZE = 100;
