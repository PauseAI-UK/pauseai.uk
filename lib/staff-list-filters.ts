// Each staff list's filter bar: its filters, in their order, each named by
// its parameter in the list's definition (lib/staff-lists.ts), with its
// label and choices. Whether one can be chosen more than once is its
// parameter's: one the URL gives several times repeats. What a list's page
// gives its bar (`choices`) is what comes from the database or the page,
// such as the parties, the events, or who's in the log.
import type { ReactNode } from "react";
import { ASK_STATUSES } from "./asks";
import { sendsOf, stateValue, waysKey, type Channel, type Topic } from "./contact-permissions";
import { staffCopy } from "./content/staff-interface";
import { campaigns } from "./content/email-your-mp";
import { firstOf, notValue, valuesOf, type Params } from "./list-params";
import { COUNTRIES, EMAIL_STATES, POLITICIAN_FLAGS } from "./politician-filters";
import type { EmailChoice } from "./server/all-letters";
import type { Ask } from "./server/asks";
import type { SupporterChoices, SupportersPage } from "./server/supporters";
import { WINDOW_OPTIONS } from "./staff-dashboard";
import { NO_OWNER, ONLINE } from "./staff-events-list";
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
import { NEAR_MILES, SUPPORTER_BADGES } from "./supporters";

/**
 * A choice. Choices in a `group` come under its heading, its icon once,
 * the group named on the chip too; a `detail` is said quietly after the
 * words. One with `seconds` is in two parts: chosen, its chip is in two
 * halves, the second offering `seconds`, the first of which is this choice
 * alone and the rest narrow it.
 */
export type FilterOption = {
  value: string;
  label: string;
  group?: { label: string; icon: ReactNode };
  detail?: string;
  seconds?: FilterOption[];
  /** A second part's kind, the same across choices, so changing the first keeps it where the new one has it. */
  like?: string;
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
 * be needed. A choice in two parts doesn't repeat. A `searchable`
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
  /**
   * A filter that can't be changed here, and why, said on hovering its chip:
   * its chip is there but doesn't open, with a lock for its arrow, it's never
   * offered, and Clear filters keeps it.
   */
  locked?: string;
};

/**
 * One of a list's filters, as the list gives it: all a Filter is but its
 * name, its parameter's, and whether it repeats, which its parameter says
 * unless it's chosen only `once` though the URL can give it more than once.
 */
type FilterOf = Omit<Filter, "name" | "repeat"> & { once?: true };

/** The filters of `list`'s bar, from what its page gives (`choices`): each of `filters`, by its parameter, in their order. */
export function listFilters<const P extends ParamKinds, C>(
  list: { params: P },
  filters: (choices: C) => NoInfer<{ [K in keyof P & string]?: FilterOf }>,
): (choices: C) => Filter[] {
  return (choices) =>
    Object.entries(filters(choices) as Record<string, FilterOf>).map(([name, { once, ...filter }]) =>
      list.params[name] === "many" && !once ? { name, ...filter, repeat: true } : { name, ...filter },
    );
}

/** The choice of `filter` a value is, or whose second part it is, and that second part, if it narrows it. */
export function choiceParts(filter: Filter, value: string): { first?: FilterOption; second?: FilterOption } {
  for (const option of filter.options) {
    if (option.value === value) return { first: option };
    const second = option.seconds?.find((o) => o.value === value);
    if (second) return { first: option, second };
  }
  return {};
}

/** A choice of `filter` in words: its group, its words and its second part; or as typed, when it has none. */
function choiceWords(filter: Filter, plain: string): string {
  const { first, second } = choiceParts(filter, plain);
  return first ? [first.group?.label, first.label, second?.label].filter(Boolean).join(", ") : plain;
}

/** A value of `filter` in words: its name and choice, joined by `join`, or that it's left out. */
export function valueWords(filter: Filter, value: string, join: string): string {
  const { value: plain, not } = notValue(value);
  const choice = choiceWords(filter, plain);
  return not ? staffCopy.filters.notChip(filter.label, choice) : `${filter.label}${join}${choice}`;
}

/**
 * The search and each filter that's on, in words, as their chips say them:
 * for a download's filename. One that comes `after` another and doesn't
 * repeat goes with it, as its chip's second half does, its default too.
 */
export function filterWords(filters: Filter[], values: Params, search: string): string[] {
  const words = values[search] ? [`${staffCopy.search}: ${firstOf(values[search])}`] : [];
  for (const filter of filters) {
    if (filter.after && !filter.repeat) continue;
    const chosen = valuesOf(values[filter.name]).map(notValue);
    const [found, out] = [false, true].map((not) =>
      chosen.filter((one) => one.not === not).map((one) => choiceWords(filter, one.value)),
    );
    const next = filters.find((f) => f.after === filter.name && !f.repeat);
    const then = next ? `, ${choiceWords(next, firstOf(values[next.name]))}` : "";
    if (found.length) words.push(`${filter.label}: ${staffCopy.filters.anyOf(found)}${then}`);
    if (out.length) words.push(staffCopy.filters.notChip(filter.label, staffCopy.filters.anyOf(out)));
  }
  return words;
}

/** How long the filters in a list's page title get before they're cut short. */
const TITLE_FILTERS = 60;

/** A list's page title with the search and filters that are on, `words` (filterWords()), cut short if long. */
export function filteredTitle(title: string, words: string[]): string {
  const filters = words.filter(Boolean).join(", ");
  if (!filters) return title;
  const short = filters.length > TITLE_FILTERS ? `${filters.slice(0, TITLE_FILTERS - 1).trimEnd()}…` : filters;
  return staffCopy.filters.pageTitle(title, short);
}

/** A list's title with all the search and filters that are on, `words` (filterWords()): a saved filter's first name. */
export function filteredName(title: string, words: string[]): string {
  return staffCopy.filters.pageTitle(title, words.filter(Boolean).join(", "));
}

/** Each choice of `labels`, by its key, in their order. */
const choicesOf = (labels: Record<string, string>): FilterOption[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

/** What the politicians list's bar offers: the ask chosen, and the parties and asks there are. */
export type PoliticianChoices = { ask: string; parties: string[]; asks: Ask[] };

/**
 * The politicians list's filters: the table's columns in its order, with
 * the nation after the party and whether we can email them after the
 * status. Status is those in office unless another is chosen. An answer is
 * offered once there's an ask, from those its kind allows, and goes with it.
 * Party, nation, email, the markers, the asks they've been mailed about and
 * the answers can each be chosen more than once, the first three having one
 * value each; Except on the asks finds those not yet mailed about it. How
 * recently they agreed is only from the dashboard's link.
 */
export const POLITICIAN_FILTERS = listFilters(POLITICIANS_LIST, ({ ask: slug, parties, asks }: PoliticianChoices) => {
  const copy = staffCopy.politicians;
  const ask = asks.find((a) => a.slug === slug);
  const askChoices = asks.map((a) => ({ value: a.slug, label: a.title }));
  return {
    nation: {
      label: staffCopy.politician.country,
      oneEach: true,
      options: COUNTRIES.map((country) => ({ value: country, label: staffCopy.countries[country] })),
    },
    party: {
      label: staffCopy.fields.party,
      oneEach: true,
      options: parties.map((party) => ({ value: party, label: party })),
    },
    status: {
      label: copy.status,
      options: [
        { value: "", label: staffCopy.personStatuses.in_office },
        ...Object.entries(staffCopy.personStatuses)
          .filter(([value]) => value !== "in_office")
          .map(([value, label]) => ({ value, label })),
        { value: "any", label: copy.anyStatus },
      ],
    },
    email: {
      label: staffCopy.fields.email,
      oneEach: true,
      options: EMAIL_STATES.map((state) => ({ value: state, label: copy.emailStates[state] })),
    },
    flag: { label: copy.flag, options: POLITICIAN_FLAGS.map((flag) => ({ value: flag, label: copy.flags[flag] })) },
    ask: { label: copy.ask, options: askChoices },
    agreed: { label: copy.agreedIn, options: WINDOW_OPTIONS, linkedOnly: true },
    mailed: { label: copy.mailed, options: askChoices },
    answer: {
      label: ask?.title ?? copy.answer,
      after: "ask",
      options: [
        { value: "", label: copy.anyAnswer },
        // With no ask, as a link from the dashboard can have it, any ask's answers.
        ...(ask ? ASK_STATUSES[ask.kind] : [...new Set(Object.values(ASK_STATUSES).flat())]).map((value) => ({
          value,
          label: staffCopy.statuses[value],
        })),
        { value: "none", label: copy.noAnswer },
      ],
    },
  };
});

/**
 * The Subscriptions filter's topics, in its order: email's, then phone's,
 * each ours first, then Luma's, then the rest, so the same one sits on the
 * same row under each heading.
 */
export const SUBSCRIPTION_ORDER: [Channel, Topic][] = [
  ["email", "site-forms"],
  ["email", "luma-calendar"],
  ["email", "pauseai-updates"],
  ["phone", "site-forms"],
  ["phone", "luma-calendar"],
  ["phone", "volunteering"],
  ["phone", "march-day"],
];

/** The words in the Near chip: where it found, or that it couldn't; as typed, when it wasn't looked up. */
function nearWords(text: string, found: SupportersPage["near"]): string {
  const copy = staffCopy.supporters.filters;
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
  channelIcon?: (channel: Channel) => ReactNode;
};

/**
 * The supporters list's filters, each named after the column it filters
 * on, in the columns' order: their nation and how near somewhere they
 * are, and their MP; their activities and subscriptions; the events they
 * registered for; and whether they wrote in a campaign. Consent, the
 * contact filter, has its own button. Its choices are each topic, a topic
 * chosen as those we can contact about it and another answer in its chip's
 * second half; one by email or phone shows that column; and when they were
 * first seen, last registered for an event or unsubscribed, the lists the
 * dashboard's tiles open, the last two only from those tiles. Activities,
 * nations, MPs and events can each be chosen more than once; a supporter
 * has one nation and one MP.
 */
export const SUPPORTER_FILTERS = listFilters(
  SUPPORTERS_LIST,
  ({ events, mps, near, found, channelIcon }: SupporterBarChoices) => {
    const copy = staffCopy.supporters.filters;
    const { columns } = staffCopy.supporters;
    return {
      nation: { label: staffCopy.politician.country, oneEach: true, options: choicesOf(staffCopy.countries) },
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
        label: staffCopy.politician.roles.commons,
        oneEach: true,
        searchable: true,
        options: mps.map((mp) => ({ value: String(mp.id), label: copy.mpChoice(mp.name, mp.constituency) })),
      },
      activity: {
        label: columns.badges,
        options: SUPPORTER_BADGES.map((badge) => ({ value: badge, label: staffCopy.supporters.badges[badge] })),
      },
      contact: {
        label: columns.subscriptions,
        // Who a message can go to, so its own button.
        own: true,
        // Chosen in two parts, not more than once.
        once: true,
        // Each topic under its channel's heading, chosen with its best answer, those we can contact about it, or
        // might; then in its chip's second half, another of the answers it can give. Changing the topic keeps the
        // answer where the new one can give it.
        options: SUBSCRIPTION_ORDER.map(([channel, topic]) => {
          const ways = waysKey(channel, topic);
          const answers = staffCopy.supporters.detail.permissions.answers[ways];
          const sends = sendsOf(channel, topic);
          return {
            value: stateValue({ channel, topic, send: sends[0] }),
            label: copy.topics[topic],
            group: { label: copy.channels[channel], icon: channelIcon?.(channel) },
            detail: copy.ways[ways],
            seconds: sends.map((send) => ({
              value: stateValue({ channel, topic, send }),
              label: answers[send],
              like: send,
            })),
          };
        }),
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
        options: campaigns.map((campaign) => ({ value: campaign.slug, label: campaign.title })),
      },
      wrote: { label: copy.campaign, after: "campaign", options: choicesOf(copy.wrote) },
      first: { label: copy.first, options: WINDOW_OPTIONS },
      registered: { label: copy.registered, options: WINDOW_OPTIONS, linkedOnly: true },
      unsubscribed: { label: copy.unsubscribed, options: WINDOW_OPTIONS, linkedOnly: true },
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
  const copy = staffCopy.events;
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
      options: [{ value: NO_OWNER, label: copy.noOwner }, ...staff.map((email) => ({ value: email, label: email }))],
    },
    removed: { label: copy.removed, options: choicesOf(copy.filters.removed) },
    held: { label: copy.filters.held, options: WINDOW_OPTIONS, linkedOnly: true },
  };
});

/** The choices the audit log's filters offer: everyone in it, and everything they've done. */
export type ChangeChoices = { actors: string[]; actions: string[] };

/** The audit log's filters, in its columns' order: how recent; who and what, each of which can be chosen more than once. */
export const CHANGE_FILTERS = listFilters(AUDIT_LOG_LIST, ({ actors, actions }: ChangeChoices) => {
  const copy = staffCopy.changes;
  return {
    when: { label: copy.at, options: WINDOW_OPTIONS },
    actor: { label: copy.actor, oneEach: true, options: actors.map((value) => ({ value, label: value })) },
    action: { label: copy.action, oneEach: true, options: actions.map((value) => ({ value, label: value })) },
  };
});

/** The send log's filters, their kinds of email only those a staff member without `supporters` may see. */
export const SENT_EMAIL_FILTERS = listFilters(SENT_EMAILS_LIST, ({ supporters }: { supporters: boolean }) => {
  const copy = staffCopy.sentEmails;
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
    const copy = staffCopy.allLetters;
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
        label: staffCopy.letters.columns.to,
        searchable: true,
        options: people.map((person) => ({
          value: String(person.id),
          label: person.constituency
            ? staffCopy.supporters.filters.mpChoice(person.name, person.constituency)
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
    };
  },
);
