// How a feature declares the problems it can report (docs/code-structure.md,
// "Errors"): each by a name, with the sentence that says it, in the
// feature's copy file. A problem is known by its code, the feature's name
// and its own ("letters.copyNotSentYet"), which is how a run's alert tells
// one it has told staff about from a new one, whatever letter or event it's
// about this time. What varies goes in its values, and its sentence is
// written from them as it's reported and kept beside the code, for the
// pages and emails that show it. Reporting one is problem()'s
// (lib/server/problems.server.ts), on the server; this module is the
// declaring, which a copy file that the browser loads can do too.

declare const SAFE: unique symbol;

/**
 * Text that may be kept in a problem's values, as it names no private
 * person outside the staff: made only by publicText(), outsideId() and
 * staffAccount(), so every place that keeps text with a problem can be
 * found by searching for them.
 */
export type SafeText = string & { readonly [SAFE]: true };

/**
 * Marks text as public, so it may be one of a problem's values: a
 * politician's name, a template's name, the name of a character set. Never
 * a supporter's, volunteer's or constituent's name or address, which a
 * problem names by an ID.
 */
export function publicText(text: string): SafeText {
  return text as SafeText;
}

/**
 * Marks an outside service's ID for something as one of a problem's values:
 * Gmail's for a message, Luma's for an event. It says nothing of a person
 * to anyone without the service's own records.
 */
export function outsideId(id: string): SafeText {
  return id as SafeText;
}

/**
 * Marks a staff member's account, by its address, as one of a problem's
 * values: the mailbox a problem is about. The import log and the audit log
 * name staff by it already (who started a run, who made a change). Never
 * the address of anyone who isn't staff.
 */
export function staffAccount(address: string): SafeText {
  return address as SafeText;
}

/** A list as a problem's sentence says it: its items, with commas between. */
export function listed(items: readonly (string | number)[]): string {
  return items.join(", ");
}

/**
 * A value as a problem may keep it: a number, a yes or no, one of a fixed
 * set of codes, SafeText, or a list of those. Plain text is `never`, as
 * that's what a name or an address is.
 */
type SafeValue<Value> = Value extends number | boolean
  ? Value
  : Value extends string
    ? string extends Value
      ? never
      : Value
    : Value extends readonly (infer Item)[]
      ? readonly SafeValue<Item>[]
      : never;

type SafeValues<Values> = { [Name in keyof Values]: SafeValue<Values[Name]> };

/** What a problem's values can hold, once kept. */
export type ProblemValue = number | boolean | string | readonly ProblemValue[];
export type ProblemValues = { readonly [name: string]: ProblemValue };

declare const DECLARED: unique symbol;

/**
 * A problem as it happened, for problem() to report: its code, its values,
 * and its sentence, written from them. Made only by what defineProblems()
 * returns, so nothing reports a sentence written in place.
 */
export type Reported = {
  readonly code: string;
  readonly values: ProblemValues;
  readonly what: string;
  readonly [DECLARED]: true;
};

/**
 * A problem as it's kept on a run (import_runs.problems): the code it's
 * known by, its values, and its sentence; `said` is the error's own words,
 * if it came from one; `told` when an alert of its own has gone, so the
 * run's alert leaves it out. One kept before problems had codes has its
 * sentence alone, and the error's words as `error`.
 */
export type Problem = {
  code?: string;
  values?: ProblemValues;
  what: string;
  said?: string;
  error?: string;
  told?: true;
};

/** A problem as problem() keeps it: one with a code, as every one reported since problems had them is. */
export type ReportedProblem = Problem & { code: string };

/** What tells one problem from another: its code, or the sentence of one kept before problems had codes. */
export function problemKey(problem: Problem): string {
  return problem.code ?? problem.what;
}

/** The error's own words kept with a problem, if it came from one. */
export function problemSaid(problem: Problem): string | undefined {
  return problem.said ?? problem.error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the widest function a sentence can be: each one's own values are checked by Checked, below.
type Sentence = string | ((values: any) => string);

/** What stands in place of a sentence whose values could hold plain text, so the type error says what to do. */
type Unsafe =
  "A problem's values are numbers, fixed codes, publicText(), outsideId() and staffAccount(): never plain text.";

/** Each sentence as it was declared, or Unsafe in place of one whose values could hold plain text. */
type Checked<Sentences> = {
  [Name in keyof Sentences]: Sentences[Name] extends (values: infer Values) => string
    ? [Values] extends [SafeValues<Values>]
      ? Sentences[Name]
      : Unsafe
    : Sentences[Name];
};

/** What a declared problem becomes: a function of its values, or of nothing, that says it happened. */
type Declared<Sentences> = {
  [Name in keyof Sentences]: Sentences[Name] extends (values: infer Values) => string
    ? (values: Values) => Reported
    : () => Reported;
};

/**
 * Declares `feature`'s problems: each one's name, and its sentence, either
 * as it stands or written from its values. Returns a function for each,
 * which says it happened, for problem() to report:
 *
 *     export const letterProblems = defineProblems("letters", {
 *       copyNotSentYet: (p: { letter: number }) => `The copy of letter ${p.letter} couldn't be sent`,
 *     });
 *     problem(letterProblems.copyNotSentYet({ letter: id }), error);
 *
 * A problem's code is the feature's name and its own, so renaming either
 * makes it a new problem to every run that has reported it. The values are
 * IDs, counts and codes, which the types hold (SafeValue): what's kept with
 * a problem names nobody, so erasing a person leaves nothing behind in one.
 */
export function defineProblems<Sentences extends Record<string, Sentence>>(
  feature: string,
  sentences: Sentences & Checked<Sentences>,
): Declared<Sentences> {
  const declared = Object.entries<Sentence>(sentences).map(([name, sentence]) => [
    name,
    (values: ProblemValues = {}) => ({
      code: `${feature}.${name}`,
      values,
      what: typeof sentence === "string" ? sentence : sentence(values),
    }),
  ]);
  return Object.fromEntries(declared) as Declared<Sentences>;
}
