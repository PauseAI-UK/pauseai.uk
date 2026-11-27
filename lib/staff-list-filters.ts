// Each staff list's filter bar: its filters, in their order, each named by
// its parameter in the list's definition (lib/staff-lists.ts), with its
// label and choices. Whether one can be chosen more than once is its
// parameter's: one the URL gives several times repeats. What a list's page
// gives its bar (`choices`) is what comes from the database or the page,
// such as the parties, the events, or who's in the log.
import type { ReactNode } from "react";
import { staffVocabulary } from "./staff-vocabulary";
import { firstOf, notValue, pairedValue, unpaired, valuesOf, type Params } from "./list-params";
import { type ParamKinds } from "./staff-lists";

/**
 * A choice. Choices in a `group` come under its heading, its icon once,
 * the group named on the chip too, or the chip named `chip` for it in place
 * of the filter's name; a `detail` is said quietly after the words. One
 * `under` another, whose value it names, is set in beneath it, as one of
 * what that one finds, when that one's offered too.
 */
export type FilterOption = {
  value: string;
  label: string;
  group?: { label: string; icon: ReactNode; chip?: string };
  detail?: string;
  /** What the choice means, after its link in a menu, such as a "?" that opens it. */
  help?: ReactNode;
  under?: string;
  /** In a `searchable` filter: shown before anything's typed in its box, as a choice of its own, and gone once something is. */
  untyped?: boolean;
  /** How a chip leaving it out says it, in place of "not" and its label: Any MP left out is "MP: none". */
  leftOut?: string;
};

/**
 * One of a list's filters: its URL parameter, its name, and its choices. A
 * choice whose value is blank is the filter's default, offered only to go
 * back to it. One `after` another is chosen in the second half of that
 * one's chip, and goes with it. One that can `repeat` can be chosen more
 * than once, one chip saying them all, and finds what has any of them; it can
 * leave out too, each marked with NOT, in a chip of its own, which finds what
 * has none of them, unless it's `after` another. `oneEach` on one where a record
 * has only one value, so that finding one and leaving out another can't both
 * be needed. One whose choices are in groups has a chip for each group it
 * finds, and one for each it leaves out. A `searchable`
 * one has a box over its choices, which show only once something's typed
 * in it, those that have it. A
 * `place` one takes words typed, a postcode or a town, and how far from it
 * (its parameter `place.within`), in a small form; its options give the
 * words found for what was typed. A `linkedOnly` one isn't offered by "+ Filter":
 * it's on only from a link to the list, a chip like any other once it is.
 */
export type Filter = {
  name: string;
  label: string;
  options: FilterOption[];
  after?: string;
  repeat?: boolean;
  oneEach?: boolean;
  searchable?: boolean;
  place?: { within: string; distances: FilterOption[]; placeholder: string };
  linkedOnly?: boolean;
  /** A filter that matters most: its own button, first, rather than a row in "+ Filter". */
  own?: boolean;
  /** A filter whose chips find one choice each, with no "+ Add" to tick more. */
  oneAtATime?: boolean;
  /**
   * A filter whose finding can't be changed here, and why, said on hovering
   * its chip: that chip is there but doesn't open, with a lock for its arrow,
   * "+ Filter" never offers it, and Clear filters keeps it. What it leaves
   * out can change, as any repeating filter's can.
   */
  locked?: string;
  /**
   * For one paired after a repeating filter (pairedAfter()): the choice it
   * starts at, paired with a value of that one just chosen, in place of its
   * blank default.
   */
  start?: string;
};

/**
 * One of a list's filters, as the list gives it: all a Filter is but its
 * name, its parameter's, and whether it repeats, which its parameter says.
 */
type FilterOf = Omit<Filter, "name" | "repeat">;

/** The filters of `list`'s bar, from what its page gives (`choices`): each of `filters`, by its parameter, in their order. */
export function listFilters<const P extends ParamKinds, C>(
  list: { params: P },
  filters: (choices: C) => NoInfer<{ [K in keyof P & string]?: FilterOf }>,
): (choices: C) => Filter[] {
  return (choices) =>
    Object.entries(filters(choices) as Record<string, FilterOf>).map(([name, filter]) =>
      list.params[name] === "many" ? { name, ...filter, repeat: true } : { name, ...filter },
    );
}

/** The choice of `filter` a value is, if it's one. */
export function choiceOf(filter: Filter, value: string): FilterOption | undefined {
  return filter.options.find((option) => option.value === value);
}

/** Whether `filter`'s choices are in groups, each group a chip of its own. */
export function isGrouped(filter: Filter): boolean {
  return filter.options.some((option) => option.group);
}

/** What the chip of a choice of `filter` is named: its group's chip's name, or the filter's. */
function chipName(filter: Filter, plain: string): string {
  return choiceOf(filter, plain)?.group?.chip ?? filter.label;
}

/**
 * A choice of `filter` in words: its group, unless its chip names it, and
 * its words; or as typed, when it's none of its choices.
 */
function choiceWords(filter: Filter, plain: string): string {
  const choice = choiceOf(filter, plain);
  if (!choice) return plain;
  return [choice.group?.chip ? undefined : choice.group?.label, choice.label].filter(Boolean).join(", ");
}

/** A value of `filter` in words: its chip's name and choice, joined by `join`, or that it's left out. */
export function valueWords(filter: Filter, value: string, join: string): string {
  const { value: plain, not } = notValue(value);
  const [name, choice] = [chipName(filter, plain), choiceWords(filter, plain)];
  return not ? staffVocabulary.filters.notChip(name, choice) : `${name}${join}${choice}`;
}

/** A filter that's on, in words, as its chip says them, and whether it leaves out what it says. */
export type FilterPill = { words: string; not: boolean };

/**
 * The repeating filter `filter` comes after, if it does: each of that one's
 * values has its own of `filter`'s, paired with it (pairedValue()).
 */
export function pairedAfter(filters: Filter[], filter: Filter): Filter | undefined {
  const before = filter.after ? filters.find((f) => f.name === filter.after) : undefined;
  return before?.repeat && filter.repeat ? before : undefined;
}

/**
 * The values of `paired`, which comes after `filter`, a repeating one, that
 * go with `of`, a value of that one, without their pairing: those it finds,
 * then those it leaves out.
 */
export function pairedSides(paired: Filter, values: Params, of: string): [string[], string[]] {
  const own = valuesOf(values[paired.name])
    .map(notValue)
    .filter((one) => unpaired(one.value).of === of);
  return [false, true].map((not) => own.filter((one) => one.not === not).map((one) => one.value)) as [
    string[],
    string[],
  ];
}

/**
 * The pills of a repeating filter with one paired after it: for each of
 * its values, what that one finds of it, or its default, then what it
 * leaves out of it, each named for the value.
 */
function pairedPills(filter: Filter, paired: Filter, values: Params): FilterPill[] {
  return valuesOf(values[filter.name]).flatMap((of) => {
    const name = choiceWords(filter, of);
    const [found, out] = pairedSides(paired, values, of);
    const words = (ones: string[]) => staffVocabulary.filters.anyOf(ones.map((one) => choiceWords(paired, one)));
    return [
      ...(found.length > 0 || out.length === 0
        ? [{ words: `${name}: ${found.length ? words(found) : choiceWords(paired, pairedValue(of, ""))}`, not: false }]
        : []),
      ...(out.length > 0 ? [{ words: staffVocabulary.filters.notChip(name, words(out)), not: true }] : []),
    ];
  });
}

/**
 * The search and each filter that's on, as their chips say them, and
 * whether each leaves out: for pills that show who something is to. One
 * that comes `after` another and doesn't repeat goes with it, as its chip's
 * second half does, its default too.
 */
export function filterPills(filters: Filter[], values: Params, search: string): FilterPill[] {
  const pills = values[search] ? [{ words: `${staffVocabulary.search}: ${firstOf(values[search])}`, not: false }] : [];
  for (const filter of filters) {
    if (filter.after && !filter.repeat) continue;
    if (pairedAfter(filters, filter)) continue;
    const paired = filters.find((f) => f.after === filter.name && pairedAfter(filters, f));
    if (paired) {
      pills.push(...pairedPills(filter, paired, values));
      continue;
    }
    const chosen = valuesOf(values[filter.name]).map(notValue);
    // Those it finds, then those it leaves out, by the name of their chip.
    const [found, out] = [false, true].map((not) => {
      const named = new Map<string, string[]>();
      for (const one of chosen.filter((one) => one.not === not)) {
        const name = chipName(filter, one.value);
        named.set(name, [...(named.get(name) ?? []), choiceWords(filter, one.value)]);
      }
      return [...named];
    });
    const next = filters.find((f) => f.after === filter.name && !f.repeat);
    const then = next ? `, ${choiceWords(next, firstOf(values[next.name]))}` : "";
    for (const [name, ones] of found)
      pills.push({ words: `${name}: ${staffVocabulary.filters.anyOf(ones)}${then}`, not: false });
    for (const [name, ones] of out)
      pills.push({ words: staffVocabulary.filters.notChip(name, staffVocabulary.filters.anyOf(ones)), not: true });
  }
  return pills;
}

/** The search and each filter that's on, in words, as their chips say them (filterPills): for a download's filename. */
export function filterWords(filters: Filter[], values: Params, search: string): string[] {
  return filterPills(filters, values, search).map((pill) => pill.words);
}

/** How long the filters in a list's page title get before they're cut short. */
const TITLE_FILTERS = 60;

/** A list's page title with the search and filters that are on, `words` (filterWords()), cut short if long. */
export function filteredTitle(title: string, words: string[]): string {
  const filters = words.filter(Boolean).join(", ");
  if (!filters) return title;
  const short = filters.length > TITLE_FILTERS ? `${filters.slice(0, TITLE_FILTERS - 1).trimEnd()}…` : filters;
  return staffVocabulary.filters.pageTitle(title, short);
}

/**
 * All the search and filters that are on, `words` (filterWords()): a saved
 * filter's first name. Not the list's title, as its Saved menu is the list's own.
 */
export function filteredName(words: string[]): string {
  return words.filter(Boolean).join(", ");
}

/** Each choice of `labels`, by its key, in their order. */
export const choicesOf = (labels: Record<string, string>): FilterOption[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));
