import type { ReactNode } from "react";
import Form from "next/form";
import { Button } from "@/components/ui/Button";
import { Select, TextInput } from "@/components/ui/Controls";
import { staffCopy } from "@/lib/content/staff-interface";
import { chosenValues } from "@/lib/filter-choices";
import { filtersPath, firstOf, NOT, notValue, valuesOf, type Params } from "@/lib/list-params";
import { choiceParts, valueWords, type Filter, type FilterOption } from "@/lib/staff-list-filters";
import Choices from "./Choices";
import FilterBarLines from "./FilterBarLines";
import FormPending from "./FormPending";
import ManyChoices, { NotWords } from "./ManyChoices";
import StaffLink from "./StaffLink";
import Menu from "./Menu";
import LockIcon from "./LockIcon";
import IconText from "./IconText";
import NotIcon from "./NotIcon";
import SavedFilters, { SavedFilterGone, type SavedFiltersProps } from "./SavedFilters";
import styles from "./FilterBar.module.css";

const copy = staffCopy.filters;

/**
 * For a chip of the list's own (FilterBar's `view`), as a filter's look: on,
 * filled with the accent's tint; off, plain, as a filter's own button; and
 * the heading of its menu.
 */
export const filterChipClass = { on: styles.chip, off: `${styles.add} ${styles.own}`, heading: styles.heading };

/** A filter's choices, without its blank one, its default. */
const everyChoice = (filter: Filter) => filter.options.map((option) => option.value).filter(Boolean);

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
        return choiceParts(filter, plain).first?.value ?? plain;
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
    seconds?: { options: FilterOption[]; current: string; together: string[] },
  ) => {
    const { value: plain, not } = notValue(value);
    // A second part changes for every value of its lozenge.
    const changing = seconds?.together ?? [value];
    const others = chosen(filter.name).filter((v) => !changing.includes(v));
    // Each of the lozenge's values with the second part `v` has: the others share their second parts' likes.
    const withSecond = (v: string) => {
      const to = seconds!.options.find((o) => o.value === v)!.like;
      return changing.map((one) => {
        const next =
          one === value
            ? v
            : choiceParts(filter, notValue(one).value).first!.seconds!.find((o) => o.like === to)!.value;
        return not ? NOT + next : next;
      });
    };
    const choose = (v: string) =>
      seconds
        ? href({ [filter.name]: [...others, ...withSecond(v)] })
        : href({ ...without(filter.name), [filter.name]: v });
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
          {(second || !choiceParts(filter, plain).first?.seconds) && <LockIcon />}
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
            current={[seconds?.current ?? choiceParts(filter, plain).first?.value ?? plain]}
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
  // A lozenge of a choice in two parts, for `ones` of one group and one second part: its first half the firsts,
  // one or more, "+ Add" offering others of the group; its second, their second part, which changes for them all.
  // Its group's icon before its words, so "PauseAI UK" says which.
  const parted = (filter: Filter, ones: string[]) => {
    const { value: plain, not } = notValue(ones[0]);
    const { first, second } = choiceParts(filter, plain);
    const like = (second ?? first!.seconds![0]).like;
    const here = ones.map((one) => notValue(one).value);
    // Each first as it is with this second part, as the lozenge has them and offers them: those that have it, or,
    // with no like to match, its own as it is and each other as the filter has it. Not those another lozenge has.
    const taken = chosen(filter.name).map((one) => notValue(one).value);
    const offered = filter.options
      .flatMap((option) => {
        if (like === undefined) return [option === first ? { ...option, value: plain } : option];
        const same = option.seconds?.find((o) => o.like === like);
        return same ? [{ ...option, value: same.value }] : [];
      })
      .filter((option) => here.includes(option.value) || !taken.includes(option.value));
    const words = (named: ReactNode) =>
      not ? (
        <>
          <NotWords label={filter.label} />
          {named}
        </>
      ) : (
        <>
          {filter.label}: {named}
        </>
      );
    const firsts = here.map((one) => choiceParts(filter, one).first!.label);
    return (
      <span key={`${filter.name}-${ones.join(" ")}`} className={styles.pair} role="group" aria-label={filter.label}>
        {filter.locked ? (
          chip(filter, ones[0], words(<IconText icon={first!.group?.icon}>{copy.anyOf(firsts)}</IconText>))
        ) : (
          <ManyChoices
            id={`filter-${filter.name}-${ones.join("-")}`}
            path={path}
            values={values}
            name={filter.name}
            label={filter.label}
            all={chosen(filter.name)}
            here={here}
            not={not}
            oneEach={false}
            options={offered}
            boxOptions={offered.filter((option) => option.group?.label === first!.group?.label)}
            every={[]}
            turns={false}
            half={false}
            icon={first!.group?.icon}
          />
        )}
        {chip(filter, ones[0], (second ?? first!.seconds![0]).label, true, {
          options: first!.seconds!,
          current: plain,
          together: ones,
        })}
      </span>
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
          ...here.filter((v) => !choiceParts(filter, v).first).map((value) => ({ value, label: value })),
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
              // A choice in two parts: those of one group (a Consent's way) with one second part (its answer),
              // found or left out, one lozenge, "or" between their firsts.
              // In the order they first come; one it doesn't know, or with no like to match, alone.
              const lozenges = new Map<string, string[]>();
              for (const one of chosen(filter.name)) {
                const { value: plain, not } = notValue(one);
                const { first, second } = choiceParts(filter, plain);
                const like = first?.seconds && (second ?? first.seconds[0]).like;
                const key = like === undefined ? `own ${one}` : [not, first!.group?.label, like].join("|");
                lozenges.set(key, [...(lozenges.get(key) ?? []), one]);
              }
              return [...lozenges.values()].map((ones) =>
                choiceParts(filter, notValue(ones[0]).value).first?.seconds
                  ? parted(filter, ones)
                  : chip(filter, ones[0], valueWords(filter, ones[0], ": ")),
              );
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
              {staffCopy.resetFilters}
            </StaffLink>
          )}
        </div>
      </FilterBarLines>
      {saved && <SavedFilterGone words={goneWords(filters, saved.gone)} />}
    </>
  );
}
