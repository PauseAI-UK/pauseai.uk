import type { ReactNode } from "react";
import Form from "next/form";
import { Button } from "@/components/ui/Button";
import { Select, TextInput } from "@/components/ui/Controls";
import { staffCopy } from "@/lib/content/staff-interface";
import { chosenValues } from "@/lib/filter-choices";
import { filtersPath, firstOf, NOT, notValue, valuesOf, type Params } from "@/lib/staff-search";
import Choices from "./Choices";
import FilterBarLines from "./FilterBarLines";
import FormPending from "./FormPending";
import ManyChoices, { NotWords } from "./ManyChoices";
import StaffLink from "./StaffLink";
import Menu from "./Menu";
import LockIcon from "./LockIcon";
import NotIcon from "./NotIcon";
import SavedFilters, { SavedFilterGone, type SavedFiltersProps } from "./SavedFilters";
import styles from "./FilterBar.module.css";

/**
 * A choice. Choices in a `group` come under its heading, its icon once,
 * the group named on the chip too; a `detail` is said quietly after the
 * words. One with `seconds` is in two parts: chosen, its chip is in two
 * halves, the second offering `seconds`, the first of which is this choice
 * alone and the rest narrow it.
 */
export type FilterOption = {
  value: string;
  label: string;
  group?: { label: string; icon: ReactNode };
  detail?: string;
  seconds?: FilterOption[];
  /** A second part's kind, the same across choices, so changing the first keeps it where the new one has it. */
  like?: string;
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
 * be needed. A choice in two parts doesn't repeat. A `searchable`
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
  /**
   * A filter that can't be changed here, and why, said on hovering its chip:
   * its chip is there but doesn't open, with a lock for its arrow, it's never
   * offered, and Clear filters keeps it.
   */
  locked?: string;
};

const copy = staffCopy.filters;

/** A filter's choices, without its blank one, its default. */
const everyChoice = (filter: Filter) => filter.options.map((option) => option.value).filter(Boolean);

/** The choice of `filter` a value is, or whose second part it is, and that second part, if it narrows it. */
function parts(filter: Filter, value: string): { first?: FilterOption; second?: FilterOption } {
  for (const option of filter.options) {
    if (option.value === value) return { first: option };
    const second = option.seconds?.find((o) => o.value === value);
    if (second) return { first: option, second };
  }
  return {};
}

/** A choice of `filter` in words: its group, its words and its second part; or as typed, when it has none. */
function choiceWords(filter: Filter, plain: string): string {
  const { first, second } = parts(filter, plain);
  return first ? [first.group?.label, first.label, second?.label].filter(Boolean).join(", ") : plain;
}

/** A value of `filter` in words: its name and choice, joined by `join`, or that it's left out. */
function valueWords(filter: Filter, value: string, join: string): string {
  const { value: plain, not } = notValue(value);
  const choice = choiceWords(filter, plain);
  return not ? copy.notChip(filter.label, choice) : `${filter.label}${join}${choice}`;
}

/**
 * The search and each filter that's on, in words, as their chips say them:
 * for a download's filename. One that comes `after` another and doesn't
 * repeat goes with it, as its chip's second half does, its default too.
 */
export function filterWords(filters: Filter[], values: Params, search: string): string[] {
  const words = values[search] ? [`${staffCopy.search}: ${firstOf(values[search])}`] : [];
  for (const filter of filters) {
    if (filter.after && !filter.repeat) continue;
    const chosen = valuesOf(values[filter.name]).map(notValue);
    const [found, out] = [false, true].map((not) =>
      chosen.filter((one) => one.not === not).map((one) => choiceWords(filter, one.value)),
    );
    const next = filters.find((f) => f.after === filter.name && !f.repeat);
    const then = next ? `, ${choiceWords(next, firstOf(values[next.name]))}` : "";
    if (found.length) words.push(`${filter.label}: ${copy.anyOf(found)}${then}`);
    if (out.length) words.push(copy.notChip(filter.label, copy.anyOf(out)));
  }
  return words;
}

/** How long the filters in a list's page title get before they're cut short. */
const TITLE_FILTERS = 60;

/** A list's page title with the search and filters that are on, `words` (filterWords()), cut short if long. */
export function filteredTitle(title: string, words: string[]): string {
  const filters = words.filter(Boolean).join(", ");
  if (!filters) return title;
  const short = filters.length > TITLE_FILTERS ? `${filters.slice(0, TITLE_FILTERS - 1).trimEnd()}…` : filters;
  return copy.pageTitle(title, short);
}

/** A list's title with all the search and filters that are on, `words` (filterWords()): a saved filter's first name. */
export function filteredName(title: string, words: string[]): string {
  return copy.pageTitle(title, words.filter(Boolean).join(", "));
}

/** The values a saved filter can no longer find, each "<parameter>=<value>", in words, as chips say them. */
function goneWords(filters: Filter[], gone: string[]): string[] {
  return gone.map((one) => {
    const [name, ...value] = one.split("=");
    const filter = filters.find((f) => f.name === name);
    return filter ? valueWords(filter, value.join("="), ": ") : value.join("=");
  });
}

/**
 * A place filter's form: the words, how far from them, and its button,
 * keeping every other parameter of the list (`others`) but its page.
 */
function PlaceForm({
  path,
  filter,
  values,
  others,
}: {
  path: string;
  filter: Filter;
  values: Params;
  others: [string, string][];
}) {
  const place = filter.place!;
  return (
    <Form action={path} className={styles.placeForm}>
      {others.map(([name, value]) => (
        <input key={`${name}-${value}`} type="hidden" name={name} value={value} />
      ))}
      <TextInput
        type="search"
        name={filter.name}
        defaultValue={firstOf(values[filter.name])}
        aria-label={filter.label}
        placeholder={place.placeholder}
        required
      />
      <Select
        name={place.within}
        defaultValue={firstOf(values[place.within]) || place.distances[1].value}
        aria-label={staffCopy.filters.within}
      >
        {place.distances.map((distance) => (
          <option key={distance.value} value={distance.value}>
            {distance.label}
          </option>
        ))}
      </Select>
      <Button variant="primary" size="small" fit type="submit">
        {staffCopy.search}
      </Button>
      <FormPending />
    </Form>
  );
}

/**
 * A staff list's filters (docs/style-guide.md, "Filters"): the search box,
 * with its button and an × that empties it; then a filter that matters most
 * (`own`) as its own button, its chip first once it's on; a chip for each filter
 * that's on, which opens its choices and a way to remove it (one with a
 * filter after it is a chip in two halves, a menu each; one that repeats, a
 * chip for all it finds and one for all it leaves out, marked so); "+
 * Filter", which lists every other filter, and one that repeats, a row
 * each, its choices opening under it, cut in two with "Except", which lists
 * those that repeat to choose one to leave out; and Clear filters, while
 * anything is on. A repeating filter's chip adds a choice to itself, takes
 * one off, and can turn all it has from found to left out, and back. Every choice is a link, so the URL holds
 * the filters. `values` are the URL's parameters as typed: a change keeps
 * the rest, but for the page, and Clear filters clears the sort too,
 * keeping only those named in `keep`, such as a tab. With `saved`, that
 * list's saved filters are a chip (ui/SavedFilters) at the right of the first
 * row, with a way to save what's on while anything is; Clear filters shows
 * with one loaded, and unloads it.
 */
export default function FilterBar({
  path,
  values,
  search,
  filters,
  keep = [],
  saved,
}: {
  path: string;
  values: Params;
  search: { name: string; label: string };
  filters: Filter[];
  keep?: string[];
  saved?: SavedFiltersProps;
}) {
  const href = (changes: Params) => filtersPath(path, values, { ...changes, page: "" });
  const chosen = (name: string) => valuesOf(values[name]);
  // Removing a filter removes those that come after it, and a place's distance.
  const without = (name: string) =>
    Object.fromEntries(
      [
        name,
        ...filters.filter((f) => f.after === name).map((f) => f.name),
        ...filters.filter((f) => f.name === name && f.place).map((f) => f.place!.within),
      ].map((n) => [n, ""]),
    );
  // Those on, a filter with its own button first, where its button was.
  const on = filters
    .filter((filter) => chosen(filter.name).length > 0)
    .sort((a, b) => Number(Boolean(b.own)) - Number(Boolean(a.own)));
  const ownButtons = filters.filter((filter) => filter.own && chosen(filter.name).length === 0);
  // Those "+ Filter" offers, each with the choices it offers: one not on, or one that repeats, its other
  // choices, found or left out; a place, its form. Except offers those that repeat.
  const offered = filters
    .filter(
      (filter) =>
        !filter.after &&
        !filter.own &&
        !filter.linkedOnly &&
        !filter.locked &&
        (filter.repeat || chosen(filter.name).length === 0),
    )
    .map((filter) => {
      const taken = chosen(filter.name).map((value) => {
        const plain = notValue(value).value;
        return parts(filter, plain).first?.value ?? plain;
      });
      return { filter, options: filter.options.filter((option) => option.value && !taken.includes(option.value)) };
    })
    .filter(({ filter, options }) => filter.place || options.length > 0);
  const negatable = offered.filter(({ filter }) => filter.repeat);
  const hidden = Object.entries(values)
    .filter(([name]) => name !== search.name && name !== "page")
    .flatMap(([name, value]) => valuesOf(value).map((one) => [name, one] as const));
  const kept = Object.fromEntries(
    [...keep, ...filters.filter((f) => f.locked).map((f) => f.name)].map((name) => [name, values[name] ?? ""]),
  );
  const label = (filter: Filter, value: string) =>
    filter.options.find((option) => option.value === value)?.label ?? value;
  // A place filter's chip: the words found, and how far.
  const placeLabel = (filter: Filter, value: string) => {
    const within = firstOf(values[filter.place!.within]);
    const distance = filter.place!.distances.find((d) => d.value === within) ?? filter.place!.distances[1];
    return `${filter.label}: ${label(filter, value)}, ${distance.label}`;
  };
  // Every parameter but a place filter's own and the page, for its form to keep.
  const othersThan = (filter: Filter) =>
    hidden.filter(([name]) => name !== filter.name && name !== filter.place!.within) as [string, string][];
  // A filter's chip, for `value` of it: its menu has its choices and, but in a chip's second half, a way to
  // remove it. A choice in a first half or a chip of its own takes the filter's place, with the second part it had,
  // by its `like`, where the new choice has one the same, else the choice's own; one in the second half of a
  // choice in two parts, which offers its `seconds`, changes that one value, keeping it found or left out. More
  // than one value of a filter that doesn't repeat can only come from a link or a saved filter: each has its chip.
  const chip = (
    filter: Filter,
    value: string,
    text: ReactNode,
    second = false,
    seconds?: { options: FilterOption[]; current: string },
  ) => {
    const { value: plain, not } = notValue(value);
    const others = chosen(filter.name).filter((v) => v !== value);
    const like = parts(filter, plain).second?.like;
    // The new choice's second part the same as the one it had, if there was one and it has it.
    const same = (v: string) =>
      (like && filter.options.find((o) => o.value === v)?.seconds?.find((o) => o.like === like)?.value) || v;
    const choose = (v: string) =>
      seconds
        ? href({ [filter.name]: [...others, not ? NOT + v : v] })
        : href({ ...without(filter.name), [filter.name]: same(v) });
    if (filter.locked) {
      // There, saying what it is and why it can't change, but not opening.
      return (
        <span
          key={`${filter.name}-${value}${seconds ? "-2" : ""}`}
          className={`${styles.chip} ${styles.locked}`}
          title={filter.locked}
        >
          {not && <NotIcon />}
          {text}
          {/* At the end of the lozenge: in its second half, if it has two. */}
          {(second || !parts(filter, plain).first?.seconds) && <LockIcon />}
        </span>
      );
    }
    return (
      <Menu
        key={`${filter.name}-${value}${seconds ? "-2" : ""}`}
        id={`filter-${filter.name}-${value}${seconds ? "-2" : ""}`}
        trigger={not ? `${styles.chip} ${styles.not}` : styles.chip}
        label={
          <>
            {not && <NotIcon />}
            {text}
          </>
        }
      >
        <p className={styles.heading}>{filter.label}</p>
        {filter.place ? (
          <PlaceForm path={path} filter={filter} values={values} others={othersThan(filter)} />
        ) : (
          <Choices
            options={seconds?.options ?? filter.options}
            current={[seconds?.current ?? parts(filter, plain).first?.value ?? plain]}
            href={choose}
            search={filter.searchable ? copy.narrow : undefined}
          />
        )}
        {!second && (
          <p className={styles.actions}>
            <StaffLink href={others.length > 0 ? href({ [filter.name]: others }) : href(without(filter.name))}>
              {copy.remove}
            </StaffLink>
          </p>
        )}
      </Menu>
    );
  };
  // A repeating filter's values, found or left out, without their marks.
  const side = (filter: Filter, not: boolean) =>
    chosen(filter.name)
      .map(notValue)
      .filter((one) => one.not === not)
      .map((one) => one.value);
  // A repeating filter's chip for all it finds, or all it leaves out, if any; as a lozenge's second half, `half`,
  // always.
  const manyChip = (filter: Filter, not: boolean, half = false) => {
    const here = side(filter, not);
    if (here.length === 0 && !half) return null;
    const elsewhere = side(filter, !not);
    return (
      <ManyChoices
        key={`${filter.name}-${not}`}
        path={path}
        values={values}
        name={filter.name}
        label={filter.label}
        all={chosen(filter.name)}
        here={here}
        not={not}
        oneEach={Boolean(filter.oneEach)}
        options={[
          ...here.filter((v) => !parts(filter, v).first).map((value) => ({ value, label: value })),
          ...filter.options.filter((o) => (o.value || filter.after) && !elsewhere.includes(o.value)),
        ]}
        every={everyChoice(filter)}
        search={filter.searchable ? copy.narrow : undefined}
        turns={!filter.after}
        half={half}
      />
    );
  };
  // "+ Filter"'s menu, or Except's: a filter a row, its choices opening under it, one at a time; a choice
  // added found, or left out.
  const groups = (list: typeof offered, not: boolean) => (
    <div className={styles.groups}>
      {list.map(({ filter, options }) => (
        <details key={filter.name} name={not ? "filter-except" : "filter-add"} className={styles.group}>
          <summary>{filter.label}</summary>
          {filter.place ? (
            <PlaceForm path={path} filter={filter} values={values} others={othersThan(filter)} />
          ) : (
            <Choices
              options={options}
              current={[]}
              href={(v) =>
                href({
                  [filter.name]: chosenValues({
                    all: chosen(filter.name),
                    was: side(filter, not).map((one) => (not ? NOT + one : one)),
                    chosen: [...side(filter, not), v],
                    not,
                    oneEach: Boolean(filter.oneEach),
                    every: everyChoice(filter),
                  }),
                })
              }
              search={filter.searchable ? copy.narrow : undefined}
            />
          )}
        </details>
      ))}
    </div>
  );
  return (
    <>
      <FilterBarLines urlKey={filtersPath(path, values)} className={styles.bar}>
        <Form action={path} className={styles.search} role="search">
          <span className={styles.box}>
            <TextInput
              type="search"
              name={search.name}
              defaultValue={firstOf(values[search.name])}
              aria-label={search.label}
              placeholder={search.label}
            />
            {values[search.name] && (
              <StaffLink href={href({ [search.name]: "" })} className={styles.clear} aria-label={copy.clearSearch}>
                ×
              </StaffLink>
            )}
          </span>
          {hidden.map(([name, value]) => (
            <input key={`${name}-${value}`} type="hidden" name={name} value={value} />
          ))}
          <Button variant="primary" size="small" fit type="submit">
            {staffCopy.search}
          </Button>
          <FormPending />
        </Form>
        {saved && (
          <SavedFilters key={saved.version} {...saved} canSave={on.length > 0 || Boolean(values[search.name])} />
        )}
        <div className={styles.chips}>
          {ownButtons.map((filter) => (
            <Menu
              key={filter.name}
              id={`filter-${filter.name}`}
              trigger={`${styles.add} ${styles.own}`}
              label={filter.label}
            >
              <p className={styles.heading}>{filter.label}</p>
              <Choices
                options={filter.options.filter((option) => option.value)}
                current={[]}
                href={(v) => href({ [filter.name]: v })}
              />
            </Menu>
          ))}
          {on
            .filter((filter) => !(filter.after && chosen(filter.after).length > 0))
            .flatMap((filter) => {
              const next = filters.find((f) => f.after === filter.name);
              const value = firstOf(values[filter.name]);
              if (next) {
                // A filter and the one that comes after it: one lozenge in two halves, each its own menu.
                const nextValue = firstOf(values[next.name]);
                return (
                  <span key={filter.name} className={styles.pair} role="group" aria-label={filter.label}>
                    {chip(filter, value, label(filter, value))}
                    {next.repeat ? manyChip(next, false, true) : chip(next, nextValue, label(next, nextValue), true)}
                  </span>
                );
              }
              if (filter.place) return chip(filter, value, placeLabel(filter, value));
              if (filter.repeat) return [manyChip(filter, false), manyChip(filter, true)];
              return chosen(filter.name).map((one) => {
                const { value: plain, not } = notValue(one);
                const { first, second } = parts(filter, plain);
                if (!first?.seconds) return chip(filter, one, valueWords(filter, one, ": "));
                // A choice in two parts: one lozenge in two halves, the second narrowing the first.
                // Its group's icon before its words, so "PauseAI UK" says which.
                const named = first.group ? (
                  <>
                    <span className={styles.chipIcon}>{first.group.icon}</span>
                    {first.label}
                  </>
                ) : (
                  first.label
                );
                const words = not ? (
                  <>
                    <NotWords label={filter.label} />
                    {named}
                  </>
                ) : (
                  <>
                    {filter.label}: {named}
                  </>
                );
                return (
                  <span key={`${filter.name}-${one}`} className={styles.pair} role="group" aria-label={filter.label}>
                    {chip(filter, one, words)}
                    {chip(filter, one, (second ?? first.seconds[0]).label, true, {
                      options: first.seconds,
                      current: plain,
                    })}
                  </span>
                );
              });
            })}
          {offered.length > 0 &&
            (negatable.length > 0 ? (
              // "+ Filter" and Except: one lozenge, cut down the middle, a menu each.
              <span className={styles.pair} role="group" aria-label={copy.add}>
                <Menu id="filter-add" trigger={styles.add} label={copy.add}>
                  {groups(offered, false)}
                </Menu>
                <Menu
                  id="filter-except"
                  trigger={styles.add}
                  label={
                    <>
                      <NotIcon />
                      {copy.except}
                    </>
                  }
                >
                  <p className={styles.groupsHeading}>{copy.exceptHeading}</p>
                  {groups(negatable, true)}
                </Menu>
              </span>
            ) : (
              <Menu id="filter-add" trigger={styles.add} label={copy.add}>
                {groups(offered, false)}
              </Menu>
            ))}
          {(on.length > 0 || values[search.name] || saved?.loaded) && (
            <StaffLink href={filtersPath(path, kept)} className={styles.clearAll}>
              {staffCopy.resetFilters}
            </StaffLink>
          )}
        </div>
      </FilterBarLines>
      {saved && <SavedFilterGone words={goneWords(filters, saved.gone)} />}
    </>
  );
}
