import "server-only";
import { cache } from "react";
import { now } from "@/lib/now";
import { findEvents, type EventFilter, type EventsFound } from "./list";
import { query } from "@/lib/server/db.server";

// Our events on Luma, as the Luma import has them (luma-import.server.ts), for
// the staff interface's events page, with who on staff owns each
// (event_owners), the link to its Google Doc (event_docs), and its hosts on
// Luma (luma_event_hosts), whom only staff who see supporters see. Only our
// own: one another calendar runs and ours lists isn't ours to own. Setting
// an owner or a doc is ./staff-events.server.ts.

/** One of an event's hosts: their name on Luma, empty if Luma has none, and their supporter, once linked. */
export type EventHost = { name: string; supporterId: number | null };

export type StaffEvent = {
  id: string;
  name: string;
  /** Its page on luma.com. */
  url: string;
  /** When it starts. */
  startAt: Date;
  /** None for one online. */
  city: string | null;
  /** The calendar's tags on it in Luma: a local group, Big events, Online. */
  tags: string[];
  /** Gone from our Luma calendar, kept for its history. */
  removed: boolean;
  /** Registered and approved, and still on its guest list. */
  going: number;
  /** Its owner's staff email, if it has one. */
  owner: string | null;
  /** The link to its Google Doc, if anyone has set one. */
  doc: string | null;
  /** Its hosts on Luma, by name; none for staff who don't see supporters. */
  hosts: EventHost[];
};

/** An event as the list searches it: with its hosts' emails too, which the page never shows. */
export type SearchedEvent = StaffEvent & { hostEmails: string[] };

const SELECT_EVENTS = `SELECT e.id, e.name, 'https://luma.com/' || e.url AS url, e.start_at AS "startAt", e.city, e.tags,
    e.removed_at IS NOT NULL AS removed,
    (SELECT count(*)::int FROM luma_guests g WHERE g.event_id = e.id AND g.approval_status = 'approved' AND g.removed_at IS NULL) AS going,
    o.owner, d.url AS doc,
    (SELECT coalesce(json_agg(json_build_object('name', p.name, 'email', p.email, 'supporterId', k.supporter_id)
        ORDER BY p.name = '', lower(p.name) COLLATE english, p.email), '[]')
      FROM luma_event_hosts h JOIN luma_people p ON p.user_id = h.user_id
        LEFT JOIN supporter_links k ON k.luma_user_id = h.user_id
      WHERE h.event_id = e.id) AS hosts
  FROM luma_events e LEFT JOIN event_owners o ON o.event_id = e.id LEFT JOIN event_docs d ON d.event_id = e.id
  WHERE e.access = 'manage'`;

/**
 * Our events whose IDs are `ids`, or all of them, soonest first, each with
 * its hosts by name, those with none last,
 * and their emails; or, without `hosts`, none.
 */
export const listEvents = cache(async function listEvents(ids?: string[], hosts = false): Promise<SearchedEvent[]> {
  const rows = await query<Omit<StaffEvent, "hosts"> & { hosts: (EventHost & { email: string })[] }>(
    `${SELECT_EVENTS} AND ($1::text[] IS NULL OR e.id = ANY($1)) ORDER BY e.start_at, e.id`,
    [ids ?? null],
  );
  return rows.map((event) => {
    const shown = hosts ? event.hosts : [];
    return {
      ...event,
      hosts: shown.map(({ name, supporterId }) => ({ name, supporterId })),
      hostEmails: shown.map((host) => host.email),
    };
  });
});

/** An event as the page has it: without its hosts' emails. */
function withoutEmails({ hostEmails, ...event }: SearchedEvent): StaffEvent {
  void hostEmails;
  return event;
}

/**
 * The events page: the events `filter` finds, a page of them, or all of
 * them for lists by a grouping (findEvents), with their hosts for staff who see supporters (`hosts`),
 * who can search by them, but never their emails; every staff account,
 * whom an event can be given to and the Owner filter offers; every tag and
 * city our events have, for the Tag and Place filters, in alphabetical
 * order; and now.
 */
export async function eventsPage(
  filter: EventFilter,
  hosts: boolean,
): Promise<EventsFound & { staff: string[]; tags: string[]; cities: string[]; now: Date }> {
  const at = now();
  const events = await listEvents(undefined, hosts);
  const found = findEvents(events, filter, at);
  return {
    ...found,
    events: found.events.map(withoutEmails),
    ...(await choicesOf(events)),
    now: at,
  };
}

/** What the events list's filters offer, among `events`. */
const choicesOf = cache(async function choicesOf(
  events: SearchedEvent[],
): Promise<{ staff: string[]; tags: string[]; cities: string[] }> {
  const staff = await query<{ email: string }>("SELECT email FROM staff_accounts ORDER BY email");
  const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
  return {
    staff: staff.map((account) => account.email),
    tags: sorted(events.flatMap((event) => event.tags)),
    cities: sorted(events.flatMap((event) => event.city ?? [])),
  };
});

/** What the events list's filters offer: every staff account, and every tag and city our events have. */
export async function eventChoices(): Promise<{ staff: string[]; tags: string[]; cities: string[] }> {
  return choicesOf(await listEvents());
}
