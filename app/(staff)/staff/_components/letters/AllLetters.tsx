import { ALL_EMAILS_LIST, clearedPath, type AllEmailsSort } from "@/lib/staff-lists";
import Tag from "@/components/ui/Tag";
import { Muted } from "@/components/ui/Text";
import type { AllLettersFound, AnyLetter, EmailChoice } from "@/lib/letters/all-letters.server";
import { ALL_EMAIL_FILTERS } from "@/lib/staff-list-filters";
import { ALL_LETTERS_PAGE_SIZE, type AllLettersSearch } from "@/lib/staff-search";
import { filtersPath, pageParam } from "@/lib/list-params";
import { sortHref } from "@/lib/staff-sort";
import { staffTime } from "@/lib/staff-time";
import CampaignName from "../CampaignName";
import SortHeading from "../ui/SortHeading";
import FilterBar from "../ui/FilterBar";
import ListFrame, { type ListColumn } from "../ui/ListFrame";
import PageHead from "../ui/PageHead";
import StaffLink from "../ui/StaffLink";
import Withheld from "../ui/Withheld";
import { statusOf } from "./LetterStatus";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { lettersCopy } from "./copy";

const PATH = ALL_EMAILS_LIST.path;
const copy = lettersCopy.allLetters;
const words = lettersCopy.letters;

/** When something happened, or a dash for what hasn't. */
const when = (at: Date | null) => (at ? staffTime(at) : <Muted>–</Muted>);

/** A row's status and the way to it: a thread's kind, as it has no status; a letter's, under its mailing for one of PauseAI's. */
function Status({ letter }: { letter: AnyLetter }) {
  if (letter.kind === "one-off") {
    return (
      <>
        {copy.oneOff} · <StaffLink href={`/staff/one-off/${letter.id}`}>{copy.theThread}</StaffLink>
      </>
    );
  }
  const href =
    letter.kind === "pauseai"
      ? `/staff/mailings/${letter.mailingId}/letters/${letter.id}`
      : `/staff/letters/${letter.id}`;
  return (
    <>
      {statusOf(letter.status)} ·{" "}
      <StaffLink href={href}>
        {letter.replies ? staffVocabulary.letterAndReplies(letter.replies) : staffVocabulary.theLetter}
      </StaffLink>
    </>
  );
}

/** Who a row is from: PauseAI, the supporter, leading to their page once linked, or who started a thread, PauseAI if it was. */
function From({ letter }: { letter: AnyLetter }) {
  if (letter.kind === "pauseai") return words.fromPauseai;
  if (letter.kind === "one-off") return letter.fromUs ? words.fromPauseai : letter.senderName || letter.senderEmail;
  return letter.supporterId === null ? (
    letter.senderName
  ) : (
    <StaffLink href={`/staff/supporters/${letter.supporterId}`}>{letter.senderName}</StaffLink>
  );
}

/** Who a row is to: a letter's politician, or those on a thread's first message, PauseAI by its name; a dash with none. */
function To({ letter }: { letter: AnyLetter }) {
  if (letter.kind !== "one-off") {
    return letter.people.map((person) => (
      <div key={person.id}>
        <StaffLink href={`/staff/politicians/${person.id}`}>{person.name}</StaffLink>
      </div>
    ));
  }
  if (letter.recipients.length === 0) return <Muted>–</Muted>;
  return letter.recipients.map((person, i) => (
    <div key={i}>
      {person.pauseai ? (
        words.fromPauseai
      ) : person.politicianId === null ? (
        person.name
      ) : (
        <StaffLink href={`/staff/politicians/${person.politicianId}`}>{person.name}</StaffLink>
      )}
    </div>
  ));
}

/** What a row is about, saying which kind: a campaign or a mailing, leading to it, or a thread's subject, in words, as the first column opens it. */
function Topic({ letter }: { letter: AnyLetter }) {
  if (letter.kind === "one-off") {
    if (!letter.subject) return lettersCopy.oneOff.noSubject;
    return (
      <>
        {letter.subject} <Tag>{copy.topicKinds.oneOff}</Tag>
      </>
    );
  }
  if (letter.kind === "pauseai") {
    return (
      <>
        <StaffLink href={`/staff/mailings/${letter.mailingId}`}>{letter.mailingTitle}</StaffLink>{" "}
        <Tag>{copy.topicKinds.mailing}</Tag>
      </>
    );
  }
  return (
    <>
      <CampaignName slug={letter.campaign} title={letter.campaignTitle} /> <Tag>{copy.topicKinds.campaign}</Tag>
    </>
  );
}

/**
 * The columns, as every list's go (docs/style-guide.md, "Lists"): how it
 * stands and the way to it; who it's from; the politicians it's with; its topic;
 * then when it was sent and first got a written reply. Each heading sorts
 * the list by its column.
 */
const COLUMNS: ListColumn<AnyLetter>[] = [
  { key: "status", label: words.columns.status, short: true, cell: (letter) => <Status letter={letter} /> },
  { key: "from", label: copy.from, cell: (letter) => <From letter={letter} /> },
  { key: "to", label: words.columns.to, cell: (letter) => <To letter={letter} /> },
  { key: "topic", label: copy.topic, cell: (letter) => <Topic letter={letter} /> },
  { key: "sent", label: words.columns.sent, short: true, cell: (letter) => when(letter.sentAt) },
  { key: "replied", label: words.columns.replied, short: true, cell: (letter) => when(letter.repliedAt) },
];

/**
 * Every email with a politician, filtered: what the dashboard's emails tiles
 * open. Without `supporters`, says at the top that those with supporters on
 * them aren't shown. With the one-offs chosen, says under the filters what they are.
 */
export default function AllLetters({
  found,
  people,
  search,
  supporters,
  inbox,
}: {
  found: AllLettersFound;
  /** Those the To filter offers. */
  people: EmailChoice[];
  search: AllLettersSearch;
  supporters: boolean;
  /** Where one-offs are copied to, which the introduction names. */
  inbox: string;
}) {
  const { page, ...values } = search;
  const { sort, dir, ...filtering } = values;
  const current = ALL_EMAILS_LIST.sort({ sort, dir });
  // Each heading sorts the list by its column, keeping the filters, from the first page.
  const columns = COLUMNS.map((column) => ({
    ...column,
    heading: (
      <SortHeading
        key={column.key}
        sortKey={column.key}
        current={current}
        href={sortHref(PATH, filtering, ALL_EMAILS_LIST.columns, current, column.key as AllEmailsSort)}
      >
        {column.label}
      </SortHeading>
    ),
  }));
  return (
    <>
      <PageHead intro={copy.subtitle}>{copy.title}</PageHead>
      {!supporters && (
        <p>
          <Withheld>{copy.withheld}</Withheld>
        </p>
      )}
      <FilterBar
        path={PATH}
        values={values}
        search={{ name: "q", label: copy.search }}
        filters={ALL_EMAIL_FILTERS({ supporters, people })}
      />
      {search.type.includes("one-off") && (
        <p>
          <Muted>{copy.intro(inbox)}</Muted>
        </p>
      )}
      <ListFrame
        count={copy.total(found.total)}
        total={found.total}
        page={Number(page) || 1}
        pages={found.pages}
        pageSize={ALL_LETTERS_PAGE_SIZE}
        href={(n) => filtersPath(PATH, values, pageParam(n))}
        columns={columns}
        rows={found.letters}
        rowKey={(letter) => `${letter.kind}-${letter.id}`}
        empty={copy.noneFound}
        clear={clearedPath(ALL_EMAILS_LIST, values)}
      />
    </>
  );
}
