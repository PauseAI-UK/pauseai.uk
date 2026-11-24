// The correspondence list's filter bar (lib/staff-list-filters.ts).
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { POLITICIAN_FLAGS } from "@/lib/politician-flags";
import type { EmailChoice } from "./all-letters.server";
import { WINDOW_OPTIONS } from "@/lib/time-windows";
import { ALL_EMAILS_LIST } from "@/lib/staff-lists";
import { EMAIL_SENDERS, EMAIL_TYPES } from "@/lib/staff-search";
import { lettersCopy } from "./copy";
import { listFilters } from "@/lib/staff-list-filters";

/**
 * Every email with a politician's filters, in the columns' order: who it's
 * from and what it's about, for staff without `supporters` not supporters'
 * or a campaign's; who it's to, searched for among `people`; when it was
 * sent, and whether it got a reply.
 */
export const ALL_EMAIL_FILTERS = listFilters(
  ALL_EMAILS_LIST,
  ({ supporters, people }: { supporters: boolean; people: EmailChoice[] }) => {
    const copy = lettersCopy.allLetters;
    return {
      from: {
        label: copy.from,
        oneEach: true,
        options: EMAIL_SENDERS.filter((kind) => supporters || kind !== "supporter").map((kind) => ({
          value: kind,
          label: copy.fromKinds[kind],
        })),
      },
      to: {
        label: lettersCopy.letters.columns.to,
        searchable: true,
        options: people.map((person) => ({
          value: String(person.id),
          label: person.constituency ? staffVocabulary.mpChoice(person.name, person.constituency) : person.name,
        })),
      },
      type: {
        label: copy.topic,
        oneEach: true,
        options: EMAIL_TYPES.filter((type) => supporters || type !== "campaign").map((type) => ({
          value: type,
          label: copy.types[type],
        })),
      },
      sent: { label: copy.sent, options: WINDOW_OPTIONS },
      replied: {
        label: copy.replied,
        options: [
          { value: "yes", label: copy.repliedChoices.yes },
          { value: "no", label: copy.repliedChoices.no },
          ...WINDOW_OPTIONS,
        ],
      },
      // Test MPs' emails show only with Test politician chosen.
      flag: {
        label: lettersCopy.letters.mpFlag,
        options: POLITICIAN_FLAGS.map((flag) => ({ value: flag, label: staffVocabulary.politicianFlags[flag] })),
      },
    };
  },
);
