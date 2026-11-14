import StaffLink from "../ui/StaffLink";
import { Muted } from "@/components/ui/Text";
import type { EmailBlock } from "@/lib/email/email.server";
import type { DownloadFormat } from "@/lib/staff-list";
import { staffTime } from "@/lib/staff-time";
import Reason, { problemSource } from "../email/BounceReason";
import LetterLink from "../letters/LetterLink";
import { UnblockBubble } from "../email/UnblockForm";
import ListFrame, { type ListColumn } from "../ui/ListFrame";
import TestTag from "../ui/TestTag";
import { supportersCopy } from "../supporters/copy";
import { emailCopy } from "@/lib/email/copy";

const copy = emailCopy.emails;

/** A supporter's name, or that they have none. */
const supporterName = (s: EmailBlock["supporters"][number]) => s.name ?? supportersCopy.supporters.noName;

/** What the email that found an address out was, in words: a letter, by whom it was to, or what the site sent. */
function sentWords(block: EmailBlock): string | null {
  if (block.letter) return `${copy.letterTo} ${block.letter.to}`;
  return block.purpose ? copy.purposes[block.purpose] : null;
}

/**
 * The blocked addresses' columns, as every list's go (docs/style-guide.md):
 * the address and whose, politicians' then supporters', each linked to
 * their page; why, and the email that found it out (a letter
 * linked with `letterLinks`); how many emails haven't been sent since;
 * since when; and with `unblock`, a button that opens the way to unblock
 * each, which a download leaves out.
 */
export function blockColumns(
  letterLinks: boolean,
  unblock?: (form: FormData) => void | Promise<void>,
): ListColumn<EmailBlock>[] {
  const columns: ListColumn<EmailBlock>[] = [
    { key: "address", label: copy.columns.address, text: (b) => b.address, cell: (b) => b.address },
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
      cell: (b) => copy.kinds[b.kind],
    },
    {
      key: "reason",
      label: copy.columns.reason,
      text: (b) => `${b.reason} (${problemSource(b)})`,
      cell: (b) => <Reason reason={b.reason} kind={b.kind} foundInGmail={b.foundInGmail} />,
    },
    {
      key: "sent",
      label: copy.columns.sent,
      words: "name",
      text: sentWords,
      cell: (b) =>
        b.letter ? (
          <LetterLink letter={b.letter} linked={letterLinks} />
        ) : (
          (sentWords(b) ?? <Muted>{copy.notRecorded}</Muted>)
        ),
    },
    { key: "refused", label: copy.columns.refused, short: true, text: (b) => b.refused, cell: (b) => b.refused },
    { key: "since", label: copy.columns.since, short: true, text: (b) => b.since, cell: (b) => staffTime(b.since) },
  ];
  return unblock
    ? [...columns, { key: "unblock", label: "", end: true, cell: (b) => <UnblockBubble block={b} action={unblock} /> }]
    : columns;
}

/**
 * The blocked addresses, in the list frame: how many, their downloads at
 * `download`, and a row each; or that there are none, with the way to
 * `clear` a search or filter that's on.
 */
export default function EmailBlocksTable({
  blocks,
  unblock,
  letterLinks,
  download,
  clear,
}: {
  blocks: EmailBlock[];
  unblock: (form: FormData) => void | Promise<void>;
  letterLinks: boolean;
  download?: (format: DownloadFormat) => string;
  /** The page with its search and filter off, while either is on. */
  clear?: string;
}) {
  return (
    <ListFrame
      count={copy.count(blocks.length)}
      total={blocks.length}
      page={1}
      pages={1}
      pageSize={blocks.length}
      download={download}
      columns={blockColumns(letterLinks, unblock)}
      rows={blocks}
      rowKey={(b) => b.address}
      empty={copy.noBlocks}
      clear={clear}
    />
  );
}
