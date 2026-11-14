import { NOT_CONDITION } from "./doc";
import { mailingsCopy } from "./copy";

// What a mailing's letter can be filled in with (lib/mailings/doc.ts): the
// merge fields each audience's recipients have, and the conditions a part
// only some get can be for.

/** The merge fields of a mailing to politicians. */
export const POLITICIAN_FIELDS = ["salutation", "name", "constituency", "party", "house"] as const;

/** A condition that someone gave an answer to an ask: "<ask>:<status>". */
export function answerCondition(ask: string, status: string): string {
  return `${ask}:${status}`;
}

/**
 * A merge field or a condition, as the editor offers it: those not every
 * recipient has a value for are ghosted, saying how many lack one; a
 * condition says how many it covers.
 */
export type MailingChoice = {
  id: string;
  label: string;
  lacking?: number;
  /** A field with a word for those lacking a value, so it can be used all the same. */
  fallback?: boolean;
  covers?: number;
  /** For a condition: the ask it's an answer to, and the answer, as a menu offers them, ask then answer. */
  group?: string;
  option?: string;
  /** One of many, as events are: its group's menu has a search box over them, showing none until something's typed, as a searchable filter's has. */
  searchable?: boolean;
};

/**
 * Who a part is for, as its box says it: "Only for those who signed…", or
 * for a condition marked NOT_CONDITION (lib/mailings/doc.ts), "Except
 * those who…"; by the condition's label in `labels`, or its ID with none.
 */
export function partFor(condition: string, labels: Record<string, string>): string {
  const not = condition.startsWith(NOT_CONDITION);
  const id = not ? condition.slice(NOT_CONDITION.length) : condition;
  const who = labels[id] ?? id;
  return not ? mailingsCopy.mailingEditor.exceptLabel(who) : mailingsCopy.mailingEditor.onlyForLabel(who);
}

/**
 * Each answer to each ask, as the editor says a part is for it: "signed
 * the Frontier AI letter", by its condition's ID, whether anyone gave it or not.
 */
export function answerLabels(asks: { slug: string; title: string }[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const ask of asks) {
    for (const [status, words] of Object.entries(mailingsCopy.mailingEditor.answerWords)) {
      labels[answerCondition(ask.slug, status)] = mailingsCopy.mailingEditor.answered(words, ask.title);
    }
  }
  return labels;
}
