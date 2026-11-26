// Which organisation a piece of text is about, by the coverage's rules
// (RULES in review.ts): PauseAI UK, PauseAI Global, and two that aren't us,
// PauseAI US and the unrelated PauseAI.com. "Pause AI" is also an ordinary
// phrase ("Meta to pause AI training"), which on its own is no connection
// at all. These are patterns, not judgement: without Claude they sort the
// finds staff see first from the plain misses, and staff decide.

export type Org = "uk" | "global" | "us" | "lookalike" | "unspecified" | "phrase" | "none";

/** The people each organisation's coverage names. */
export type People = { uk: string[]; global: string[] };

/** The spokespeople the coverage quotes for each organisation, so a piece quoting one is read as being about it. */
export const PEOPLE: People = {
  uk: ["Joseph Miller", "Tom Bibby"],
  global: ["Maxime Fournes", "Nathaniel Cooke", "Joep Meindertsma"],
};

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
  if (NAMED.us.test(text)) found.push("us");
  if (NAMED.lookalike.test(text)) found.push("lookalike");
  if (found.length > 0) return { org: found[0], also: found.slice(1) };
  if (/\bpauseai\b/i.test(text) || AS_ORG.test(text)) return { org: "unspecified", also: [] };
  return { org: mentions ? "phrase" : "none", also: [] };
}

/** Whether coverage of `org` could be ours. */
export function couldBeUs(org: Org): boolean {
  return org === "uk" || org === "global" || org === "unspecified";
}
