import StaffLink from "../ui/StaffLink";
import ChannelIcon from "@/components/ui/ChannelIcon";
import { Muted } from "@/components/ui/Text";
import type { Block } from "@/lib/oversight/blocks.server";
import { BLOCKS_PAGE_SIZE } from "@/lib/email/block-filters";
import type { DownloadFormat } from "@/lib/staff-list";
import { now } from "@/lib/now";
import { phoneWords } from "@/lib/phone";
import { staffDate, staffTime } from "@/lib/staff-time";
import Reason, { problemSource } from "../email/BounceReason";
import LetterLink from "../letters/LetterLink";
import { UnblockBubble } from "../email/UnblockForm";
import IconText from "../ui/IconText";
import ListFrame, { type ListColumn } from "../ui/ListFrame";
import TestTag from "../ui/TestTag";
import BlockHistory, { copyPath } from "./BlockHistory";
import { supportersCopy } from "../supporters/copy";
import { emailCopy } from "@/lib/email/copy";
import styles from "./BlocksTable.module.css";

const copy = emailCopy.emails;

/** A supporter's name, or that they have none. */
const supporterName = (s: Block["supporters"][number]) => s.name ?? supportersCopy.supporters.noName;

/**
 * What found an address or number out, in words: a letter, by whom it was
 * to; what the site sent, with a broadcast's title; for a hold, that it's
 * CiviCRM's; for a bounce read from a mailbox of an email the site has no
 * record of, that mailbox; or null, for none of these.
 */
function foundWords(block: Block): string | null {
  if (block.letter) return `${copy.letterTo} ${block.letter.to}`;
  if (block.purpose) return [copy.purposes[block.purpose], block.copy?.title].filter(Boolean).join(": ");
  if (block.kind === "hold") return copy.held;
  return block.mailbox ? copy.fromMailbox(block.mailbox) : null;
}

/** Why it's blocked: the provider's words for an address; for a number, that WhatsApp refused, and when texts try it again. */
function reasonWords(block: Block): string {
  if (!block.triesFrom) return block.reason;
  return block.triesFrom > now() ? copy.triesFrom(staffDate(block.triesFrom)) : copy.triesNext;
}

/**
 * The blocked addresses' and numbers' columns, as every list's go
 * (docs/style-guide.md): the address or number and whose, politicians'
 * then supporters', each linked to their page; what blocked it, by email
 * or text, why, and what found it out (a letter linked with `letterLinks`,
 * a broadcast's copy always); how many emails or texts haven't gone since;
 * since when; and with `unblock`, buttons that open its history and the way
 * to unblock it, which a download leaves out.
 */
export function blockColumns(
  letterLinks: boolean,
  unblock?: (form: FormData) => void | Promise<void>,
): ListColumn<Block>[] {
  const columns: ListColumn<Block>[] = [
    {
      key: "address",
      label: copy.columns.address,
      text: (b) => b.address,
      cell: (b) => (b.channel === "text" ? phoneWords(b.address) : b.address),
    },
    {
      key: "whose",
      label: copy.columns.whose,
      words: "name",
      text: (b) => [...b.politicians.map((p) => p.name), ...b.supporters.map(supporterName)].join("; "),
      cell: (b) => [
        ...b.politicians.map((p, i) => (
          <span key={`p${p.id}`}>
            {i > 0 && ", "}
            <StaffLink href={`/staff/politicians/${p.id}`}>{p.name}</StaffLink>
            <TestTag isTest={p.isTest} />
          </span>
        )),
        ...b.supporters.map((s, i) => (
          <span key={`s${s.id}`}>
            {(i > 0 || b.politicians.length > 0) && ", "}
            <StaffLink href={`/staff/supporters/${s.id}`}>{supporterName(s)}</StaffLink>
          </span>
        )),
      ],
    },
    {
      key: "kind",
      label: copy.columns.kind,
      short: true,
      text: (b) => copy.kinds[b.kind],
      cell: (b) => <IconText icon={<ChannelIcon channel={b.channel} />}>{copy.kinds[b.kind]}</IconText>,
    },
    {
      key: "reason",
      label: copy.columns.reason,
      text: (b) => `${reasonWords(b)} (${problemSource(b)})`,
      cell: (b) => <Reason reason={reasonWords(b)} kind={b.kind} foundInGmail={b.foundInGmail} />,
    },
    {
      key: "sent",
      label: copy.columns.sent,
      words: "name",
      text: foundWords,
      cell: (b) =>
        b.letter ? (
          <LetterLink letter={b.letter} linked={letterLinks} />
        ) : b.copy ? (
          <StaffLink href={copyPath(b.copy)}>{foundWords(b)}</StaffLink>
        ) : (
          (foundWords(b) ?? <Muted>{copy.notRecorded}</Muted>)
        ),
    },
    { key: "refused", label: copy.columns.refused, short: true, text: (b) => b.refused, cell: (b) => b.refused },
    { key: "since", label: copy.columns.since, short: true, text: (b) => b.since, cell: (b) => staffTime(b.since) },
  ];
  return unblock
    ? [
        ...columns,
        {
          key: "unblock",
          label: "",
          end: true,
          cell: (b) => (
            <span className={styles.buttons}>
              <BlockHistory block={b} />
              <UnblockBubble block={b} action={unblock} />
            </span>
          ),
        },
      ]
    : columns;
}

/**
 * The blocked addresses and numbers, in the list frame, a page of
 * BLOCKS_PAGE_SIZE at a time: how many, their downloads at `download`, and
 * a row each; or that there are none, with the way to `clear` a search or
 * filter that's on.
 */
export default function BlocksTable({
  list,
  page,
  href,
  unblock,
  letterLinks,
  download,
  clear,
}: {
  list: { total: number; blocks: Block[] };
  page: number;
  /** The list's URL at another page. */
  href: (page: number) => string;
  unblock: (form: FormData) => void | Promise<void>;
  letterLinks: boolean;
  download?: (format: DownloadFormat) => string;
  /** The page with its search and filters off, while any is on. */
  clear?: string;
}) {
  return (
    <ListFrame
      count={copy.count(list.total)}
      total={list.total}
      page={page}
      pages={Math.ceil(list.total / BLOCKS_PAGE_SIZE)}
      pageSize={BLOCKS_PAGE_SIZE}
      href={href}
      download={download}
      columns={blockColumns(letterLinks, unblock)}
      rows={list.blocks}
      rowKey={(b) => b.address}
      empty={copy.noBlocks}
      clear={clear}
    />
  );
}
