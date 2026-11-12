// Which organisation a piece of text is about, by the rules at the top of
// lib/content/press-coverage.ts: PauseAI UK, PauseAI Global, and two that
// aren't us, PauseAI US and the unrelated PauseAI.com. "Pause AI" is also
// an ordinary phrase ("Meta to pause AI training"), which on its own is no
// connection at all. These are patterns, not judgement: they rank the
// leads and set aside the plain misses, and a person (or the model, then a
// person) decides the rest.

export type Org = "uk" | "global" | "us" | "lookalike" | "unspecified" | "phrase" | "none";

/** The people each organisation's coverage names, as the file's entries show them. */
export type People = { uk: string[]; global: string[]; us: string[] };

export type Reading = {
  org: Org;
  /** The other organisations the text names too, e.g. "us" beside "uk". */
  also: Org[];
};

const NAMED = {
  uk: /\bpause ?ai(?:'s)? uk\b|\buk (?:branch|chapter|arm) of pause ?ai\b|\bpause ?ai's (?:uk|british) (?:branch|chapter|arm)\b/i,
  global: /\bpause ?ai global\b|\bpauseai\.info\b/i,
  us: /\bpause ?ai (?:us|usa)\b|\bpause ?ai \(us\)|\bpauseai-us\.org\b/i,
  lookalike: /\bpauseai\.com\b/i,
};

// The two-word name as an organisation's, not the phrase: "the Pause AI
// group", "activists from Pause AI".
const ORG_WORDS =
  "group|movement|campaign|campaigners?|activists?|protesters?|protests?|founders?|director|chapter|organi[sz]ation|organi[sz]ers?|members?|spokes(?:person|man|woman)|chief|ceo|volunteers?";
const AS_ORG = new RegExp(
  `\\bpause ai\\b(?:'s)?\\W{0,3}(?:${ORG_WORDS})\\b|\\b(?:${ORG_WORDS})\\W{1,3}(?:(?:called|named|from|of|with|at)\\s)?pause ai\\b`,
  "i",
);

/** Every mention of the name or the phrase, for excerpts. */
export const MENTION = /\bpause ?ai\b/gi;

function names(text: string, people: string[]): boolean {
  return people.some((person) => text.toLowerCase().includes(person.toLowerCase()));
}

/** Which organisation `text` is about, as far as patterns can tell. */
export function readOrg(text: string, people: People): Reading {
  const mentions = /\bpause ?ai\b/i.test(text);
  const found: Org[] = [];
  if (NAMED.uk.test(text) || (mentions && names(text, people.uk))) found.push("uk");
  if (NAMED.global.test(text) || (mentions && names(text, people.global))) found.push("global");
  if (NAMED.us.test(text) || (mentions && names(text, people.us))) found.push("us");
  if (NAMED.lookalike.test(text)) found.push("lookalike");
  if (found.length > 0) return { org: found[0], also: found.slice(1) };
  if (/\bpauseai\b/i.test(text) || AS_ORG.test(text)) return { org: "unspecified", also: [] };
  return { org: mentions ? "phrase" : "none", also: [] };
}

/** Whether coverage of `org` could belong in the file. */
export function couldBeUs(org: Org): boolean {
  return org === "uk" || org === "global" || org === "unspecified";
}

const WEIGHT: Record<Org, number> = {
  uk: 10,
  global: 6,
  unspecified: 4,
  us: -10,
  lookalike: -10,
  phrase: -5,
  none: -8,
};

/** A story's place in the list: who it's about, then a UK outlet, other outlets' copies, and a page that was read. */
export function rank(reading: Reading, { uk, copies, read }: { uk: boolean; copies: number; read: boolean }): number {
  return WEIGHT[reading.org] + (uk ? 2 : 0) + Math.min(copies, 3) + (read ? 2 : 0);
}

/** What `org` means, for the pull request. */
export const ORG_NAMES: Record<Org, string> = {
  uk: "PauseAI UK",
  global: "PauseAI Global",
  us: "PauseAI US, a different organisation",
  lookalike: "PauseAI.com, an unrelated site",
  unspecified: "PauseAI, not saying which",
  phrase: 'only the phrase "pause AI"',
  none: "no mention of PauseAI",
};
