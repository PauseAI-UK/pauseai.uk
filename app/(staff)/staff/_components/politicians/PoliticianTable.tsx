import AnswerWord from "../asks/AnswerWord";
import { AskTitle } from "../asks/AskLine";
import StaffLink from "../ui/StaffLink";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { POLITICIANS_LIST, type PoliticianSort } from "@/lib/staff-lists";
import type { Ask } from "@/lib/asks/records.server";
import type { Politician } from "@/lib/politicians/records.server";
import { anyAndNone, firstOf, valuesOf, type Params } from "@/lib/list-params";
import { staffDate } from "@/lib/staff-time";
import { sortHref } from "@/lib/staff-sort";
import SortHeading from "../ui/SortHeading";
import Empty from "../ui/Empty";
import { ListTable, type ListColumn } from "../ui/ListFrame";
import type { Contact } from "@/lib/vcard";
import styles from "./PoliticianTable.module.css";
import { Muted } from "@/components/ui/Text";
import Tag from "@/components/ui/Tag";
import { politiciansCopy } from "./copy";

type Props = {
  politicians: Politician[];
  /** Every ask, for their titles, in the order the asks page lists them. */
  asks: Ask[];
  /** The list's filters and sort as typed, for the headings' links. */
  search?: Params;
};

/** The marks on them, and whether they're ours for testing, as lozenges. */
function Marks({ politician }: { politician: Politician }) {
  const flags = staffVocabulary.politicianFlags;
  return (
    <>
      {politician.importantTarget && <Tag tone="amber">{flags.important}</Tag>}
      {politician.personalConnection && <Tag>{flags.connection}</Tag>}
      {politician.isTest && <Tag>{flags.test}</Tag>}
    </>
  );
}

/** The marks on them, in words, as a download has them. */
const marks = (p: Politician) => {
  const flags = staffVocabulary.politicianFlags;
  return [p.importantTarget && flags.important, p.personalConnection && flags.connection, p.isTest && flags.test]
    .filter(Boolean)
    .join("; ");
};

/**
 * The politicians list's columns: who they are (name, house, constituency
 * and party), how they stand (whether they're in office, the marks on
 * them, each ask they've answered and their answer beside it, a line
 * each, a long title cut short), how
 * many emails went to them and came from them, and when they first and
 * last did anything with us. Which show is the filters' doing, not the
 * rows': a
 * column is left out only when the filters fix it for every row there
 * could be. That's a house (and for peers, the constituency they don't
 * have), one party found (one left out doesn't fix it), or one status,
 * those in office unless another or any is chosen. Their nation, after
 * the constituency, is added when the Nation filter leaves some out or
 * finds more than one, so the rows differ by it. A download has the same
 * columns.
 */
export function politicianColumns(asks: Ask[], search: Params = {}): ListColumn<Politician>[] {
  const house = firstOf(search.house);
  const [parties] = anyAndNone(valuesOf(search.party), (values) => values);
  const [nations, notNations] = anyAndNone(valuesOf(search.nation), (values) => values);
  const show = {
    house: !Object.hasOwn(staffVocabulary.houses, house),
    constituency: house !== "lords",
    nation: Boolean(notNations) || (nations?.length ?? 0) > 1,
    party: parties?.length !== 1,
    status: firstOf(search.status ?? "any") === "any",
  };
  const { sort, dir, ...filters } = search;
  const current = POLITICIANS_LIST.sort({ sort: firstOf(sort), dir: firstOf(dir) });
  // A count's column is as narrow as its figures, so its heading breaks once, not at every word: with its
  // sort, and without it (`breakOnce` on the column), as the tab of pasted names has it.
  const heading = (key: PoliticianSort, label: string, count = false) => (
    <SortHeading
      key={key}
      sortKey={key}
      current={current}
      href={sortHref(POLITICIANS_LIST.path, filters, POLITICIANS_LIST.columns, current, key)}
      breakOnce={count}
    >
      {label}
    </SortHeading>
  );
  const answered = (p: Politician) => asks.filter((ask) => p.statuses[ask.slug]);
  const columns: (ListColumn<Politician> | false)[] = [
    {
      key: "name",
      label: staffVocabulary.fields.name,
      heading: heading("name", staffVocabulary.fields.name),
      words: "name",
      text: (p) => p.name,
      cell: (p) => (
        <>
          <StaffLink href={`/staff/politicians/${p.id}`}>{p.name}</StaffLink>{" "}
          {p.emailBlocked && <Tag tone="amber">{politiciansCopy.politicians.emailBlocked}</Tag>}
        </>
      ),
    },
    show.house && {
      key: "house",
      label: staffVocabulary.fields.house,
      heading: heading("house", staffVocabulary.fields.house),
      short: true,
      text: (p) => staffVocabulary.houses[p.house],
      cell: (p) => staffVocabulary.houses[p.house],
    },
    show.constituency && {
      key: "constituency",
      label: staffVocabulary.fields.constituency,
      heading: heading("constituency", staffVocabulary.fields.constituency),
      words: "name",
      text: (p) => p.constituency,
      cell: (p) => p.constituency,
    },
    show.nation && {
      key: "country",
      label: politiciansCopy.politician.country,
      short: true,
      text: (p) => p.country && staffVocabulary.countries[p.country],
      cell: (p) => p.country && staffVocabulary.countries[p.country],
    },
    show.party && {
      key: "party",
      label: staffVocabulary.fields.party,
      heading: heading("party", staffVocabulary.fields.party),
      short: true,
      text: (p) => p.party,
      cell: (p) => p.party,
    },
    show.status && {
      key: "status",
      label: politiciansCopy.politicians.columns.status,
      short: true,
      text: (p) => politiciansCopy.personStatuses[p.status],
      cell: (p) =>
        p.status === "in_office" ? (
          politiciansCopy.personStatuses[p.status]
        ) : (
          <Muted>{politiciansCopy.personStatuses[p.status]}</Muted>
        ),
    },
    {
      key: "marked",
      label: politiciansCopy.politicians.flag,
      text: marks,
      cell: (p) => (
        <span className={styles.marks}>
          <Marks politician={p} />
        </span>
      ),
    },
    {
      key: "asks",
      label: politiciansCopy.politicians.columns.asks,
      heading: heading("asks", politiciansCopy.politicians.columns.asks),
      text: (p) =>
        answered(p)
          .map((ask) => `${staffVocabulary.statuses[p.statuses[ask.slug].status]}: ${ask.title}`)
          .join("; "),
      cell: (p) =>
        answered(p).length ? (
          <ul className={styles.asks}>
            {answered(p).map((ask) => (
              <li key={ask.slug}>
                <span className={styles.ask} title={ask.title}>
                  <AskTitle ask={ask} />
                </span>{" "}
                <strong className={styles.answer}>
                  <AnswerWord status={p.statuses[ask.slug].status} />
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <Muted>{politiciansCopy.politicians.noAsks}</Muted>
        ),
    },
    {
      key: "emailsToThem",
      label: politiciansCopy.politicians.columns.emailsToThem,
      heading: heading("emailsToThem", politiciansCopy.politicians.columns.emailsToThem, true),
      breakOnce: true,
      short: true,
      className: styles.count,
      text: (p) => p.emailsToThem,
      cell: (p) => p.emailsToThem,
    },
    {
      key: "emailsFromThem",
      label: politiciansCopy.politicians.columns.emailsFromThem,
      heading: heading("emailsFromThem", politiciansCopy.politicians.columns.emailsFromThem, true),
      breakOnce: true,
      short: true,
      className: styles.count,
      text: (p) => p.emailsFromThem,
      cell: (p) => p.emailsFromThem,
    },
    {
      key: "first",
      label: politiciansCopy.politicians.columns.first,
      heading: heading("first", politiciansCopy.politicians.columns.first),
      short: true,
      text: (p) => p.firstActivityAt,
      cell: (p) => p.firstActivityAt && staffDate(p.firstActivityAt),
    },
    {
      key: "active",
      label: politiciansCopy.politicians.columns.last,
      heading: heading("active", politiciansCopy.politicians.columns.last),
      short: true,
      text: (p) => p.lastActivityAt,
      cell: (p) => p.lastActivityAt && staffDate(p.lastActivityAt),
    },
  ];
  return columns.filter((column) => column !== false);
}

/**
 * A politician as a contact card (lib/vcard.ts): their name and email,
 * their house and party, their constituency and nation, and in the note
 * whether they're in office, the marks on them, how many emails went to
 * them and came from them, and their answer to each ask.
 */
export function politicianContact(asks: Ask[]): (p: Politician) => Contact {
  return (p) => ({
    name: p.name,
    emails: p.email ? [p.email] : [],
    phones: [],
    org: staffVocabulary.houses[p.house],
    title: p.party || null,
    address: { locality: p.constituency, country: p.country && staffVocabulary.countries[p.country] },
    note: [
      politiciansCopy.personStatuses[p.status],
      marks(p),
      `${politiciansCopy.politicians.columns.emailsToThem}: ${p.emailsToThem}`,
      `${politiciansCopy.politicians.columns.emailsFromThem}: ${p.emailsFromThem}`,
      ...asks
        .filter((ask) => p.statuses[ask.slug])
        .map((ask) => `${staffVocabulary.statuses[p.statuses[ask.slug].status]}: ${ask.title}`),
    ].filter(Boolean),
    url: `/staff/politicians/${p.id}`,
  });
}

/** Politicians, a row each, in the list's columns; or that there are none. */
export default function PoliticianTable({ politicians, asks, search = {} }: Props) {
  if (politicians.length === 0) return <Empty>{politiciansCopy.politicians.none}</Empty>;
  return <ListTable columns={politicianColumns(asks, search)} rows={politicians} rowKey={(p) => p.id} />;
}
