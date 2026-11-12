// Each staff list, defined once: its page, who may open it, every parameter
// its URL takes, those that choose what it shows, and its sortable columns.
// From that come reading its URL (read), its sort (sort), what a saved
// filter keeps (saved), and, for the lists with saved filters, which they
// are and the permission they need (lib/saved-filters.ts). What each filter
// means, and what it finds, is the list's own (lib/staff-search.ts), as are
// its filter bar's words and choices (lib/staff-list-filters.ts).
import { firstOf, valuesOf, type ParamValue } from "./list-params";
import { parseSort, type SortColumns, type SortSpec } from "./staff-sort";
import type { Permission } from "./staff-permissions";

/** How a list's URL gives a parameter: one value, or several, for a filter chosen more than once, its name repeated. */
type Kind = "one" | "many";

/** A list's parameters, each by its name in the URL. */
export type ParamKinds = Record<string, Kind>;

/** A list's URL, as typed: each parameter's value, blank if it's not there, or a list of them for one that repeats. */
export type SearchOf<P extends ParamKinds> = { -readonly [K in keyof P]: P[K] extends "many" ? string[] : string };

/** A list's sortable columns, each with the direction a first click gives, and the one it's sorted by unless another is chosen. */
type Sorts<Key extends string> = { columns: SortColumns<Key>; fallback: NoInfer<Key> };

type Definition<P extends ParamKinds, Key extends string> = {
  /** Its page's route. */
  path: string;
  /** What a staff member needs to open it: a permission, or only an account. */
  needs: Permission | "account";
  params: P;
  /** Those that choose what it shows, as against how: what a saved filter, or a mailing, keeps. */
  choosing?: readonly (keyof P & string)[];
  /** Those a saved filter keeps besides, such as a tab. */
  kept?: readonly (keyof P & string)[];
  sorts?: Sorts<Key>;
};

export type StaffList<P extends ParamKinds = ParamKinds, Key extends string = string> = Definition<P, Key> & {
  choosing: readonly (keyof P & string)[];
  /** Its sortable columns, for its table's headings: none for a list that has no sort. */
  columns: SortColumns<Key>;
  /** What a saved filter keeps of its URL: its tab, if it keeps one, what it shows, and its sort. */
  saved: readonly string[];
  /** Its URL's parameters, each as typed: a blank for one not there, and every value of one that repeats. */
  read(params: Partial<Record<string, ParamValue>>): SearchOf<P>;
  /** Its sort, from its URL's `sort` and `dir`: a column it has, in a direction, or its fallback in its natural direction. */
  sort(search: { sort?: string; dir?: string }): SortSpec<Key>;
};

/** The columns a list sorts by. */
export type SortOf<L> = L extends StaffList<ParamKinds, infer Key> ? Key : never;

/** A staff list, from its definition. */
export function defineStaffList<const P extends ParamKinds, Key extends string = never>(
  definition: Definition<P, Key>,
): StaffList<P, Key> {
  const choosing = definition.choosing ?? [];
  return {
    ...definition,
    choosing,
    columns: definition.sorts?.columns ?? ({} as SortColumns<Key>),
    saved: [...(definition.kept ?? []), ...choosing, "sort", "dir"],
    read(params) {
      const entries = Object.entries(definition.params).map(([name, kind]) => [
        name,
        kind === "many" ? valuesOf(params[name]) : firstOf(params[name]),
      ]);
      return Object.fromEntries(entries) as SearchOf<P>;
    },
    sort({ sort, dir }) {
      const { columns, fallback } = definition.sorts!;
      return parseSort(columns, fallback, sort, dir);
    },
  };
}

export const POLITICIANS_LIST = defineStaffList({
  path: "/staff/politicians",
  needs: "account",
  params: {
    q: "one",
    house: "one",
    /** Blank for those in office, "any" for everyone. */
    status: "one",
    party: "many",
    flag: "many",
    /** Nations, as COUNTRIES. */
    nation: "many",
    email: "many",
    ask: "one",
    answer: "many",
    mailed: "many",
    /** Those who agreed to an ask in the last so many days. */
    agreed: "one",
    sort: "one",
    dir: "one",
    page: "one",
    /** Who the list is choosing for: a draft mailing's ID. Its rows can then be ticked, for the mailing. */
    mailing: "one",
    /**
     * While choosing, the tab after the houses: "ticked", only those ticked,
     * in place of what the filters find; "pasted", the lines of names pasted
     * and who each found. Blank for the list.
     */
    tab: "one",
    /** While choosing, the lines of names pasted, to show on the pasted tab. */
    pasted: "many",
    /** The saved filter loaded, by ID. */
    saved: "one",
  },
  choosing: ["q", "house", "status", "party", "flag", "nation", "email", "ask", "answer", "mailed", "agreed"],
  sorts: {
    // The Asks column sorts by when their newest answer was recorded, newest first: the dashboard
    // counts signatures by the same time. First and last activity sort by the times
    // POLITICIAN_ACTIVITY in lib/server/politicians.ts gives.
    columns: {
      name: "asc",
      house: "asc",
      constituency: "asc",
      party: "asc",
      emailsToThem: "desc",
      emailsFromThem: "desc",
      asks: "desc",
      first: "asc",
      active: "desc",
    },
    fallback: "name",
  },
});

export const SUPPORTERS_LIST = defineStaffList({
  path: "/staff/supporters",
  needs: "supporters",
  params: {
    q: "one",
    activity: "many",
    /** Each "<channel>:<topic>", with ":<answer>" or ":<reason>" after it, for one. */
    contact: "many",
    /** Luma event IDs. */
    event: "many",
    /** A campaign's slug; with `wrote` "no", those who didn't write in it. */
    campaign: "one",
    wrote: "one",
    /** Nations, as staffCopy.countries keys. */
    nation: "many",
    /** MPs' politician IDs. */
    mp: "many",
    /** A postcode, the first half of one, or a town; and how many miles from it. */
    near: "one",
    within: "one",
    /** Those first seen, registered for an event, or unsubscribed from Luma's emails in the last so many days. */
    first: "one",
    registered: "one",
    unsubscribed: "one",
    sort: "one",
    dir: "one",
    page: "one",
    /** After an erasure: "1", or "partly" with what couldn't be cleared in `why`, as codes. */
    erased: "one",
    /** The draft broadcast the list is choosing who for, by ID. */
    broadcast: "one",
    /** With `erased`, the codes above. */
    why: "one",
    /** The saved filter loaded, by ID. */
    saved: "one",
  },
  choosing: [
    "q",
    "activity",
    "contact",
    "event",
    "campaign",
    "wrote",
    "nation",
    "mp",
    "near",
    "within",
    "first",
    "registered",
    "unsubscribed",
  ],
  sorts: {
    columns: { active: "desc", first: "asc", name: "asc", events: "desc", letters: "desc" },
    fallback: "active",
  },
});

/** The events list. Its sorts are each tab's (EVENT_SORTS in lib/staff-events-list.ts). */
export const EVENTS_LIST = defineStaffList({
  path: "/staff/events",
  needs: "account",
  params: {
    /** "past" for the Past tab; blank for Future. */
    when: "one",
    q: "one",
    /** Staff emails, or NO_OWNER. */
    owner: "many",
    tag: "many",
    /** Cities, or ONLINE. */
    place: "many",
    /** "yes" for only those taken off Luma; blank leaves them out. */
    removed: "one",
    /** Those held in the last so many days. */
    held: "one",
    /** "owner" or "tag", for what's found in lists by it; blank for a table. */
    group: "one",
    sort: "one",
    dir: "one",
    page: "one",
    /** The saved filter loaded, by ID. */
    saved: "one",
  },
  choosing: ["q", "owner", "tag", "place", "removed", "held"],
  kept: ["when", "group"],
});

/** The audit log. It's newest first unless another sort is chosen. */
export const AUDIT_LOG_LIST = defineStaffList({
  path: "/staff/audit-log",
  needs: "admin",
  params: {
    q: "one",
    /** Who did it: a staff email, or "sync". */
    actor: "many",
    /** What they did. */
    action: "many",
    /** Those of the last so many days. */
    when: "one",
    sort: "one",
    dir: "one",
    page: "one",
    /** The saved filter loaded, by ID. */
    saved: "one",
  },
  choosing: ["q", "actor", "action", "when"],
  sorts: { columns: { day: "desc", actor: "asc", action: "asc" }, fallback: "day" },
});

/** A campaign's letters, on the campaign's page. It's newest written first unless another sort is chosen. */
export const LETTERS_LIST = defineStaffList({
  path: "/staff/campaigns/[slug]",
  needs: "supporters",
  params: {
    tab: "one",
    status: "one",
    q: "one",
    /** As LETTER_REPLIES. */
    answered: "one",
    /** Campaigns' slugs. */
    campaign: "many",
    /** The MP's markers, as POLITICIAN_FLAGS. */
    flag: "many",
    /** What sent it, as LETTER_BACKENDS. */
    backend: "many",
    sort: "one",
    dir: "one",
    page: "one",
  },
  sorts: {
    columns: {
      status: "asc",
      from: "asc",
      to: "asc",
      campaign: "asc",
      ownWords: "desc",
      backend: "asc",
      created: "desc",
      sent: "desc",
      replied: "desc",
    },
    fallback: "created",
  },
});

/** The send log. It's newest first unless another sort is chosen. */
export const SENT_EMAILS_LIST = defineStaffList({
  path: "/staff/sent-emails",
  needs: "admin",
  params: {
    q: "one",
    purpose: "many",
    outcome: "many",
    backend: "many",
    link: "many",
    sort: "one",
    dir: "one",
    page: "one",
  },
  sorts: {
    columns: { when: "desc", what: "asc", to: "asc", from: "asc", backend: "asc", subject: "asc", outcome: "asc" },
    fallback: "when",
  },
});

/** Every email with a politician. It's newest sent first unless another sort is chosen. */
export const ALL_EMAILS_LIST = defineStaffList({
  path: "/staff/emails",
  needs: "account",
  params: {
    q: "one",
    /** Senders, as EMAIL_SENDERS, those marked ! left out. */
    from: "many",
    /** Types, as EMAIL_TYPES, those marked ! left out. */
    type: "many",
    /** Politicians' IDs, those marked ! left out. */
    to: "many",
    /** Those sent in the last so many days. */
    sent: "one",
    /** "yes" or "no", whether it got a written reply; or a number, one in the last so many days. */
    replied: "one",
    /** The politicians' markers, as POLITICIAN_FLAGS, those marked ! left out. */
    flag: "many",
    sort: "one",
    dir: "one",
    page: "one",
  },
  sorts: {
    columns: { status: "asc", from: "asc", to: "asc", topic: "asc", sent: "desc", replied: "desc" },
    fallback: "sent",
  },
});

/** The staff accounts. It's by address unless another sort is chosen. */
export const ACCOUNTS_LIST = defineStaffList({
  path: "/staff/accounts",
  needs: "admin",
  params: { notice: "one", sort: "one", dir: "one" },
  sorts: {
    columns: { email: "asc", added: "desc", lastLogin: "desc", lastSeen: "desc", sessions: "desc", gmail: "desc" },
    fallback: "email",
  },
});

/** What has gone wrong on the site (lib/server/errors-seen.ts). It's the one seen most recently first, with no other sort. */
export const ERRORS_LIST = defineStaffList({
  path: "/staff/errors",
  needs: "admin",
  params: {
    /** "yes" for the Done tab; blank for those to do. */
    done: "one",
    page: "one",
  },
});

export type PoliticianSort = SortOf<typeof POLITICIANS_LIST>;
export type SupporterSort = SortOf<typeof SUPPORTERS_LIST>;
export type ChangeSort = SortOf<typeof AUDIT_LOG_LIST>;
export type LetterSort = SortOf<typeof LETTERS_LIST>;
export type SentEmailSort = SortOf<typeof SENT_EMAILS_LIST>;
export type AccountSort = SortOf<typeof ACCOUNTS_LIST>;
export type AllEmailsSort = SortOf<typeof ALL_EMAILS_LIST>;
