import { Muted } from "@/components/ui/Text";
import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import type { SentEmail, SentPerson } from "@/lib/server/sent-emails";
import type { SentEmailsSearch } from "@/lib/staff-search";
import { SENT_EMAIL_FILTERS } from "@/lib/staff-list-filters";
import { filtersPath, pageParam } from "@/lib/list-params";
import { clearedPath, SENT_EMAILS_LIST, type SentEmailSort } from "@/lib/staff-lists";
import { sortHref } from "@/lib/staff-sort";
import { staffTime } from "@/lib/staff-time";
import SortHeading from "./SortHeading";
import FilterBar from "./ui/FilterBar";
import ListFrame, { type ListColumn } from "./ui/ListFrame";
import PageHead from "./ui/PageHead";
import Shortened, { cutAtWord } from "./ui/Shortened";
import StaffLink from "./ui/StaffLink";
import Withheld from "./ui/Withheld";
import { shellCopy } from "./shell/copy";

const PATH = SENT_EMAILS_LIST.path;
const copy = staffCopy.sentEmails;

/** Someone an email is to or from: their name, linked if it can be, over their address; or the address alone. */
function Person({ person, address }: { person: SentPerson | null; address: string | null }) {
  if (!person?.name) return <>{address}</>;
  return (
    <>
      <div>{person.href ? <StaffLink href={person.href}>{person.name}</StaffLink> : person.name}</div>
      <Muted>{address}</Muted>
    </>
  );
}

/** A row's outcome: red for what didn't reach them. */
function Outcome({ outcome }: { outcome: string }) {
  return <Tag tone={outcome === "sent" ? undefined : "red"}>{copy.outcomes[outcome] ?? outcome}</Tag>;
}

/** How many characters of a long subject a row shows. */
const SUBJECT_LENGTH = 40;

/** A subject no longer than this is shown whole: cutting it would hide a word or two, and save no line. */
const SUBJECT_WHOLE = 55;

/** An email's subject, a long one cut short at a word, to unfold (ui/Shortened). */
function Subject({ subject }: { subject: string | null }) {
  if (subject === null || subject.length <= SUBJECT_WHOLE) return subject;
  return <Shortened short={cutAtWord(subject, SUBJECT_LENGTH)!} whole={subject} />;
}

const columns: (ListColumn<SentEmail> & { key: SentEmailSort | "links" })[] = [
  { key: "when", label: copy.columns.when, short: true, cell: (e) => staffTime(e.at) },
  {
    key: "what",
    label: copy.columns.what,
    short: true,
    cell: (e) => (
      <>
        {copy.purposes[e.purpose] ?? e.purpose}
        {e.imported && (
          <div>
            <Tag tone="blue">{copy.imported}</Tag>
          </div>
        )}
      </>
    ),
  },
  { key: "to", label: copy.columns.to, cell: (e) => <Person person={e.to} address={e.address} /> },
  { key: "from", label: copy.columns.from, cell: (e) => <Person person={e.from} address={e.fromAddress} /> },
  { key: "backend", label: copy.columns.backend, short: true, cell: (e) => copy.backends[e.backend] },
  { key: "subject", label: copy.columns.subject, words: "line", cell: (e) => <Subject subject={e.subject} /> },
  { key: "outcome", label: copy.columns.outcome, short: true, cell: (e) => <Outcome outcome={e.outcome} /> },
  {
    key: "links",
    label: copy.columns.links,
    short: true,
    cell: (e) => (
      <>
        {e.letterHref && (
          <div>
            <StaffLink href={e.letterHref}>{copy.letterLink}</StaffLink>
          </div>
        )}
        {e.campaignHref && (
          <div>
            <StaffLink href={e.campaignHref}>{copy.campaignLink}</StaffLink>
          </div>
        )}
        {e.mailingHref && (
          <div>
            <StaffLink href={e.mailingHref}>{copy.mailingLink}</StaffLink>
          </div>
        )}
      </>
    ),
  },
];

/**
 * The send log, for admins: its heading; a search and filters; then a row for each email, each
 * column but its links a sort, newest first unless another is chosen.
 * A row never shows the email's text.
 */
export default function SentEmails({
  emails,
  total,
  pages,
  page,
  pageSize,
  search,
  supporters = true,
}: {
  emails: SentEmail[];
  total: number;
  pages: number;
  page: number;
  pageSize: number;
  search: SentEmailsSearch;
  /** Whether they may see emails to and from supporters; if not, it says they're left out. */
  supporters?: boolean;
}) {
  const kept = { ...search, page: "" };
  const { sort, dir, ...filtering } = kept;
  const current = SENT_EMAILS_LIST.sort({ sort, dir });
  // Each heading sorts the list by its column, keeping the filters; Links has nothing to sort by.
  const sortable = columns.map((column) =>
    column.key === "links"
      ? column
      : {
          ...column,
          heading: (
            <SortHeading
              key={column.key}
              sortKey={column.key}
              current={current}
              href={sortHref(PATH, filtering, SENT_EMAILS_LIST.columns, current, column.key)}
            >
              {column.label}
            </SortHeading>
          ),
        },
  );
  return (
    <>
      <PageHead intro={copy.intro}>{shellCopy.nav.sentEmails}</PageHead>
      {!supporters && (
        <p>
          <Withheld>{copy.withheld}</Withheld>
        </p>
      )}
      <FilterBar
        path={PATH}
        values={search}
        search={{ name: "q", label: copy.search }}
        filters={SENT_EMAIL_FILTERS({ supporters })}
      />
      <ListFrame
        count={copy.total(total)}
        total={total}
        page={page}
        pages={pages}
        pageSize={pageSize}
        href={(n) => filtersPath(PATH, kept, pageParam(n))}
        columns={sortable}
        rows={emails}
        rowKey={(e) => e.id}
        empty={copy.none}
        clear={clearedPath(SENT_EMAILS_LIST, search)}
      />
    </>
  );
}
