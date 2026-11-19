import "server-only";
import { emailBlocks, inScope, type EmailBlock, type EmailScope, type Purpose } from "@/lib/email/email.server";
import { numberBlocks, numberEvents, type NumberBlock } from "@/lib/broadcasts/unreachable.server";
import { query } from "@/lib/server/db.server";
import { sql, type Sql } from "@/lib/server/sql.server";
import { phoneNumber } from "@/lib/phone";
import type { BlockSort } from "@/lib/staff-lists";
import { BLOCKS_PAGE_SIZE, type BlockKind, type BlocksFilter, type FoundBy } from "@/lib/email/block-filters";

// The blocked addresses and numbers, in one list: an address blocked by a
// bounce, a complaint or a hold (email_blocks), and a number WhatsApp
// couldn't deliver to (whatsapp_unreachable). A politician's address is on
// the politicians' list; every other, and every number, on the other.

/** What kind of email or text each purpose is, for the list's filter of what found an address out. */
const FOUND_BY_PURPOSE: Record<Purpose, Exclude<FoundBy, "unrecorded">> = {
  broadcast: "broadcast",
  "broadcast-answer": "broadcast",
  letter: "letter",
  "letter-copy": "letter",
  relay: "letter",
  "supporter-notice": "letter",
  "office-notice": "letter",
  "forwarded-reply": "letter",
  mailing: "mailing",
  "mailing-test": "mailing",
  "bulk-notice": "other",
  "preferences-link": "other",
  "staff-login": "other",
  "staff-alert": "other",
  "staff-report": "other",
};

/**
 * What was being sent when the block `k` came, from its purpose, a number's
 * always a broadcast; or with none, a hold, a bounce read from a mailbox, or
 * one the site can't place.
 */
const FOUND = sql.raw(
  `CASE ${Object.entries(FOUND_BY_PURPOSE)
    .map(([purpose, found]) => `WHEN k.purpose = '${purpose}' THEN '${found}'`)
    .join(" ")} WHEN k.kind = 'hold' THEN 'held' WHEN k.mailbox THEN 'mailbox' ELSE 'unrecorded' END`,
);

/** Who told us of the block `k` (BACKENDS), as problemSource says it for a row. */
const BACKEND = sql.raw(
  `CASE WHEN k.channel = 'text' THEN 'whatsapp' WHEN k.kind = 'hold' THEN 'civicrm' WHEN k.mailbox THEN 'gmail' ELSE 'postmark' END`,
);

/**
 * How many times the block `k` has stopped an email or a text: as `refused`
 * is counted for an email (emailBlocks in lib/email/email.server.ts) and for
 * a number (numberBlocks in lib/broadcasts/unreachable.server.ts), which
 * this must keep to. Worked out only to sort by.
 */
const REFUSED = sql.raw(`CASE WHEN k.channel = 'email'
  THEN (SELECT count(*) FROM email_sends s WHERE s.address = k.address AND s.outcome = 'refused' AND s.at >= k.at)
  ELSE (SELECT count(*) FROM broadcast_messages c JOIN whatsapp_unreachable u ON u.number = c.address
        WHERE c.address = k.address AND c.skip_reason = 'not-on-whatsapp' AND c.id IS DISTINCT FROM u.message_id) END`);

/** What each sortable column sorts the blocks `k` by. */
const SORTS: Record<BlockSort, Sql> = {
  address: sql`k.address`,
  kind: sql`k.kind`,
  backend: BACKEND,
  sent: FOUND,
  refused: REFUSED,
  since: sql`k.at`,
};

/** Something that happened to a blocked address or number, for its history. */
export type BlockEvent =
  /** A bounce, soft too, a complaint or a hold: the provider's or CiviCRM's words, and the mailbox a bounce was read from. */
  | { at: Date; what: "hard" | "soft" | "complaint" | "hold"; reason: string; mailbox: string | null }
  /** A text WhatsApp refused, or one skipped as it had. */
  | { at: Date; what: "refused" | "skipped"; copy: NonNullable<NumberBlock["copy"]> }
  /** Staff unblocked it, saying why. */
  | { at: Date; what: "unblocked"; by: string; note: string };

/** A blocked address or number, for the staff interface: an email's block, or a number's as one. */
export type Block = Omit<EmailBlock, "kind"> & {
  channel: "email" | "text";
  kind: BlockKind;
  /** What was being sent when it was blocked, as the list's filter has it. */
  found: FoundBy;
  /** For a number, when texts try it again, past or to come. */
  triesFrom: Date | null;
  /** Newest first. */
  history: BlockEvent[];
};

/** A number's block, as an email's is. */
function asBlock(number: NumberBlock): Omit<Block, "history" | "found"> {
  return {
    channel: "text",
    address: number.number,
    kind: "not-on-whatsapp",
    reason: "",
    since: number.since,
    canReset: true,
    foundInGmail: false,
    mailbox: null,
    politicians: [],
    supporters: number.supporters,
    letter: null,
    purpose: "broadcast",
    copy: number.copy,
    refused: number.refused,
    triesFrom: number.triesFrom,
  };
}

/**
 * The blocks in `scope` that `filter` lets through, newest first: the
 * page'th BLOCKS_PAGE_SIZE of them, or every one for "all", and how many
 * there are. A page's rows are found first, then built (docs/code-structure.md,
 * "How fast a query has to be").
 */
export async function listBlocks(
  scope: EmailScope,
  filter: BlocksFilter,
  page: number | "all",
): Promise<{ total: number; blocks: Block[] }> {
  const numbers = scope === "others";
  const keys = sql`(SELECT 'email' AS channel, b.address, p.at, p.kind,
      (SELECT s.purpose FROM email_sends s WHERE s.message_id = p.message_id) AS purpose,
      p.gmail_message_id IS NOT NULL AS mailbox
    FROM email_blocks b JOIN email_problems p ON p.id = b.problem_id WHERE ${sql.raw(inScope("b.address", scope))}
    ${numbers ? sql`UNION ALL SELECT 'text', u.number, u.at, 'not-on-whatsapp', 'broadcast', false FROM whatsapp_unreachable u` : sql``}) k`;
  const number = filter.search && phoneNumber(filter.search);
  const where = sql.where([
    ...(filter.kind ? [sql`k.kind = ${filter.kind}`] : []),
    ...(filter.backend ? [sql`${BACKEND} = ${filter.backend}`] : []),
    ...(filter.found ? [sql`${FOUND} = ${filter.found}`] : []),
    ...(filter.search
      ? [sql.or([sql`k.address ILIKE ${`%${filter.search}%`}`, ...(number ? [sql`k.address = ${number}`] : [])])]
      : []),
  ]);
  const paged = page === "all" ? sql`` : sql`LIMIT ${BLOCKS_PAGE_SIZE} OFFSET ${(page - 1) * BLOCKS_PAGE_SIZE}`;
  const { key, dir } = filter.sort ?? { key: "since", dir: "desc" };
  // Then newest first, and by address, so a page's rows are always the same ones.
  const order = sql`ORDER BY ${SORTS[key]} ${sql.raw(dir === "asc" ? "ASC" : "DESC")}, k.at DESC, k.address`;
  const [[{ total }], rows] = await Promise.all([
    query<{ total: number }>(sql`SELECT count(*)::int AS total FROM ${keys} ${where}`),
    query<{ channel: "email" | "text"; address: string; found: FoundBy }>(
      sql`SELECT k.channel, k.address, ${FOUND} AS found FROM ${keys} ${where} ${order} ${paged}`,
    ),
  ]);
  const of = (channel: "email" | "text") => rows.filter((row) => row.channel === channel).map((row) => row.address);
  const [emails, texts, histories] = await Promise.all([
    emailBlocks(of("email"), numbers),
    numberBlocks(of("text")),
    blockHistories(of("email"), of("text")),
  ]);
  const built = new Map<string, Omit<Block, "history" | "found">>([
    ...emails.map((block) => [block.address, { ...block, channel: "email", triesFrom: null }] as const),
    ...texts.map((block) => [block.number, asBlock(block)] as const),
  ]);
  return {
    total,
    blocks: rows.map((row) => ({
      ...built.get(row.address)!,
      found: row.found,
      history: histories.get(row.address) ?? [],
    })),
  };
}

/**
 * Each address's and number's history, newest first: an address's bounces
 * and complaints, soft ones too, and holds; a number's texts WhatsApp
 * refused or that were skipped as it had; and either's unblocking.
 */
async function blockHistories(addresses: string[], numbers: string[]): Promise<Map<string, BlockEvent[]>> {
  const [problems, unblocks, texts] = await Promise.all([
    query<{
      address: string;
      at: Date;
      what: "hard" | "soft" | "complaint" | "hold";
      reason: string;
      mailbox: string | null;
    }>(
      `SELECT p.address, p.at, p.kind AS what, p.reason,
         CASE WHEN p.gmail_message_id IS NOT NULL THEN p.details->>'account' END AS mailbox
       FROM email_problems p WHERE p.address = ANY($1)`,
      [addresses],
    ),
    query<{ address: string; at: Date; by: string; note: string }>(
      `SELECT a.details->>'address' AS address, a.at, a.actor AS by, a.details->>'note' AS note
       FROM audit_log a WHERE a.action = 'unblock address' AND a.details->>'address' = ANY($1)`,
      [[...addresses, ...numbers]],
    ),
    numberEvents(numbers),
  ]);
  const events: [string, BlockEvent][] = [
    ...problems.map(({ address, ...problem }) => [address, problem] as [string, BlockEvent]),
    ...unblocks.map(({ address, ...unblock }) => [address, { ...unblock, what: "unblocked" }] as [string, BlockEvent]),
    ...texts.map(
      ({ number, at, refused, copy }) =>
        [number, { at, what: refused ? "refused" : "skipped", copy }] as [string, BlockEvent],
    ),
  ];
  const histories = new Map<string, BlockEvent[]>();
  for (const [address, event] of events.sort(([, a], [, b]) => b.at.getTime() - a.at.getTime())) {
    histories.set(address, [...(histories.get(address) ?? []), event]);
  }
  return histories;
}
