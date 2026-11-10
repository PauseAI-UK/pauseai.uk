// Asks: what we ask notable people to do whose answer we record, such as
// signing a letter or coming to an event. Each is a row of the asks table,
// added by staff on /staff/asks or by a migration; a person's answer to one
// is a status (ask_statuses), and each kind of ask allows its own statuses,
// as the table ask_kind_statuses does, so a new status needs a migration.

/**
 * Each kind's answers, in the order they're shown: a yes, "other", a no.
 * What an "other" answer was is its note, such as "Tentatively said yes".
 */
export const ASK_STATUSES = {
  letter: ["signed", "other", "declined"],
  event: ["going", "other", "declined"],
} as const;

export type AskKind = keyof typeof ASK_STATUSES;
export type AskStatus = (typeof ASK_STATUSES)[AskKind][number];

/** Each kind's answers in the order staff pick from them, on a politician's page: the yes, the no, then "other". */
export const ANSWER_CHOICES: Record<AskKind, readonly AskStatus[]> = {
  letter: ["signed", "declined", "other"],
  event: ["going", "declined", "other"],
};

/**
 * Airtable's words for answers that are neither a yes nor a no, each with
 * the note an "other" answer gets for it. The migration that brought in
 * "other" (0094_ask_statuses_other.sql) wrote the same notes, so the imports
 * leave them as they are.
 */
const AIRTABLE_ANSWER_NOTES: Record<string, string> = {
  "Tentative yes": "Tentatively said yes",
  "Meeting with staff": "Meeting a member of their staff instead",
  "Tentative meeting with staff": "Tentatively agreed to a meeting with a member of their staff",
  "Declined but surgery appointment": "Declined, but offered a surgery appointment instead",
  "Passed on request": "Passed the request on",
};

/** The note for an "other" answer Airtable gave as `value`: a fuller wording if there is one, else the value itself. */
export const airtableNote = (value: string): string => AIRTABLE_ANSWER_NOTES[value] ?? value;

/** Who asks it: supporters, in their letters or in person, PauseAI, in its own emails, or ControlAI. */
export type Asker = "supporters" | "pauseai" | "controlai";

/** Each ask's status for one person, keyed by the ask's slug. */
export type AskStatuses = Partial<Record<string, AskStatus>>;

/**
 * The answers that mean they agreed to what was asked: signed the letter, or
 * are going to the event. Nothing less counts, not an "other" such as a
 * tentative yes, wherever the site counts asks agreed.
 */
export const AGREED_STATUSES: readonly AskStatus[] = ["signed", "going"];

/** How many asks someone agreed to, by their answers (AGREED_STATUSES). */
export function asksAgreed(statuses: Record<string, { status: AskStatus }>): number {
  return Object.values(statuses).filter((answer) => AGREED_STATUSES.includes(answer.status)).length;
}

/** Where an ask's name leads: its own page. */
export const askHref = (slug: string) => `/staff/asks/${slug}`;

/** PauseAI's frontier AI letter to the Prime Minister. */
export const FRONTIER_AI_LETTER_ASK = "frontier-ai-letter";
/** PauseAI's 2025 letter to Sir Demis Hassabis of Google DeepMind. */
export const DEEPMIND_LETTER_ASK = "deepmind-letter";
/** ControlAI's campaign statement, which parliamentarians have signed since February 2025. */
export const CONTROLAI_STATEMENT_ASK = "controlai-statement";
/** ControlAI's letter to the Prime Minister backing the Artificial Superintelligence Bill. */
export const CONTROLAI_LETTER_ASK = "controlai-letter";
/** The conference in Edinburgh, November 2026. */
export const EDINBURGH_CONFERENCE_ASK = "edinburgh-conference-2026";
/** Go to Parliament, 20 October 2026. */
export const GO_TO_PARLIAMENT_ASK = "go-to-parliament-oct-2026";

/** The asks the code names, which staff can't edit or delete: imports and campaigns depend on them. */
export const FIXED_ASKS: readonly string[] = [
  FRONTIER_AI_LETTER_ASK,
  DEEPMIND_LETTER_ASK,
  CONTROLAI_STATEMENT_ASK,
  CONTROLAI_LETTER_ASK,
  EDINBURGH_CONFERENCE_ASK,
  GO_TO_PARLIAMENT_ASK,
];

export const ASKERS: readonly Asker[] = ["supporters", "pauseai", "controlai"];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * A new ask's slug, from its title and, if it has one, its date's month
 * and year: "Go to Parliament" on 2026-10-20 is go-to-parliament-oct-2026.
 * Letters and digits only, so the table's check takes it.
 */
export function askSlug(title: string, date: string | null): string {
  const words = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const when = date ? `${MONTHS[Number(date.slice(5, 7)) - 1]}-${date.slice(0, 4)}` : "";
  return [words || "ask", when].filter(Boolean).join("-");
}
