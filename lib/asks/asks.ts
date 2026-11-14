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
/** ControlAI's letter to the Prime Minister backing the Artificial Superintelligence Bill. */
export const CONTROLAI_LETTER_ASK = "controlai-letter";
/** ControlAI's UK campaign statement, which politicians back on its page. */
export const CONTROLAI_STATEMENT_ASK = "controlai-statement";

/**
 * The asks the code names, by slug, which staff can edit but never delete:
 * a campaign, the public list of signatories or an import depends on them.
 */
export const NAMED_ASKS: readonly string[] = [FRONTIER_AI_LETTER_ASK, CONTROLAI_LETTER_ASK, CONTROLAI_STATEMENT_ASK];

/**
 * The asks an import answers, which staff can't: ControlAI's letter and
 * statement (lib/jobs/controlai-import.server.ts, controlai-statement-import.server.ts).
 */
export const IMPORTED_ASKS: readonly string[] = [CONTROLAI_LETTER_ASK, CONTROLAI_STATEMENT_ASK];

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
