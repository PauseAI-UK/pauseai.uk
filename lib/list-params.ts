// A staff list's URL parameters: each as typed, one value or several, a
// filter's values that leave out marked with NOT, and the list's URL
// again with some changed. Every list reads its URL with these
// (lib/staff-lists.ts, lib/staff-search.ts).

/** A list's page from its URL: a whole number from 1, or the first page. */
export function pageNumber(page = ""): number {
  return /^\d+$/.test(page) && Number(page) > 0 ? Number(page) : 1;
}

/** A list's URL at a page: the first page at the list's own, any other with `?page=`. */
export function pagePath(path: string, page: number): string {
  return page > 1 ? `${path}?page=${page}` : path;
}

/** A URL parameter's value: one, or a list, for a filter chosen more than once, its name repeated in the URL. */
export type ParamValue = string | string[];

/**
 * The mark between a value of a filter that comes after a repeating one and
 * the value of that one it goes with: `answer=frontier-ai-letter.signed` is
 * those who signed the frontier AI letter, among the asks chosen.
 */
export const PAIR = ".";

/** A value of a filter that comes after a repeating one, for `of`, that one's value. */
export function pairedValue(of: string, value: string): string {
  return `${of}${PAIR}${value}`;
}

/** A value of a filter that comes after a repeating one: the value of that one it goes with, if it names one, and its own. */
export function unpaired(value: string): { of?: string; value: string } {
  const at = value.indexOf(PAIR);
  return at < 0 ? { value } : { of: value.slice(0, at), value: value.slice(at + PAIR.length) };
}

/**
 * The values of a filter that comes after a repeating one, `values`, each
 * paired with one of `of`, that one's values: one not paired goes with the
 * first, and one paired with a value not chosen, or with nothing after its
 * mark, goes. Each keeps its NOT.
 */
export function pairedValues(of: string[], values: string[]): string[] {
  return values.flatMap((one) => {
    const { value, not } = notValue(one);
    const pair = unpaired(value);
    const owner = pair.of ?? of[0];
    if (!pair.value || !owner || !of.includes(owner)) return [];
    return [(not ? NOT : "") + pairedValue(owner, pair.value)];
  });
}

/** A list's parameters, each as typed. */
export type Params = Record<string, ParamValue>;

/** Every value of a parameter, the blanks left out. */
export function valuesOf(value: ParamValue | undefined): string[] {
  return (Array.isArray(value) ? value : [value ?? ""]).filter(Boolean);
}

/** The mark before a value a filter leaves out, in its URL: `event=!evt-2` is those not at evt-2. */
export const NOT = "!";

/** A filter's value without its mark, and whether it's one the filter leaves out. */
export function notValue(value: string): { value: string; not: boolean } {
  return value.startsWith(NOT) ? { value: value.slice(NOT.length), not: true } : { value, not: false };
}

/**
 * A repeating filter's values, split: those it finds any of, then those it
 * leaves out, each read by `read`, which drops what it doesn't know; a
 * list with none is undefined.
 */
export function anyAndNone<T>(values: string[], read: (values: string[]) => T[]): [T[] | undefined, T[] | undefined] {
  const [any, none] = [false, true].map((not) =>
    read(
      values
        .map(notValue)
        .filter((one) => one.not === not && one.value)
        .map((one) => one.value),
    ),
  );
  return [any.length ? any : undefined, none.length ? none : undefined];
}

/** The fields of `fields` that are on, or undefined if none is: what a filter leaves out. */
export function notOf<T extends object>(fields: T): Partial<T> | undefined {
  const on = Object.entries(fields).filter(([, value]) => value !== undefined);
  return on.length ? (Object.fromEntries(on) as Partial<T>) : undefined;
}

/** A parameter that takes one value: its first, or blank. */
export function firstOf(value: ParamValue | undefined): string {
  return valuesOf(value)[0] ?? "";
}

/**
 * A list's URL with its filters as typed, `changes` made to them, leaving
 * out the blank ones; a list's values each as the parameter again.
 */
export function filtersPath(path: string, filters: Params, changes: Params = {}): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries({ ...filters, ...changes })) {
    for (const one of valuesOf(value)) params.append(name, one);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * A list's own URL, with nothing on, while any of `values`, its search and
 * filters as typed, is on: where clearing them leads. Nothing while none is.
 */
export function clearedTo(path: string, values: Params): string | undefined {
  return Object.values(values).some((value) => valuesOf(value).length > 0) ? path : undefined;
}

/** The `page` of a list's URL at page `n`: none for the first. */
export function pageParam(n: number): { page: string } {
  return { page: n > 1 ? String(n) : "" };
}

/** The values of `values` that are among `known`. */
export function among<T extends string>(values: string[], known: readonly T[]): T[] {
  return values.filter((value): value is T => (known as readonly string[]).includes(value));
}
