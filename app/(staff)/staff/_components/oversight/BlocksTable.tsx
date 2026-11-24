import StaffLink from "../ui/StaffLink";
import ChannelIcon from "@/components/ui/ChannelIcon";
import type { Block } from "@/lib/oversight/blocks.server";
import { BLOCKS_PAGE_SIZE } from "@/lib/email/block-filters";
import { filtersPath, pageParam } from "@/lib/list-params";
import { clearedPath, type BLOCKED_ADDRESSES_LIST, type BlockSort } from "@/lib/staff-lists";
import type { BlocksSearch } from "@/lib/staff-search";
import { sortHref } from "@/lib/staff-sort";
import { now } from "@/lib/now";
import { phoneWords } from "@/lib/phone";
import { staffDate, staffTime } from "@/lib/staff-time";
import Reason, { problemSource, REASON_LENGTH } from "../email/BounceReason";
import Shortened, { cutAtWord } from "../ui/Shortened";
import { UnblockBubble, type Unblock } from "../email/UnblockForm";
import IconText from "../ui/IconText";
import ListFrame, { type ListColumn } from "../ui/ListFrame";
import SortHeading from "../ui/SortHeading";
import TestTag from "../ui/TestTag";
import BlockHistory, { copyPath } from "./BlockHistory";
import { supportersCopy } from "../supporters/copy";
import { emailCopy } from "@/lib/email/copy";
import styles from "./BlocksTable.module.css";

const copy = emailCopy.emails;

/** A supporter's name, or that they have none. */
const supporterName = (s: Block["supporters"][number]) => s.name ?? supportersCopy.supporters.noName;

/**
 * Which one was being sent, beside what kind (Block's `found`): a letter, by
 * whom it was to; a broadcast's title; the type of email, where it says more
 * than its kind; or the mailbox a bounce was read from. Null for none of
 * these, as for a hold.
 */
function detailWords(block: Block): string | null {
  if (block.letter) return `${copy.letterTo} ${block.letter.to}`;
  if (block.copy) return block.copy.title;
  if (block.purpose && block.purpose !== block.found) return copy.purposes[block.purpose];
  return block.mailbox;
}

/** Words cut as long as a reason's are (REASON_LENGTH), with "…" that unfolds the whole (ui/Shortened); short ones whole. */
function Cut({ words }: { words: string }) {
  const short = cutAtWord(words, REASON_LENGTH);
  return short ? <Shortened short={short} whole={words} /> : <>{words}</>;
}

/**
 * A link cut as Cut cuts words, but with "…" in the link and the whole on
 * hover, as unfolding inside a link would fight with following it.
 */
function CutLink({ href, words }: { href: string; words: string }) {
  const short = cutAtWord(words, REASON_LENGTH);
  return (
    <StaffLink href={href} title={short ? words : undefined}>
      {short ? `${short}…` : words}
    </StaffLink>
  );
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
 * or text, who told us, and in their words why; then what we add of our
 * own: what kind of thing was being sent when it was blocked, and
 * which one (a letter linked with `letterLinks`, a broadcast's copy
 * always); how many emails or texts haven't gone since;
 * since when; and with `unblock`, the row's buttons: its history and the
 * way to unblock it, which a download leaves out.
 */
export function blockColumns(letterLinks: boolean, unblock?: Unblock): ListColumn<Block>[] {
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
    { key: "backend", label: copy.columns.backend, short: true, text: problemSource, cell: problemSource },
    {
      key: "reason",
      label: copy.columns.reason,
      text: reasonWords,
      cell: (b) => <Reason reason={reasonWords(b)} />,
    },
    {
      key: "sent",
      label: copy.columns.sent,
      short: true,
      text: (b) => copy.foundBy[b.found],
      cell: (b) => copy.foundBy[b.found],
    },
    {
      key: "sentDetail",
      label: copy.columns.sentDetail,
      words: "name",
      text: detailWords,
      cell: (b) => {
        const words = detailWords(b);
        if (b.copy) return <CutLink href={copyPath(b.copy)} words={b.copy.title} />;
        if (b.letter && letterLinks) return <CutLink href={`/staff/letters/${b.letter.id}`} words={words!} />;
        return words && <Cut words={words} />;
      },
    },
    { key: "refused", label: copy.columns.refused, short: true, text: (b) => b.refused, cell: (b) => b.refused },
    { key: "since", label: copy.columns.since, short: true, text: (b) => b.since, cell: (b) => staffTime(b.since) },
  ];
  return unblock
    ? [
        ...columns,
        {
          key: "history",
          label: "",
          short: true,
          className: styles.ruled,
          // Its own empty heading, so its rule runs through the headings' row too.
          heading: <th key="history" className={styles.ruled} />,
          cell: (b) => <BlockHistory block={b} />,
        },
        { key: "unblock", label: "", end: true, cell: (b) => <UnblockBubble block={b} action={unblock} /> },
      ]
    : columns;
}

/**
 * The blocked addresses and numbers on the page `of`, in the list frame, a
 * page of BLOCKS_PAGE_SIZE at a time, as its URL `search` asks: how many,
 * their downloads, and a row each, under headings that sort by their
 * column, keeping the filters; or that there are none, with the way to clear
 * a search or filter that's on.
 */
export default function BlocksTable({
  list,
  of,
  search,
  page,
  unblock,
  letterLinks,
}: {
  list: { total: number; blocks: Block[] };
  of: typeof BLOCKED_ADDRESSES_LIST;
  search: BlocksSearch;
  page: number;
  unblock: Unblock;
  letterLinks: boolean;
}) {
  // Its URL from the first page: a link to another page or a sort sets its own.
  const kept = { ...search, page: "" };
  const { sort, dir, ...filtering } = kept;
  const current = of.sort({ sort, dir });
  const columns = blockColumns(letterLinks, unblock).map((column) =>
    Object.hasOwn(of.columns, column.key)
      ? {
          ...column,
          heading: (
            <SortHeading
              key={column.key}
              sortKey={column.key}
              current={current}
              href={sortHref(of.path, filtering, of.columns, current, column.key as BlockSort)}
            >
              {column.label}
            </SortHeading>
          ),
        }
      : column,
  );
  return (
    <ListFrame
      count={copy.count(list.total)}
      total={list.total}
      page={page}
      pages={Math.ceil(list.total / BLOCKS_PAGE_SIZE)}
      pageSize={BLOCKS_PAGE_SIZE}
      href={(n) => filtersPath(of.path, kept, pageParam(n))}
      download={(format) => filtersPath(`${of.path}/download`, { ...kept, format })}
      columns={columns}
      rows={list.blocks}
      rowKey={(b) => b.address}
      // Its rows hold buttons (docs/style-guide.md, "Tables").
      align="middle"
      empty={copy.noBlocks}
      clear={clearedPath(of, search)}
    />
  );
}
