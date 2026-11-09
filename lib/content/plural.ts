// Each plural in the copy names both its words in full, as English plurals
// aren't one rule ("entry", "entries"; "person", "people").

const rules = new Intl.PluralRules("en-GB");

/** `one` for a count of one, `other` for any other count. */
export const plural = (n: number, one: string, other: string) => (rules.select(n) === "one" ? one : other);

/** The count, then its word: "1 letter", "2 letters". */
export const count = (n: number, one: string, other: string) => `${n} ${plural(n, one, other)}`;
