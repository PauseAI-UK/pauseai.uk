import { staffVocabulary } from "@/lib/staff-vocabulary";
import { pickedWho } from "@/lib/mailings/picks";
import { type Picked } from "@/lib/staff-search";
import { firstOf, valuesOf, type Params } from "@/lib/list-params";
import { staffDate } from "@/lib/staff-time";
import type { FilterWordsData } from "@/lib/mailings/pages.server";
import { filterPills, type FilterPill } from "@/lib/staff-list-filters";
import { POLITICIAN_FILTERS, politicianParams } from "@/lib/politicians/list-filters";
import Pills from "../ui/Pills";
import styles from "./MailingParts.module.css";
import { mailingsCopy } from "./copy";
import { politiciansCopy } from "../politicians/copy";

// Pieces of the mailing pages: who a mailing is to.

const copy = mailingsCopy.mailingPages;

/** The most names ticked said as pills; the rest are a count. */
const MOST_NAMES = 10;

/** A filter's pills, as the politicians list's tabs and chips say them: the house first, then the search, then the chips. */
function politicianPills(data: FilterWordsData, params: Params): FilterPill[] {
  // The house is the list's tabs, not one of its filters, so it comes first, on its own.
  const house = staffVocabulary.houses[firstOf(params.house)];
  // The search in quotes, so it reads as what was typed.
  const search = firstOf(params.q);
  return [
    ...(house ? [{ words: house, not: false }] : []),
    ...(search ? [{ words: copy.searchPill(search), not: false }] : []),
    ...filterPills(
      POLITICIAN_FILTERS({ ask: valuesOf(params.ask), parties: data.parties, asks: data.asks }),
      { ...politicianParams(params), q: "" },
      "q",
    ),
  ];
}

/** Who's ticked, as pills: the group a filter found and when, with those added and taken off; else their names. */
function pickedPills(data: FilterWordsData, picked: Picked): FilterPill[] {
  const name = (id: number) => data.names[id] ?? `#${id}`;
  const found = (words: string) => ({ words, not: false });
  const who = pickedWho(picked);
  if (who.kind === "group") {
    const { from, plus, except } = who;
    const group = politicianPills(data, from.params);
    return [
      ...(group.length ? group : [found(copy.everyone)]),
      found(copy.pickedFrom(staffDate(new Date(from.at)), from.found.length)),
      ...plus.map((id) => found(copy.pickedPlus(name(id)))),
      ...except.map((id) => ({ words: copy.pickedExcept(name(id)), not: true })),
    ];
  }
  const names = who.ids.map(name).sort((a, b) => a.localeCompare(b));
  return [
    ...names.slice(0, MOST_NAMES),
    ...(names.length > MOST_NAMES ? [copy.pickedMore(names.length - MOST_NAMES)] : []),
  ].map(found);
}

/**
 * Who a mailing is to, as pills that can't be changed here: those ticked,
 * as pickedWho says them, or, for one from before ticks, its filter, as the
 * politicians list's chips say it.
 */
export function FilterPills({ data }: { data: FilterWordsData }) {
  const { picked } = data.filter;
  const pills = picked ? pickedPills(data, picked) : politicianPills(data, data.filter.params);
  if (pills.length === 0) {
    return <p className={styles.everyone}>{picked ? politiciansCopy.choosing.pickedNone : copy.everyone}</p>;
  }
  return <Pills pills={pills} label={copy.whoLabel} />;
}
