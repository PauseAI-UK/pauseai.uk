// Each staff list's filter bar: its filters, in their order, each named by
// its parameter in the list's definition (lib/staff-lists.ts), with its
// label and choices. Whether one can be chosen more than once is its
// parameter's: one the URL gives several times repeats. What a list's page
// gives its bar (`choices`) is what comes from the database or the page,
// such as the parties, the events, or who's in the log.
import { staffMemberText } from "@/lib/staff-member";
import type { ReactNode } from "react";
import { ANSWER_CHOICES, INVITED, NEVER_ASKED, REPLIED } from "@/lib/asks/asks";
import { standingWord } from "@/lib/asks/copy";
import { WAYS, listsBy, listValue, type List, type Way } from "@/lib/supporters/contact-permissions";
import { staffVocabulary } from "./staff-vocabulary";
import { CAMPAIGN_NAMES } from "./content/campaigns";
import { firstOf, notValue, pairedValue, pairedValues, unpaired, valuesOf, type Params } from "./list-params";
import { COUNTRIES, EMAIL_STATES } from "@/lib/politicians/filters";
import { POLITICIAN_FLAGS } from "@/lib/politician-flags";
import type { EmailChoice } from "@/lib/letters/all-letters.server";
import type { Ask } from "@/lib/asks/records.server";
import type { SupporterChoices, SupportersPage } from "@/lib/supporters/records.server";
import { WINDOW_OPTIONS } from "./time-windows";
import { NO_OWNER, ONLINE } from "@/lib/events/list";
import {
  ALL_EMAILS_LIST,
  AUDIT_LOG_LIST,
  EVENTS_LIST,
  POLITICIANS_LIST,
  SENT_EMAILS_LIST,
  SUPPORTERS_LIST,
  type ParamKinds,
} from "./staff-lists";
import { EMAIL_SENDERS, EMAIL_TYPES, SENT_EMAIL_LINKS, SENT_EMAILS_WITHOUT_SUPPORTERS } from "./staff-search";
import { staffDate } from "./staff-time";
import { NEAR_MILES, SUPPORTER_BADGES } from "@/lib/supporters/supporters";
import { eventsCopy } from "@/lib/events/copy";
import { supportersCopy } from "@/lib/supporters/copy";
import { politiciansCopy } from "@/lib/politicians/copy";
import { lettersCopy } from "@/lib/letters/copy";
import { oversightCopy } from "@/lib/oversight/copy";

/**
 * A choice. Choices in a `group` come under its heading, its icon once,
 * the group named on the chip too, or the chip named `chip` for it in place
 * of the filter's name; a `detail` is said quietly after the words. One
 * `under` another, whose value it names, is set in beneath it, as one of
 * what that one finds, when that one's offered too.
 */
export type FilterOption = {
  value: string;
  label: string;
  group?: { label: string; icon: ReactNode; chip?: string };
  detail?: string;
  /** What the choice means, after its link in a menu, such as a "?" that opens it. */
  help?: ReactNode;
  under?: string;
};

/**
 * One of a list's filters: its URL parameter, its name, and its choices. A
 * choice whose value is blank is the filter's default, offered only to go
 * back to it. One `after` another is chosen in the second half of that
 * one's chip, and goes with it. One that can `repeat` can be chosen more
 * than once, one chip saying them all, and finds what has any of them; it can
 * leave out too, each marked with NOT, in a chip of its own, which finds what
 * has none of them, unless it's `after` another. `oneEach` on one where a record
 * has only one value, so that finding one and leaving out another can't both
 * be needed. One whose choices are in groups has a chip for each group it
 * finds, and one for each it leaves out. A `searchable`
 * one has a box over its choices, which show only once something's typed
 * in it, those that have it. A
 * `place` one takes words typed, a postcode or a town, and how far from it
 * (its parameter `place.within`), in a small form; its options give the
 * words found for what was typed. A `linkedOnly` one isn't offered by "+ Filter":
 * it's on only from a link to the list, a chip like any other once it is.
 */
export type Filter = {
  name: string;
  label: string;
  options: FilterOption[];
  after?: string;
  repeat?: boolean;
  oneEach?: boolean;
  searchable?: boolean;
  place?: { within: string; distances: FilterOption[]; placeholder: string };
  linkedOnly?: boolean;
  /** A filter that matters most: its own button, first, rather than a row in "+ Filter". */
  own?: boolean;
  /** A filter whose chips find one choice each, with no "+ Add" to tick more. */
  oneAtATime?: boolean;
  /**
   * A filter whose finding can't be changed here, and why, said on hovering
   * its chip: that chip is there but doesn't open, with a lock for its arrow,
   * "+ Filter" never offers it, and Clear filters keeps it. What it leaves
   * out can change, as any repeating filter's can.
   */
  locked?: string;
  /**
   * For one paired after a repeating filter (pairedAfter()): the choice it
   * starts at, paired with a value of that one just chosen, in place of its
   * blank default.
   */
  start?: string;
};

/**
 * One of a list's filters, as the list gives it: all a Filter is but its
 * name, its parameter's, and whether it repeats, which its parameter says.
 */
type FilterOf = Omit<Filter, "name" | "repeat">;

/** The filters of `list`'s bar, from what its page gives (`choices`): each of `filters`, by its parameter, in their order. */
export function listFilters<const P extends ParamKinds, C>(
  list: { params: P },
  filters: (choices: C) => NoInfer<{ [K in keyof P & string]?: FilterOf }>,
): (choices: C) => Filter[] {
  return (choices) =>
    Object.entries(filters(choices) as Record<string, FilterOf>).map(([name, filter]) =>
      list.params[name] === "many" ? { name, ...filter, repeat: true } : { name, ...filter },
    );
}

/** The choice of `filter` a value is, if it's one. */
export function choiceOf(filter: Filter, value: string): FilterOption | undefined {
  return filter.options.find((option) => option.value === value);
}

/** Whether `filter`'s choices are in groups, each group a chip of its own. */
export function isGrouped(filter: Filter): boolean {
  return filter.options.some((option) => option.group);
}

/** What the chip of a choice of `filter` is named: its group's chip's name, or the filter's. */
function chipName(filter: Filter, plain: string): string {
  return choiceOf(filter, plain)?.group?.chip ?? filter.label;
}

/**
 * A choice of `filter` in words: its group, unless its chip names it, and
 * its words; or as typed, when it's none of its choices.
 */
function choiceWords(filter: Filter, plain: string): string {
  const choice = choiceOf(filter, plain);
  if (!choice) return plain;
  return [choice.group?.chip ? undefined : choice.group?.label, choice.label].filter(Boolean).join(", ");
}

/** A value of `filter` in words: its chip's name and choice, joined by `join`, or that it's left out. */
export function valueWords(filter: Filter, value: string, join: string): string {
  const { value: plain, not } = notValue(value);
  const [name, choice] = [chipName(filter, plain), choiceWords(filter, plain)];
  return not ? staffVocabulary.filters.notChip(name, choice) : `${name}${join}${choice}`;
}

/** A filter that's on, in words, as its chip says them, and whether it leaves out what it says. */
export type FilterPill = { words: string; not: boolean };

/**
 * The repeating filter `filter` comes after, if it does: each of that one's
 * values has its own of `filter`'s, paired with it (pairedValue()).
 */
export function pairedAfter(filters: Filter[], filter: Filter): Filter | undefined {
  const before = filter.after ? filters.find((f) => f.name === filter.after) : undefined;
  return before?.repeat && filter.repeat ? before : undefined;
}

/**
 * The values of `paired`, which comes after `filter`, a repeating one, that
 * go with `of`, a value of that one, without their pairing: those it finds,
 * then those it leaves out.
 */
export function pairedSides(paired: Filter, values: Params, of: string): [string[], string[]] {
  const own = valuesOf(values[paired.name])
    .map(notValue)
    .filter((one) => unpaired(one.value).of === of);
  return [false, true].map((not) => own.filter((one) => one.not === not).map((one) => one.value)) as [
    string[],
    string[],
  ];
}

/**
 * The pills of a repeating filter with one paired after it: for each of
 * its values, what that one finds of it, or its default, then what it
 * leaves out of it, each named for the value.
 */
function pairedPills(filter: Filter, paired: Filter, values: Params): FilterPill[] {
  return valuesOf(values[filter.name]).flatMap((of) => {
    const name = choiceWords(filter, of);
    const [found, out] = pairedSides(paired, values, of);
    const words = (ones: string[]) => staffVocabulary.filters.anyOf(ones.map((one) => choiceWords(paired, one)));
    return [
      ...(found.length > 0 || out.length === 0
        ? [{ words: `${name}: ${found.length ? words(found) : choiceWords(paired, pairedValue(of, ""))}`, not: false }]
        : []),
      ...(out.length > 0 ? [{ words: staffVocabulary.filters.notChip(name, words(out)), not: true }] : []),
    ];
  });
}

/**
 * The search and each filter that's on, as their chips say them, and
 * whether each leaves out: for pills that show who something is to. One
 * that comes `after` another and doesn't repeat goes with it, as its chip's
 * second half does, its default too.
 */
export function filterPills(filters: Filter[], values: Params, search: string): FilterPill[] {
  const pills = values[search] ? [{ words: `${staffVocabulary.search}: ${firstOf(values[search])}`, not: false }] : [];
  for (const filter of filters) {
    if (filter.after && !filter.repeat) continue;
    if (pairedAfter(filters, filter)) continue;
    const paired = filters.find((f) => f.after === filter.name && pairedAfter(filters, f));
    if (paired) {
      pills.push(...pairedPills(filter, paired, values));
      continue;
    }
    const chosen = valuesOf(values[filter.name]).map(notValue);
    // Those it finds, then those it leaves out, by the name of their chip.
    const [found, out] = [false, true].map((not) => {
      const named = new Map<string, string[]>();
      for (const one of chosen.filter((one) => one.not === not)) {
        const name = chipName(filter, one.value);
        named.set(name, [...(named.get(name) ?? []), choiceWords(filter, one.value)]);
      }
      return [...named];
    });
    const next = filters.find((f) => f.after === filter.name && !f.repeat);
    const then = next ? `, ${choiceWords(next, firstOf(values[next.name]))}` : "";
    for (const [name, ones] of found)
      pills.push({ words: `${name}: ${staffVocabulary.filters.anyOf(ones)}${then}`, not: false });
    for (const [name, ones] of out)
      pills.push({ words: staffVocabulary.filters.notChip(name, staffVocabulary.filters.anyOf(ones)), not: true });
  }
  return pills;
}

/** The search and each filter that's on, in words, as their chips say them (filterPills): for a download's filename. */
export function filterWords(filters: Filter[], values: Params, search: string): string[] {
  return filterPills(filters, values, search).map((pill) => pill.words);
}

/** How long the filters in a list's page title get before they're cut short. */
const TITLE_FILTERS = 60;

/** A list's page title with the search and filters that are on, `words` (filterWords()), cut short if long. */
export function filteredTitle(title: string, words: string[]): string {
  const filters = words.filter(Boolean).join(", ");
  if (!filters) return title;
  const short = filters.length > TITLE_FILTERS ? `${filters.slice(0, TITLE_FILTERS - 1).trimEnd()}…` : filters;
  return staffVocabulary.filters.pageTitle(title, short);
}

/**
 * All the search and filters that are on, `words` (filterWords()): a saved
 * filter's first name. Not the list's title, as its Saved menu is the list's own.
 */
export function filteredName(words: string[]): string {
  return words.filter(Boolean).join(", ");
}

/** Each choice of `labels`, by its key, in their order. */
const choicesOf = (labels: Record<string, string>): FilterOption[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

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

/**
 * The Consent filter's choices, in its order: by email, then text, then
 * call, each the lists that go by it in LISTS's order, so the same one sits
 * on the same row under each heading.
 */
export const LIST_ORDER: { list: List; way: Way }[] = WAYS.flatMap((way) =>
  listsBy(way).map((list) => ({ list, way })),
);

/** The words in the Near chip: where it found, or that it couldn't; as typed, when it wasn't looked up. */
function nearWords(text: string, found: SupportersPage["near"]): string {
  const copy = supportersCopy.supporters.filters;
  if (found === undefined) return text;
  if (found === "failed") return copy.failed(text);
  return found ? found.place : copy.notFound(text);
}

/**
 * What the supporters list's bar offers: the events and MPs there are; the
 * Near filter as typed, and what it found, once looked up; and each
 * channel's icon, for the Subscriptions filter's headings.
 */
export type SupporterBarChoices = SupporterChoices & {
  near: string;
  found?: SupportersPage["near"];
  channelIcon?: (way: Way) => ReactNode;
  /** What a Consent filter's list means, after it in a menu. */
  listHelp?: (list: List) => ReactNode;
};

/**
 * The supporters list's filters. Consent, the contact filter, is first, as
 * it's who a message can go to, and has its own button. Its choices are
 * each list by each way, as those on it, a chip for each way; one by email
 * or phone shows that column. Then those named after a column, in the
 * columns' order: their activities; the events they registered for;
 * whether they wrote in a campaign; and when they were first seen, last
 * registered for an event or unsubscribed, the lists the dashboard's tiles
 * open, the last two only from those tiles. Last, where they are, which
 * the Place column shows but none is named after: how near somewhere,
 * their MP and their nation. Activities, consents, nations,
 * MPs and events can each be chosen more than once; a supporter has one
 * nation and one MP.
 */
export const SUPPORTER_FILTERS = listFilters(
  SUPPORTERS_LIST,
  ({ events, mps, near, found, channelIcon, listHelp }: SupporterBarChoices) => {
    const copy = supportersCopy.supporters.filters;
    const { columns } = supportersCopy.supporters;
    return {
      contact: {
        label: columns.subscriptions,
        // Who a message can go to, so its own button. Each list includes those it should, so one at a time.
        own: true,
        oneAtATime: true,
        // Each list under its way's heading, as those on it by that way.
        options: LIST_ORDER.map(({ list, way }) => ({
          value: listValue(list, way),
          label: copy.lists[list],
          help: listHelp?.(list),
          group: { label: copy.ways[way], icon: channelIcon?.(way), chip: copy.wayChips[way] },
        })),
      },
      activity: {
        label: columns.badges,
        options: SUPPORTER_BADGES.map((badge) => ({ value: badge, label: supportersCopy.supporters.badges[badge] })),
      },
      event: {
        label: copy.event,
        searchable: true,
        options: events.map((event) => ({
          value: event.id,
          label: copy.eventChoice(event.name, staffDate(event.startAt)),
        })),
      },
      campaign: {
        label: copy.campaign,
        options: CAMPAIGN_NAMES.map((campaign) => ({ value: campaign.slug, label: campaign.title })),
      },
      wrote: { label: copy.campaign, after: "campaign", options: choicesOf(copy.wrote) },
      first: { label: copy.first, options: WINDOW_OPTIONS },
      registered: { label: copy.registered, options: WINDOW_OPTIONS, linkedOnly: true },
      unsubscribed: { label: copy.unsubscribed, options: WINDOW_OPTIONS, linkedOnly: true },
      near: {
        label: copy.near,
        options: near ? [{ value: near, label: nearWords(near, found) }] : [],
        place: {
          within: "within",
          placeholder: copy.nearPlaceholder,
          distances: NEAR_MILES.map((n) => ({ value: String(n), label: copy.miles(n) })),
        },
      },
      mp: {
        label: politiciansCopy.politician.roles.commons,
        oneEach: true,
        searchable: true,
        options: mps.map((mp) => ({ value: String(mp.id), label: copy.mpChoice(mp.name, mp.constituency) })),
      },
      nation: {
        label: politiciansCopy.politician.country,
        oneEach: true,
        options: choicesOf(staffVocabulary.countries),
      },
    };
  },
);

/** The choices the events list's filters offer: every staff account, and every tag and city our events have. */
export type EventChoices = { staff: readonly string[]; tags: string[]; cities: string[] };

/**
 * The events list's filters, in its columns' order: where it is, a city
 * or online; its tags; its owner, or none; and taken off Luma, which
 * finds only those, as the list leaves them out otherwise, as the
 * politicians list does test politicians; and when it was held, only from the
 * dashboard's tile. Where, tags and owner can be chosen more than once.
 */
export const EVENT_FILTERS = listFilters(EVENTS_LIST, ({ staff, tags, cities }: EventChoices) => {
  const copy = eventsCopy.events;
  return {
    place: {
      label: copy.filters.place,
      oneEach: true,
      options: [...cities.map((city) => ({ value: city, label: city })), { value: ONLINE, label: copy.online }],
    },
    tag: { label: copy.filters.tag, options: tags.map((tag) => ({ value: tag, label: tag })) },
    owner: {
      label: copy.owner,
      oneEach: true,
      options: [
        { value: NO_OWNER, label: copy.noOwner },
        ...staff.map((email) => ({ value: email, label: staffMemberText(email) })),
      ],
    },
    removed: { label: copy.removed, options: choicesOf(copy.filters.removed) },
    held: { label: copy.filters.held, options: WINDOW_OPTIONS, linkedOnly: true },
  };
});

/** The choices the audit log's filters offer: everyone in it, and everything they've done. */
export type ChangeChoices = { actors: string[]; actions: string[] };

/** The audit log's filters, in its columns' order: how recent; who and what, each of which can be chosen more than once. */
export const CHANGE_FILTERS = listFilters(AUDIT_LOG_LIST, ({ actors, actions }: ChangeChoices) => {
  const copy = oversightCopy.changes;
  return {
    when: { label: copy.at, options: WINDOW_OPTIONS },
    actor: {
      label: copy.actor,
      oneEach: true,
      options: actors.map((value) => ({ value, label: staffMemberText(value) })),
    },
    action: { label: copy.action, oneEach: true, options: actions.map((value) => ({ value, label: value })) },
  };
});

/** The send log's filters, their kinds of email only those a staff member without `supporters` may see. */
export const SENT_EMAIL_FILTERS = listFilters(SENT_EMAILS_LIST, ({ supporters }: { supporters: boolean }) => {
  const copy = oversightCopy.sentEmails;
  return {
    purpose: {
      label: copy.filters.purpose,
      oneEach: true,
      options: choicesOf(copy.purposes).filter(
        ({ value }) => supporters || SENT_EMAILS_WITHOUT_SUPPORTERS.includes(value),
      ),
    },
    backend: { label: copy.filters.backend, oneEach: true, options: choicesOf(copy.backends) },
    outcome: { label: copy.filters.outcome, oneEach: true, options: choicesOf(copy.outcomes) },
    link: {
      label: copy.columns.links,
      options: SENT_EMAIL_LINKS.map((value) => ({ value, label: copy.filters.links[value] })),
    },
  };
});

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
          label: person.constituency
            ? supportersCopy.supporters.filters.mpChoice(person.name, person.constituency)
            : person.name,
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
