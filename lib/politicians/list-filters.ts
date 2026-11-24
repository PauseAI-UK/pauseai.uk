// The politicians list's filter bar (lib/staff-list-filters.ts).
import { ANSWER_CHOICES, INVITED, NEVER_ASKED, REPLIED } from "@/lib/asks/asks";
import { standingWord } from "@/lib/asks/copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { pairedValue, pairedValues, valuesOf, type Params } from "@/lib/list-params";
import { COUNTRIES, EMAIL_STATES } from "./filters";
import { POLITICIAN_FLAGS } from "@/lib/politician-flags";
import type { Ask } from "@/lib/asks/records.server";
import { WINDOW_OPTIONS } from "@/lib/time-windows";
import { POLITICIANS_LIST } from "@/lib/staff-lists";
import { politiciansCopy } from "./copy";
import { listFilters } from "@/lib/staff-list-filters";

/**
 * The politicians list's URL parameters, `params`, as its bar reads them:
 * each answer paired with its ask (pairedValues()), as a mailing or saved
 * filter from before asks were paired may not have it.
 */
export function politicianParams(params: Params): Params {
  const ask = valuesOf(params.ask);
  return { ...params, ask, answer: pairedValues(ask, valuesOf(params.answer)) };
}

/** What the politicians list's bar offers: the asks chosen, and the parties and asks there are. */
export type PoliticianChoices = { ask: string[]; parties: string[]; asks: Ask[] };

/**
 * The politicians list's filters: the table's columns in its order, with
 * the nation after the party and whether we can email them after the
 * status. Status is those in office unless another is chosen. Each ask
 * chosen has its answer, which goes with it: in the order things happen,
 * those asked with no answer yet, the answers its kind allows as staff pick
 * from them, then those never asked; or those it leaves out of them.
 * Party, nation, email, the markers, the asks, the asks they've been mailed
 * about and the answers can each be chosen more than once, the first three
 * having one value each; Except on the asks they've been mailed about finds
 * those not yet mailed about it. How recently they agreed is only from the
 * dashboard's link.
 */
export const POLITICIAN_FILTERS = listFilters(POLITICIANS_LIST, ({ ask: slugs, parties, asks }: PoliticianChoices) => {
  const copy = politiciansCopy.politicians;
  const chosen = slugs.flatMap((slug) => asks.filter((a) => a.slug === slug));
  const askChoices = asks.map((a) => ({ value: a.slug, label: a.title }));
  return {
    nation: {
      label: politiciansCopy.politician.country,
      oneEach: true,
      options: COUNTRIES.map((country) => ({ value: country, label: staffVocabulary.countries[country] })),
    },
    party: {
      label: staffVocabulary.fields.party,
      oneEach: true,
      options: parties.map((party) => ({ value: party, label: party })),
    },
    status: {
      label: copy.status,
      options: [
        { value: "", label: politiciansCopy.personStatuses.in_office },
        ...Object.entries(politiciansCopy.personStatuses)
          .filter(([value]) => value !== "in_office")
          .map(([value, label]) => ({ value, label })),
        { value: "any", label: copy.anyStatus },
      ],
    },
    email: {
      label: staffVocabulary.fields.email,
      oneEach: true,
      options: EMAIL_STATES.map((state) => ({ value: state, label: copy.emailStates[state] })),
    },
    flag: {
      label: copy.flag,
      options: POLITICIAN_FLAGS.map((flag) => ({ value: flag, label: staffVocabulary.politicianFlags[flag] })),
    },
    ask: { label: copy.ask, options: askChoices },
    agreed: { label: copy.agreedIn, options: WINDOW_OPTIONS, linkedOnly: true },
    mailed: { label: copy.mailed, options: askChoices },
    answer: {
      label: copy.answer,
      after: "ask",
      // An ask just chosen starts at those who gave any answer.
      start: REPLIED,
      // An answer is only ever to an ask chosen (politiciansSearch), so with none there's nothing to offer. For each,
      // paired with it: everyone asked, its blank; set in under that, those who haven't answered and those who
      // have, and under them each answer; then, the other way, those never asked.
      options: chosen.flatMap((ask) => {
        const paired = (value: string) => pairedValue(ask.slug, value);
        return [
          { value: paired(""), label: staffVocabulary.everyoneAsked[ask.kind] },
          { value: paired(INVITED), label: staffVocabulary.noReplyYet[ask.kind], under: paired("") },
          { value: paired(REPLIED), label: copy.anyReply, under: paired("") },
          ...ANSWER_CHOICES[ask.kind].map((value) => ({
            value: paired(value),
            label: staffVocabulary.statuses[value],
            under: paired(REPLIED),
          })),
          { value: paired(NEVER_ASKED), label: standingWord(null, ask.kind) },
        ];
      }),
    },
  };
});
