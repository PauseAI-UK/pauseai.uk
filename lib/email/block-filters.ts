// What the list of blocked addresses and numbers can be filtered by
// (lib/oversight/blocks.server.ts): what blocked one, and what kind of email
// or text found it out.

/** What blocks an address or number: a hard bounce, a complaint, a hold in CiviCRM, or WhatsApp refusing a text. */
export const BLOCK_KINDS = ["hard", "complaint", "hold", "not-on-whatsapp"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

/**
 * What found an address or number out: a broadcast (an email or a text),
 * a letter or something to do with one, a mailing, any other email the site
 * sent, or nothing the site has a record of sending, as for a hold.
 */
export const FOUND_BY = ["broadcast", "letter", "mailing", "other", "unrecorded"] as const;
export type FoundBy = (typeof FOUND_BY)[number];

/** Which blocks to list: by what blocked them, what found them out, and those with `search` in their address or number. */
export type BlocksFilter = { kind?: BlockKind; found?: FoundBy; search?: string };

/** A page of the list. */
export const BLOCKS_PAGE_SIZE = 100;
