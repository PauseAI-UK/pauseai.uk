import type { ReactNode } from "react";
import Form from "next/form";
import { Button } from "@/components/ui/Button";
import { Select, TextInput } from "@/components/ui/Controls";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { chosenValues } from "@/lib/filter-choices";
import { filtersPath, firstOf, NOT, notValue, pairedValue, unpaired, valuesOf, type Params } from "@/lib/list-params";
import { choiceOf, isGrouped, pairedAfter, pairedSides, valueWords, type Filter } from "@/lib/staff-list-filters";
import Choices from "./Choices";
import FilterBarLines from "./FilterBarLines";
import FormPending from "./FormPending";
import ManyChoices from "./ManyChoices";
import StaffLink from "./StaffLink";
import Menu from "./Menu";
import LockIcon from "./LockIcon";
import IconText from "./IconText";
import NotIcon from "./NotIcon";
import SavedFilters, { SavedFilterGone, type SavedFiltersProps } from "./SavedFilters";
import styles from "./FilterBar.module.css";

const copy = staffVocabulary.filters;

/**
 * For a chip of the list's own (FilterBar's `view`), as a filter's look: on,
 * filled with the accent's tint; off, plain, as a filter's own button; and
 * the heading of its menu.
 */
export const filterChipClass = { on: styles.chip, off: `${styles.add} ${styles.own}`, heading: styles.heading };

/**
 * A filter's choices, without its blank one, its default: leaving out all of
 * them takes the filter off. None for one in groups, as leaving out every
 * consent still finds those with none.
 */
const everyChoice = (filter: Filter) =>
  isGrouped(filter) ? [] : filter.options.map((option) => option.value).filter(Boolean);

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
        aria-label={staffVocabulary.filters.within}
      >
        {place.distances.map((distance) => (
          <option key={distance.value} value={distance.value}>
            {distance.label}
          </option>
        ))}
      </Select>
      <Button variant="primary" size="small" fit type="submit">
        {staffVocabulary.search}
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
 * chip for all it finds and one for all it leaves out, marked so; one that
 * repeats with a filter paired after it, pairedAfter(), a chip for each of
 * its values, then what that one finds for it, then what it leaves out, if
 * anything, which its menu's Except turns round); "+
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
  view,
}: {
  path: string;
  values: Params;
  search: { name: string; label: string };
  filters: Filter[];
  keep?: string[];
  saved?: SavedFiltersProps;
  /** A chip for how the list shows what's found, after + Filter (filterChipClass). */
  view?: ReactNode;
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
  // A repeating filter's values, found or left out, without their marks.
  const side = (filter: Filter, not: boolean) =>
    chosen(filter.name)
      .map(notValue)
      .filter((one) => one.not === not)
      .map((one) => one.value);
  // The filter paired after a repeating one (pairedAfter()), if there is one.
  const pairedNext = (filter: Filter) => filters.find((f) => f.after === filter.name && pairedAfter(filters, f));
  // The values of `next`, paired after a repeating filter, that go with `of`, one of its values.
  const pairedTo = (next: Filter, of: string) =>
    chosen(next.name).filter((one) => unpaired(notValue(one).value).of === of);
  // A filter of its own has its button while it finds nothing, though it may leave some out.
  const ownButtons = filters.filter((filter) => filter.own && side(filter, false).length === 0);
  // A filter with the choices it has yet to make, found or left out.
  const choosable = (filter: Filter) => {
    const taken = chosen(filter.name).map((value) => notValue(value).value);
    return { filter, options: filter.options.filter((option) => option.value && !taken.includes(option.value)) };
  };
  // Those "+ Filter" offers, each with the choices it offers: one not on, or one that repeats, its other
  // choices; a place, its form.
  const offered = filters
    .filter(
      (filter) =>
        !filter.after &&
        !filter.own &&
        !filter.linkedOnly &&
        !filter.locked &&
        (filter.repeat || chosen(filter.name).length === 0),
    )
    .map(choosable)
    .filter(({ filter, options }) => filter.place || options.length > 0);
  // Those Except offers: every one that repeats, its own button's and a locked one's too, but one with a filter
  // paired after it, which leaves out in that one's chip.
  const negatable = filters
    .filter((filter) => filter.repeat && !filter.after && !filter.linkedOnly && !pairedNext(filter))
    .map(choosable)
    .filter(({ options }) => options.length > 0);
  const hidden = Object.entries(values)
    .filter(([name]) => name !== search.name && name !== "page")
    .flatMap(([name, value]) => valuesOf(value).map((one) => [name, one] as const));
  // Clear filters keeps those named in `keep`, and what a locked filter finds.
  const kept = Object.fromEntries([
    ...keep.map((name) => [name, values[name] ?? ""]),
    ...filters.filter((f) => f.locked).map((f) => [f.name, side(f, false)]),
  ]);
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
  // remove it. A choice takes the filter's place. More than one value of a filter that doesn't repeat can only
  // come from a link or a saved filter: each has its chip.
  const chip = (filter: Filter, value: string, text: ReactNode, second = false) => {
    const { value: plain, not } = notValue(value);
    const others = chosen(filter.name).filter((v) => v !== value);
    // One with a filter paired after it changes only this value, and takes what that one has for it too.
    const paired = pairedNext(filter);
    const unpairedFrom = (next: Filter) => ({
      [next.name]: chosen(next.name).filter((one) => !pairedTo(next, value).includes(one)),
    });
    const choose = (v: string) =>
      paired
        ? href({ [filter.name]: chosen(filter.name).map((one) => (one === value ? v : one)), ...unpairedFrom(paired) })
        : href({ ...without(filter.name), [filter.name]: v });
    const remove = paired
      ? href({ [filter.name]: others, ...unpairedFrom(paired) })
      : others.length > 0
        ? href({ [filter.name]: others })
        : href(without(filter.name));
    if (filter.locked && !not) {
      // There, saying what it is and why it can't change, but not opening.
      return (
        <span key={`${filter.name}-${value}`} className={`${styles.chip} ${styles.locked}`} title={filter.locked}>
          {text}
          <LockIcon />
        </span>
      );
    }
    return (
      <Menu
        key={`${filter.name}-${value}`}
        id={`filter-${filter.name}-${value}`}
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
            options={paired ? filter.options.filter((option) => !others.includes(option.value)) : filter.options}
            current={[plain]}
            href={choose}
            search={filter.searchable ? copy.narrow : undefined}
          />
        )}
        {!second && (
          <p className={styles.actions}>
            <StaffLink href={remove}>{copy.remove}</StaffLink>
          </p>
        )}
      </Menu>
    );
  };
  // A filter in groups' chips: one for each group it finds, then one for each it leaves out, each in the order they
  // first come, the group's icon before the choices; a value it doesn't know, alone. Each offers its group's
  // choices to tick, and to swap to, any choice no other chip has. What a locked one finds doesn't open.
  const grouped = (filter: Filter) => {
    const choice = (value: string) => filter.options.find((option) => option.value === value);
    const chips = new Map<string, string[]>();
    for (const one of chosen(filter.name)) {
      const { value: plain, not } = notValue(one);
      const group = choice(plain)?.group;
      const key = group ? [not, group.label].join("|") : `own ${one}`;
      chips.set(key, [...(chips.get(key) ?? []), one]);
    }
    const taken = chosen(filter.name).map((one) => notValue(one).value);
    const finding = (ones: string[]) => !notValue(ones[0]).not;
    return [...chips.values()]
      .sort((a, b) => Number(finding(b)) - Number(finding(a)))
      .map((ones) => {
        const { not } = notValue(ones[0]);
        const here = ones.map((one) => notValue(one).value);
        const first = choice(here[0]);
        if (!first?.group) return chip(filter, ones[0], valueWords(filter, ones[0], ": "));
        const { label: group, icon } = first.group;
        const name = first.group.chip ?? filter.label;
        if (filter.locked && !not) {
          return chip(
            filter,
            ones[0],
            <IconText icon={icon}>
              {name}: {copy.anyOf(here.map((one) => choice(one)!.label))}
            </IconText>,
          );
        }
        const options = filter.options.filter((option) => here.includes(option.value) || !taken.includes(option.value));
        return (
          <ManyChoices
            key={`${filter.name}-${ones.join(" ")}`}
            id={`filter-${filter.name}-${ones.join("-")}`}
            path={path}
            values={values}
            name={filter.name}
            label={name}
            all={chosen(filter.name)}
            here={here}
            not={not}
            oneEach={false}
            options={options}
            boxOptions={options.filter((option) => option.group?.label === group)}
            every={everyChoice(filter)}
            turns={!filter.locked}
            half={false}
            icon={icon}
          />
        );
      });
  };
  // A repeating filter's chip for all it finds, or all it leaves out, if any.
  const manyChip = (filter: Filter, not: boolean) => {
    const here = side(filter, not);
    if (here.length === 0) return null;
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
          ...here.filter((v) => !choiceOf(filter, v)).map((value) => ({ value, label: value })),
          ...filter.options.filter((o) => o.value && !elsewhere.includes(o.value)),
        ]}
        every={everyChoice(filter)}
        search={filter.searchable ? copy.narrow : undefined}
        turns
        half={false}
      />
    );
  };
  // A half of the lozenge for `of`, a value of a repeating filter, of what `next`, paired after it, finds or leaves
  // out for it: its own choices, its default blank, and those on its other half left out.
  const pairedHalf = (next: Filter, of: string, not: boolean) => {
    const blank = pairedValue(of, "");
    const [found, out] = pairedSides(next, values, of);
    const elsewhere = not ? found : out;
    const options = next.options
      .filter((o) => unpaired(o.value).of === of && !elsewhere.includes(o.value))
      .map((o) => ({ ...o, value: o.value === blank ? "" : o.value, under: o.under === blank ? "" : o.under }));
    return (
      <ManyChoices
        key={`${next.name}-${of}-${not}`}
        id={`filter-${next.name}-${of}-${not ? "left-out" : "found"}`}
        path={path}
        values={values}
        name={next.name}
        label={label(
          filters.find((f) => f.name === next.after)!,
          of,
        )}
        all={chosen(next.name)}
        here={not ? out : found}
        not={not}
        oneEach={false}
        options={options}
        every={[]}
        turns
        half
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
            {staffVocabulary.search}
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
                href={(v) => href({ [filter.name]: [...chosen(filter.name), v] })}
              />
            </Menu>
          ))}
          {on
            .filter((filter) => !(filter.after && chosen(filter.after).length > 0))
            .flatMap((filter) => {
              const paired = pairedNext(filter);
              if (paired) {
                // Each of its values and what the filter paired after it finds for it, then leaves out, if anything:
                // one lozenge, a menu each part.
                return chosen(filter.name).map((of) => {
                  const [found, out] = pairedSides(paired, values, of);
                  return (
                    <span
                      key={`${filter.name}-${of}`}
                      className={styles.pair}
                      role="group"
                      aria-label={label(filter, of)}
                    >
                      {chip(filter, of, label(filter, of))}
                      {(found.length > 0 || out.length === 0) && pairedHalf(paired, of, false)}
                      {out.length > 0 && pairedHalf(paired, of, true)}
                    </span>
                  );
                });
              }
              const next = filters.find((f) => f.after === filter.name);
              const value = firstOf(values[filter.name]);
              if (next) {
                // A filter and the one that comes after it: one lozenge in two halves, each its own menu.
                const nextValue = firstOf(values[next.name]);
                return (
                  <span key={filter.name} className={styles.pair} role="group" aria-label={filter.label}>
                    {chip(filter, value, label(filter, value))}
                    {chip(next, nextValue, label(next, nextValue), true)}
                  </span>
                );
              }
              if (filter.place) return chip(filter, value, placeLabel(filter, value));
              if (isGrouped(filter)) return grouped(filter);
              if (filter.repeat) return [manyChip(filter, false), manyChip(filter, true)];
              return chosen(filter.name).map((one) => chip(filter, one, valueWords(filter, one, ": ")));
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
          {view}
          {(on.length > 0 || values[search.name] || saved?.loaded) && (
            <StaffLink href={filtersPath(path, kept)} className={styles.clearAll}>
              {staffVocabulary.resetFilters}
            </StaffLink>
          )}
        </div>
      </FilterBarLines>
      {saved && <SavedFilterGone words={goneWords(filters, saved.gone)} />}
    </>
  );
}
