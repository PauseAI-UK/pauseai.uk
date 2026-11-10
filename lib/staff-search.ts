// Reads the staff pages' URLs: each filter as typed, for its form, and what
// it filters by, leaving out anything blank or unknown. lib/staff-forms.ts
// reads their forms.
import { staffCopy } from "@/lib/content/staff-interface";
import { listWindow, type DashboardWindow } from "./staff-dashboard";
import { contactState } from "@/lib/contact-permissions";
import type { ChangesFilter } from "@/lib/server/audit";
import type { BlocksFilter } from "@/lib/server/email";
import type { PoliticianFilter } from "@/lib/server/politicians";
import type { SentEmailsFilter } from "@/lib/server/sent-emails";
import { campaignBySlug } from "@/lib/email-your-mp";
import {
  among,
  anyAndNone,
  firstOf,
  notOf,
  pageNumber,
  valuesOf,
  type ParamValue,
  type Params,
} from "@/lib/list-params";
import { SUPPORTER_LETTER_STATUSES } from "@/lib/letter-status";
import {
  COUNTRIES,
  EMAIL_STATES,
  isHouse,
  isPersonStatus,
  POLITICIAN_FLAGS,
  type PoliticianFlag,
} from "@/lib/politician-filters";
import {
  ACCOUNTS_LIST,
  ALL_EMAILS_LIST,
  AUDIT_LOG_LIST,
  EVENTS_LIST,
  LETTERS_LIST,
  POLITICIANS_LIST,
  SENT_EMAILS_LIST,
  SUPPORTERS_LIST,
  type SearchOf,
  type SortOf,
} from "@/lib/staff-lists";
import { parseSort, type SortSpec } from "@/lib/staff-sort";
import { type EventGrouping, EVENT_SORTS, type EventFilter } from "@/lib/staff-events-list";
import { isSupporterBadge, NEAR_MILES, type SupporterFilter } from "@/lib/supporters";

/** Which of a campaign's letters its counts can show: those that arrived, failed, were replied to, whose politician answered its ask, or whose text was changed. */
export const LETTER_TABS = ["sent", "failed", "replied", "answered", "changed"] as const;
export type LetterTab = (typeof LETTER_TABS)[number];

/** A campaign's letters' URL, as typed. */
export type LettersSearch = SearchOf<typeof LETTERS_LIST.params>;

/**
 * What sent a letter: pauseai.info's old form, whose letters are copied
 * from Airtable, or this site, by Postmark or by a staff member's Gmail.
 */
export const LETTER_BACKENDS = ["airtable", "postmark", "gmail"] as const;
export type LetterBackend = (typeof LETTER_BACKENDS)[number];

/**
 * What came back to a letter: a written reply, only an automatic one (an
 * office's acknowledgement or out-of-office), or neither.
 */
export const LETTER_REPLIES = ["yes", "auto", "no"] as const;
export type LetterReply = (typeof LETTER_REPLIES)[number];

/** The filters of the letters list that repeat, which can leave out as well as find. */
type NegatableLetterFilter = "campaign" | "flags" | "backend";

/** Which letters the letters page lists (recentLetters in lib/server/letters.ts). */
export type LetterFilter = {
  /** A letter's status, as SUPPORTER_LETTER_STATUSES. */
  status?: string;
  /** Over the sender's name and email, and the MP's name. */
  search?: string;
  /** What came back to it. */
  answered?: LetterReply;
  /** Which of a campaign's counts it's showing. */
  tab?: LetterTab;
  /** In any of these campaigns, by slug. */
  campaign?: string[];
  /** To an MP with any of these markers. */
  flags?: PoliticianFlag[];
  /** Sent by any of these. */
  backend?: LetterBackend[];
  /** One supporter's letters (/staff/letters/supporter/[id]). */
  supporterId?: number;
  /** One letter (/staff/letters/[id]). */
  letterId?: number;
  /** Those with none of these, each a filter above that repeats. */
  not?: Pick<LetterFilter, NegatableLetterFilter>;
  sort?: SortSpec<SortOf<typeof LETTERS_LIST>>;
};

/** What a campaign's slug looks like, as the campaigns table checks it. */
const isSlug = (value: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);

/** The letters page's filters and sort, as the URL gives them and as the server applies them. */
export function lettersSearch(
  params: Partial<Record<string, ParamValue>>,
): LettersSearch & { filter: LetterFilter & { page: number } } {
  const search = LETTERS_LIST.read(params);
  const [campaigns, notCampaigns] = anyAndNone(search.campaign, (values) => values.filter(isSlug));
  const [flags, notFlags] = anyAndNone(search.flag, (values) => among(values, POLITICIAN_FLAGS));
  const [backends, notBackends] = anyAndNone(search.backend, (values) => among(values, LETTER_BACKENDS));
  const filter: LetterFilter = {
    status: among([search.status], SUPPORTER_LETTER_STATUSES)[0],
    search: search.q.trim() || undefined,
    answered: among([search.answered], LETTER_REPLIES)[0],
    tab: among([search.tab], LETTER_TABS)[0],
    campaign: campaigns,
    flags,
    backend: backends,
    not: notOf({ campaign: notCampaigns, flags: notFlags, backend: notBackends }),
    sort: LETTERS_LIST.sort(search),
  };
  return { ...search, filter: { ...filter, page: pageNumber(search.page) } };
}

/** What a sent email can lead to, which its Links filter finds. */
/** The kinds of email with no supporter's details on them: all that staff without `supporters` see. */
export const SENT_EMAILS_WITHOUT_SUPPORTERS: readonly string[] = [
  "mailing",
  "mailing-test",
  "staff-login",
  "staff-alert",
  "staff-report",
];

export const SENT_EMAIL_LINKS = ["letter", "campaign", "mailing"] as const;

/** The sent emails' URL filters. */
export type SentEmailsSearch = SearchOf<typeof SENT_EMAILS_LIST.params>;

/** Reads the sent emails' URL. */
export function sentEmailsSearch(params: Partial<Record<string, ParamValue>>): SentEmailsSearch & {
  filter: SentEmailsFilter;
} {
  const search = SENT_EMAILS_LIST.read(params);
  const [purposes, notPurposes] = anyAndNone(search.purpose, (values) => values);
  const [outcomes, notOutcomes] = anyAndNone(search.outcome, (values) => values);
  const [backends, notBackends] = anyAndNone(search.backend, (values) => values);
  const [links, notLinks] = anyAndNone(search.link, (values) => among(values, SENT_EMAIL_LINKS));
  return {
    ...search,
    filter: {
      search: search.q.trim() || undefined,
      sort: SENT_EMAILS_LIST.sort(search),
      purpose: purposes,
      outcome: outcomes,
      backend: backends,
      link: links,
      not: notOf({ purpose: notPurposes, outcome: notOutcomes, backend: notBackends, link: notLinks }),
      page: pageNumber(search.page),
    },
  };
}

/** The audit log's URL, as typed. */
export type ChangesSearch = SearchOf<typeof AUDIT_LOG_LIST.params>;

/** The audit log's filters and sort, each as typed and as applied. */
export function changesSearch(params: Partial<Record<string, ParamValue>>): ChangesSearch & { filter: ChangesFilter } {
  const search = AUDIT_LOG_LIST.read(params);
  const [actors, notActors] = anyAndNone(search.actor, (values) => values);
  const [actions, notActions] = anyAndNone(search.action, (values) => values);
  return {
    ...search,
    filter: {
      search: search.q.trim() || undefined,
      actor: actors,
      action: actions,
      days: listWindow(search.when),
      not: notOf({ actor: notActors, action: notActions }),
      sort: AUDIT_LOG_LIST.sort(search),
      page: pageNumber(search.page),
    },
  };
}

/** The politicians list's URL, as typed. */
export type PoliticiansSearch = SearchOf<typeof POLITICIANS_LIST.params>;

/**
 * The politicians page's filter, from its URL: each field as typed, for the
 * form, and the filter they make, leaving out what's blank or unknown, but
 * for the status: those in office unless it's given. A filter that repeats
 * finds those with any of its values. The test politicians are left out,
 * unseen in the filters, unless the Marked filter finds them.
 */
export function politiciansSearch(params: Partial<Record<string, ParamValue>>): PoliticiansSearch & {
  filter: PoliticianFilter;
} {
  const search = POLITICIANS_LIST.read(params);
  const { house, status, ask } = search;
  const [parties, notParties] = anyAndNone(search.party, (values) => values);
  const [flags, notFlags] = anyAndNone(search.flag, (values) => among(values, POLITICIAN_FLAGS));
  const [countries, notCountries] = anyAndNone(search.nation, (values) => among(values, COUNTRIES));
  const [emails, notEmails] = anyAndNone(search.email, (values) => among(values, EMAIL_STATES));
  const [mailedAbout, notMailedAbout] = anyAndNone(search.mailed, (values) => values);
  const filter: PoliticianFilter = {
    search: search.q.trim() || undefined,
    house: isHouse(house) ? house : undefined,
    status: isPersonStatus(status) ? status : status === "any" ? undefined : "in_office",
    party: parties,
    flags,
    country: countries,
    email: emails,
    mailed: mailedAbout,
    ask: ask || undefined,
    answer: search.answer.length ? search.answer : undefined,
    agreedDays: listWindow(search.agreed),
    not: notOf({
      party: notParties,
      flags: flags?.includes("test") ? notFlags : [...new Set([...(notFlags ?? []), "test" as const])],
      country: notCountries,
      email: notEmails,
      mailed: notMailedAbout,
    }),
    sort: POLITICIANS_LIST.sort(search),
    page: pageNumber(search.page),
  };
  return {
    ...search,
    mailing: /^\d+$/.test(search.mailing) ? search.mailing : "",
    tab: search.tab === "ticked" || search.tab === "pasted" ? search.tab : "",
    filter,
  };
}

/** A mailing's ID from its page's URL: a whole number, or undefined. */
export function mailingId(id: string): number | undefined {
  return politicianId(id);
}

/** A politician's ID from their page's URL: a whole number, or undefined. */
export function politicianId(id: string): number | undefined {
  return /^\d+$/.test(id) ? Number(id) : undefined;
}

/** The blocked addresses page's filters: a search of the addresses, and blocked by a hard bounce, or a complaint. */
export function emailsSearch({ q = "", kind = "" }: { q?: string; kind?: string }): {
  q: string;
  kind: string;
  filter: BlocksFilter;
} {
  return {
    q,
    kind,
    filter: { kind: kind === "hard" || kind === "complaint" ? kind : undefined, search: q.trim() || undefined },
  };
}

/** A letter's ID from its page's URL: a whole number, or undefined. */
export function letterId(id: string): number | undefined {
  return politicianId(id);
}

/** A supporter's ID from their page's URL: a whole number, or undefined. */
export function supporterId(id: string): number | undefined {
  return politicianId(id);
}

/** The supporters list's URL, as typed. */
export type SupportersSearch = SearchOf<typeof SUPPORTERS_LIST.params>;

/** What an erasure can leave behind when its clean-up fails. */
export const ERASE_LEFTOVERS = ["mail", "oneOffs"] as const;
export type EraseLeftover = (typeof ERASE_LEFTOVERS)[number];

/** Where an erasure goes afterwards: the list, saying so, and what couldn't be cleared, if anything. */
export function erasedPath(notCleared: EraseLeftover[]): string {
  if (!notCleared.length) return "/staff/supporters?erased=1";
  return `/staff/supporters?erased=partly&why=${notCleared.join(",")}`;
}

/** The codes in an erasure's `why`; anything else in the address is left out. */
export function eraseLeftovers(why: string): EraseLeftover[] {
  const codes = why.split(",");
  return ERASE_LEFTOVERS.filter((leftover) => codes.includes(leftover));
}

/** The supporters list's filters and sort, each as typed and as applied. */
export function supportersSearch(params: Partial<Record<string, ParamValue>>): SupportersSearch & {
  filter: SupporterFilter;
} {
  const search = SUPPORTERS_LIST.read(params);
  const sorting = SUPPORTERS_LIST.sort(search);
  const [badges, notBadges] = anyAndNone(search.activity, (values) => values.filter(isSupporterBadge));
  const [states, notStates] = anyAndNone(search.contact, (values) =>
    values.flatMap((value) => contactState(value) ?? []),
  );
  const [events, notEvents] = anyAndNone(search.event, (values) => values);
  const [countries, notCountries] = anyAndNone(search.nation, (values) =>
    values.filter((value) => Object.hasOwn(staffCopy.countries, value)),
  );
  const [mps, notMps] = anyAndNone(search.mp, (values) => values.flatMap((value) => politicianId(value) ?? []));
  const miles = NEAR_MILES.find((n) => String(n) === search.within) ?? NEAR_MILES[1];
  const campaign = campaignBySlug(search.campaign);
  const filter: SupporterFilter = {
    search: search.q.trim() || undefined,
    activity: badges,
    contact: states,
    event: events,
    campaign: campaign?.slug,
    wrote: campaign ? search.wrote !== "no" : undefined,
    country: countries,
    mp: mps,
    near: search.near.trim() ? { text: search.near.trim(), miles } : undefined,
    firstDays: listWindow(search.first),
    registeredDays: listWindow(search.registered),
    unsubscribedDays: listWindow(search.unsubscribed),
    not: notOf({ activity: notBadges, contact: notStates, event: notEvents, country: notCountries, mp: notMps }),
    sort: sorting.key,
    dir: sorting.dir,
    page: pageNumber(search.page),
  };
  return { ...search, filter };
}

/** How many letters the all-letters page shows at once. */
export const ALL_LETTERS_PAGE_SIZE = 100;

/** Who sent an email on the all emails page, a one-off thread by its first message. */
export const EMAIL_SENDERS = ["supporter", "pauseai", "politician", "other"] as const;
export type EmailSender = (typeof EMAIL_SENDERS)[number];

/** What a row of the all emails page is: a campaign's letter, a mailing's, or a one-off thread. */
export const EMAIL_TYPES = ["campaign", "mailing", "one-off"] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

/** The all emails page's filters, each as typed in its URL. */
export type AllLettersSearch = SearchOf<typeof ALL_EMAILS_LIST.params>;

/** Which emails the all emails page shows, and which page of them. */
export type AllLettersFilter = {
  search?: string;
  from?: EmailSender[];
  notFrom?: EmailSender[];
  type?: EmailType[];
  notType?: EmailType[];
  to?: number[];
  notTo?: number[];
  sentDays?: DashboardWindow;
  replied?: "yes" | "no" | DashboardWindow;
  page: number;
};

/** The all emails page's filters, as typed and as applied. */
export function allLettersSearch(params: Partial<Record<string, ParamValue>>): AllLettersSearch & {
  filter: AllLettersFilter;
} {
  const search = ALL_EMAILS_LIST.read(params);
  const [types, notTypes] = anyAndNone(search.type, (values) => among(values, EMAIL_TYPES));
  const [kinds, notKinds] = anyAndNone(search.from, (values) => among(values, EMAIL_SENDERS));
  const [people, notPeople] = anyAndNone(search.to, (values) => values.flatMap((value) => politicianId(value) ?? []));
  const { replied } = search;
  return {
    ...search,
    filter: {
      search: search.q.trim() || undefined,
      from: kinds,
      notFrom: notKinds,
      type: types,
      notType: notTypes,
      to: people,
      notTo: notPeople,
      sentDays: listWindow(search.sent),
      replied: replied === "yes" || replied === "no" ? replied : listWindow(replied),
      page: pageNumber(search.page),
    },
  };
}

/** The events list's URL, as typed. */
export type EventsSearch = SearchOf<typeof EVENTS_LIST.params>;

/**
 * What the events page's URL asks it to show: every event to come, by owner or
 * by tag (`view`), as a tab of its own, or a table. The Past tab is always a table.
 */
export function eventView(params: { when?: ParamValue; view?: ParamValue }): EventGrouping | "table" {
  const view = firstOf(params.view);
  return firstOf(params.when) !== "past" && (view === "owner" || view === "tag") ? view : "table";
}

/** The events list's tab, filters and sort, each as typed and as applied. */
export function eventsSearch(params: Partial<Record<string, ParamValue>>): EventsSearch & { filter: EventFilter } {
  const search = EVENTS_LIST.read(params);
  const tab = search.when === "past" ? "past" : "future";
  const [owners, notOwners] = anyAndNone(search.owner, (values) => values);
  const [tags, notTags] = anyAndNone(search.tag, (values) => values);
  const [places, notPlaces] = anyAndNone(search.place, (values) => values);
  const filter: EventFilter = {
    tab,
    search: search.q.trim() || undefined,
    owner: owners,
    tag: tags,
    place: places,
    removed: search.removed === "yes",
    heldDays: listWindow(search.held),
    not: notOf({ owner: notOwners, tag: notTags, place: notPlaces }),
    sort: parseSort(EVENT_SORTS[tab], "start", search.sort, search.dir),
    page: pageNumber(search.page),
  };
  return { ...search, filter };
}

/** The accounts page's notice, after a refused change. */
export function accountsSearch(params: Partial<Record<string, ParamValue>>): {
  notice: string;
  sort: SortSpec<SortOf<typeof ACCOUNTS_LIST>>;
} {
  const search = ACCOUNTS_LIST.read(params);
  return {
    notice: ["last-admin", "not-pauseai", "removed"].includes(search.notice) ? search.notice : "",
    sort: ACCOUNTS_LIST.sort(search),
  };
}

/**
 * An ask's form, from its URL: the page to go back to after saving (the
 * asks page unless it's another staff page), and how the last save went.
 */
export function askFormSearch(params: Record<string, ParamValue>): { back: string; notice: string } {
  return { back: staffBack(firstOf(params.back), "/staff/asks"), notice: firstOf(params.notice) };
}

/** A staff page to go back to, with its query, never another site's; `fallback` for anything else. */
export function staffBack(back: string | null | undefined, fallback: string): string {
  return back && /^\/staff(\/[\w\-/]*)?(\?[^#]*)?$/.test(back) && !back.includes("//") ? back : fallback;
}

// Who a list shows, kept apart from how it shows them (the sort and the
// page), as its URL parameters, so a mailing can keep it and run it again
// (lib/server/stored-filters.ts reads it back strictly).

/** The lists a mailing can be to. */
export const FILTER_LISTS = ["politicians", "supporters"] as const;
export type FilterList = (typeof FILTER_LISTS)[number];

/**
 * The politicians ticked on the list, by ID: who a mailing goes to, exactly,
 * however few. And the last time everyone a filter found was ticked, that
 * filter's parameters, when, and who it found, so the mailing can say who
 * it's to as that group and those added or taken off.
 */
export type Picked = { ids: number[]; from?: { params: Params; at: string; found: number[] } };

/**
 * Who a list shows: the list, and its parameters that choose who. With
 * `picked`, those ticked are who it is, and the parameters aren't used.
 */
export type StoredFilter = { list: FilterList; params: Params; picked?: Picked };

/** Each list's parameters that choose who it shows. */
export const WHO_PARAMS: Record<FilterList, readonly string[]> = {
  politicians: POLITICIANS_LIST.choosing,
  supporters: SUPPORTERS_LIST.choosing,
};

/** Who a list's URL parameters show, without the sort, the page or anything else, nor blanks. */
export function storedFilter<List extends FilterList>(
  list: List,
  params: Partial<Record<string, string | string[]>>,
): StoredFilter & { list: List } {
  const kept: Params = {};
  for (const name of WHO_PARAMS[list]) {
    const values = valuesOf(params[name]);
    if (values.length) kept[name] = values.length === 1 ? values[0] : values;
  }
  return { list, params: kept };
}
