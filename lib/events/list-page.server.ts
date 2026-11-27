import "server-only";
import { now } from "@/lib/now";
import { findEvents, type EventsFound } from "./list";
import type { EventFilter } from "./list-terms";
import { choicesOf, listEvents, withoutEmails } from "./staff-events-list.server";

// The staff events page (/staff/events): our events, as
// ./staff-events-list.server.ts lists them, through the list's filters
// (./list.ts). Apart from the events and the filters' choices, which the
// saved filters read for every list, so changing how the list filters
// reaches only its own page.

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
