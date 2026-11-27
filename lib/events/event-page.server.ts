import "server-only";
import { cache } from "react";
import { query } from "@/lib/server/db.server";
import { GUEST_STATUSES, type GuestStatus } from "./guests";
import { listEvents, type StaffEvent } from "./staff-events-list.server";

// One of our events, for its staff page: the event as the events list has it,
// and the guests on its Luma guest list, as the Luma import has them. A
// guest Luma no longer lists is left out: they aren't coming.

/** One guest of an event, as Luma lists them. */
export type Guest = {
  id: string;
  /** Their name on Luma, empty if Luma has none. */
  name: string;
  /** Their email on Luma. */
  email: string;
  /** Their supporter, once linked. */
  supporterId: number | null;
  status: GuestStatus;
  registeredAt: Date;
  /** When the import last saw their registration change, such as off the waitlist. */
  changedAt: Date;
  /** Their answers to the event's postcode and phone questions on Luma, where it asked and they answered. */
  postcode: string | null;
  phone: string | null;
  /** The utm_source of the link they came to the event's Luma page by. */
  cameFrom: string | null;
};

/** An event's page: the event, and its guests for staff who see supporters, or null for those who don't. */
export type EventPage = { event: StaffEvent; guests: Guest[] | null };

/**
 * One of our events by its Luma ID, with its hosts and guests for staff who
 * see supporters (`people`); undefined for one not ours or not known. Its
 * guests are in GUEST_STATUSES' order, then by name, those with none last.
 */
export const eventPage = cache(async function eventPage(id: string, people: boolean): Promise<EventPage | undefined> {
  const [found] = await listEvents([id], people);
  if (!found) return undefined;
  const { hostEmails, ...event } = found;
  void hostEmails;
  return { event, guests: people ? await guestsOf(id) : null };
});

/** The guests Luma lists for event `id`. */
async function guestsOf(id: string): Promise<Guest[]> {
  return query<Guest>(
    `SELECT g.id, p.name, p.email,
       (SELECT min(k.supporter_id)::int FROM supporter_links k WHERE k.luma_user_id = g.user_id) AS "supporterId",
       g.approval_status AS status, g.registered_at AS "registeredAt", g.changed_at AS "changedAt",
       g.postcode, g.phone, g.utm_source AS "cameFrom"
     FROM luma_guests g JOIN luma_people p ON p.user_id = g.user_id
     WHERE g.event_id = $1 AND g.removed_at IS NULL
     ORDER BY array_position($2::text[], g.approval_status), p.name = '', lower(p.name) COLLATE english, p.email`,
    [id, GUEST_STATUSES],
  );
}
