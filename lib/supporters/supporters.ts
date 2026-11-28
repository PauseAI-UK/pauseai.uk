// Supporters, as the staff pages show them: the shapes the server
// (lib/supporters/records.server.ts) gives the components.
import type { SupporterSort } from "@/lib/staff-lists";
import { permanentRedirect } from "next/navigation";
import type { ContactPermission, ContactState } from "./contact-permissions";
import type { SortDirection } from "@/lib/staff-sort";
import { supportersCopy } from "./copy";

/** Where a supporter came from: Luma, CiviCRM's UK chapter contacts (the members), or one of our forms (form_entries.form): Email your MP, pauseai.info's old letter form, a march's sign-up, a paper sign-up, an upload of our WhatsApp community, or its waiting room. */
export const SUPPORTER_SOURCES = [
  "luma",
  "civicrm",
  "email-your-mp",
  "web-form",
  "march-2026-11",
  "march-2027-04",
  "paper-signup",
  "whatsapp-community",
  "whatsapp-join",
] as const;
export type SupporterSource = (typeof SUPPORTER_SOURCES)[number];

/** The marches' sign-ups, one form a march. */
export const MARCH_SOURCES: readonly SupporterSource[] = ["march-2026-11", "march-2027-04"];

/** Our WhatsApp community: a member in an upload of it, or someone let in from its waiting room. */
export const WHATSAPP_SOURCES: readonly SupporterSource[] = ["whatsapp-community", "whatsapp-join"];

/** Whether they signed up for a march, whichever one. */
export function signedUpForMarch(sources: readonly SupporterSource[]): boolean {
  return MARCH_SOURCES.some((source) => sources.includes(source));
}

/** Whether they came by our WhatsApp community, in an upload of it or through its waiting room. */
export function cameByWhatsApp(sources: readonly SupporterSource[]): boolean {
  return WHATSAPP_SOURCES.some((source) => sources.includes(source));
}

/** What a supporter_links row points at (lib/supporters/sources.server.ts): a Luma user, a form entry or a CiviCRM contact. */
export type SupporterLinkSource = "luma" | "form" | "civicrm";

/**
 * The lozenges in the list's Activities column, in its order: a member, a
 * contact of the Luma calendar, registered for events, wrote to their MP,
 * signed up for a march, on a paper sign-up form, in our WhatsApp community.
 */
export const SUPPORTER_BADGES = [
  "member",
  "lumaContact",
  "registered",
  "letter",
  "march",
  "paper",
  "whatsapp",
] as const;
export type SupporterBadge = (typeof SUPPORTER_BADGES)[number];

export function isSupporterBadge(value: string): value is SupporterBadge {
  return (SUPPORTER_BADGES as readonly string[]).includes(value);
}

/** One row of the list: what's known of a supporter across their sources. */
export type SupporterSummary = {
  id: number;
  /** The newest name any source gave, or null when none did. */
  name: string | null;
  emails: string[];
  /** Every number any source gave, in international format, newest first, whether we may use them or not. */
  phones: string[];
  postcode: string | null;
  sources: SupporterSource[];
  /** Whether they're a contact of the Luma calendar now, as registering for an event or following it makes them, and unsubscribing undoes. */
  lumaContact: boolean;
  firstSeenAt: Date | null;
  lastActiveAt: Date | null;
  /** Events registered for, declined ones left out. */
  events: number;
  letters: number;
  /** Broadcasts they were sent a copy of, whether it went or not, as their page lists them. */
  broadcasts: number;
  /** Notes staff have written on them. */
  notes: number;
  /** Whether they're a PauseAI member now: a UK chapter contact CiviCRM's last pull returned. */
  member: boolean;
  /** Where they are, as best we know (the supporter_place view); null if we don't. */
  place?: SupporterPlaceName | null;
};

/** A supporter's place: its name, what it's from and what that was (a postcode, a city, an event's name, a local WhatsApp group's name), its nation, and where it is. */
export type SupporterPlaceName = {
  name: string | null;
  basis: "postcode" | "city" | "event" | "group";
  given: string;
  country: string | null;
  /** Where it is; left out where it isn't needed, as in a list's row. */
  latitude?: number | null;
  longitude?: number | null;
};

/** One row of the list, with whether we'd contact each of their addresses and numbers about each topic. */
export type SupporterRow = SupporterSummary & {
  permissions: ContactPermission[];
  /** With the Event filter on, their registrations for the events it finds: each event's name and how it stands. */
  registrations?: { event: string; status: string }[];
  /** With the Campaign filter finding those who wrote, when they first wrote in it. */
  wroteAt?: Date;
  /** With the MP filter finding those with an MP, theirs: the one in office for the postcode that places them. */
  mp?: Pick<SupporterMp, "name" | "constituency"> | null;
};

/** What a supporter did, from any source: `kind` says what, `title` and `detail` which and how. */
export type SupporterActivity = {
  source: string;
  at: Date;
  kind:
    | "luma-contact"
    | "luma-registered"
    | "luma-hosted"
    | "letter"
    | "letter-replied"
    | "form-entry"
    | "whatsapp-joined"
    | "member-joined"
    | "member-left"
    | "opted-out"
    | "resubscribed";
  /** The event's or form's name, or a letter's campaign's slug. */
  title: string | null;
  /** A letter's campaign's title, as the campaigns table has it; null for every other kind. */
  campaignTitle: string | null;
  /** Where an old campaign's letter can be read, as the campaigns table has it; null for one in code, one with none, and every other kind. */
  /** Who or what it was with: the event's status, the MP's name, or the address. */
  detail: string | null;
  href: string | null;
  /** A letter's status; null for every other kind. */
  status: string | null;
  /** A letter's ID, for a link to it; null for every other kind. */
  letterId?: number | null;
  /** When the event starts, for a registration or hosting, where the supporter's page reads it; null for an event no longer copied. */
  eventAt?: Date | null;
  /** For an opt-out staff recorded, how the person told them; null for one from a reply, or not staff's. */
  how?: string | null;
  /** For an opt-out staff recorded, who; null for any other. */
  recordedBy?: string | null;
  /** For an opt-out from one of our broadcasts (a reply to it, its links, a complaint), its copy's thread page; else null. */
  thread?: string | null;
};

/** Whether an activity is known only to the day: joining PauseAI, as CiviCRM gives it. */
export function dayOnly(item: Pick<SupporterActivity, "source" | "kind">): boolean {
  return item.source === "civicrm" && item.kind === "member-joined";
}

/** A name and email one source gave, and when the person was first seen there. A WhatsApp member gives no email, and a profile name or ''. */
export type SupporterIdentity = { source: SupporterSource; email: string | null; name: string; seenAt: Date | null };

/** A phone, postcode, city or place one source gave, and when. */
export type SupporterContact = {
  source: SupporterSource;
  at: Date;
  /** In international format. */
  phone: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
};

/** A supporter's MP: the one in office for the constituency of the postcode that places them. */
export type SupporterMp = { id: number; name: string; constituency: string; party: string };

/** A letter a supporter wrote: which, when, to whom, in which campaign, and how it stands. */
export type SupporterLetter = {
  id: number;
  sentAt: Date | null;
  mpName: string;
  politicianId: number;
  isTest: boolean;
  campaign: string;
  /** The campaign's title, as the campaigns table has it. */
  campaignTitle: string;
  /** Where an old campaign's letter can be read, as the campaigns table has it. */
  status: string;
  /** How many replies the MP's office sent, at least one once it's marked replied; 0 if none. */
  replies: number;
};

export type SupporterDetails = {
  summary: SupporterSummary;
  /** Their letters, newest first. */
  letters: SupporterLetter[];
  /** Their MP, when a postcode places them and its constituency has one in office; else null. */
  mp: SupporterMp | null;
  identities: SupporterIdentity[];
  contacts: SupporterContact[];
  /** The town of each WhatsApp group upload they're in that gave one: it's the upload's, not their form entry's. */
  groupTowns: SupporterGroupTown[];
  activity: SupporterActivity[];
  /** Whether we may contact each of their addresses and numbers about each topic, and why. */
  permissions: ContactPermission[];
  /**
   * Whether each of their addresses that has joined our Luma calendar is on it now, and since when or what took it
   * off (lumaCalendarAnswers): where Luma's own messages go, which no list of ours says.
   */
  luma: ContactPermission[];
};

/** A WhatsApp group's town, from an upload of its members a supporter is in: the group's name, and when it was uploaded. */
export type SupporterGroupTown = { town: string; group: string; at: Date };

/** What the list can be sorted by, a column heading or the Sort by field, and which way a first click goes. */

/** How far from a place the Near filter reaches, in miles. */
export const NEAR_MILES = [5, 10, 25, 50] as const;

/** The MP filter's value for those with any MP, beside each MP's own ID. */
export const ANY_MP = "any";

/** The filters that repeat, which can leave out as well as find. */
export type NegatableSupporterFilter = "activity" | "contact" | "event" | "country" | "mp" | "hasMp";

/** Who the list shows, as the server finds them. A filter that repeats finds those with any of its values. */
export type SupporterWho = {
  /** Those first seen, registered for an event, or unsubscribed from Luma's emails in the last so many days. */
  firstDays?: number;
  registeredDays?: number;
  unsubscribedDays?: number;
  /** Over names, emails and phones. */
  search?: string;
  /** Has any of these lozenges in the Activities column. */
  activity?: SupporterBadge[];
  /** Has any of these answers about a topic by a channel, or is blocked, at any of their addresses or numbers. */
  contact?: ContactState[];
  /** Registered for any of these Luma events, by ID, but for declined. */
  event?: string[];
  /** Wrote a letter in this campaign, by slug; or, with `wrote` false, never did. */
  campaign?: string;
  wrote?: boolean;
  /** In any of these nations (supporter_place). */
  country?: string[];
  /** In the constituency of any of these MPs, by politician ID, by the postcode that places them. */
  mp?: number[];
  /** With an MP in office, by the postcode that places them, as a broadcast's fields about their MP need; in `not`, without one. */
  hasMp?: boolean;
  /** Within `miles` of what was typed: a postcode, the first half of one, or a town. */
  near?: { text: string; miles: number };
  /** Those with none of these, each a filter above that repeats. */
  not?: Pick<SupporterWho, NegatableSupporterFilter>;
};

/** Who the list shows, and how: its sort and page. */
export type SupporterFilter = SupporterWho & {
  sort: SupporterSort;
  dir: SortDirection;
  page: number;
};

export const SUPPORTERS_PAGE_SIZE = 100;

/**
 * A registration's status, as a table cell has it: Luma's, or registered
 * for an approved one, starting with a capital, as the statuses are
 * written to follow a dot in the history.
 */
export function registrationStatus(status: string | null): string {
  const words = supportersCopy.supporters.detail.statuses[status ?? ""] ?? supportersCopy.supporters.detail.registered;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Their events, newest first, as the activity has them: those they registered for, and those they hosted, a row each. */
export function eventsOf(activity: SupporterActivity[]): SupporterActivity[] {
  return activity.filter((a) => a.kind === "luma-registered" || a.kind === "luma-hosted");
}

/**
 * How many different events they registered for, but didn't decline, or
 * hosted, as supporters_summary counts them: one they registered for and
 * hosted counts once. An event's link is its own.
 */
export function eventsCounted(activity: SupporterActivity[]): number {
  return new Set(
    eventsOf(activity)
      .filter((a) => a.kind === "luma-hosted" || a.detail !== "declined")
      .map((a) => a.href),
  ).size;
}

/** A supporter's page's name: theirs, or the stand-in for one with none. */
export function supporterTitle(summary: Pick<SupporterSummary, "name">): string {
  return summary.name ?? supportersCopy.supporters.noName;
}

/**
 * The supporter the URL's ID found, or a redirect to their own page when
 * that ID was merged into theirs (supporter_merges): a phone match makes
 * two supporters one, and an old link goes on to the one kept.
 */
export function canonicalSupporter(given: number, supporter: SupporterDetails): SupporterDetails {
  if (supporter.summary.id !== given) permanentRedirect(`/staff/supporters/${supporter.summary.id}`);
  return supporter;
}
