import { json, type Fake } from "../fake";
import lumaFuture from "../luma-calendar-future.json";
import lumaPast from "../luma-calendar-past.json";
import lumaGuests from "../luma-guests.json";
import lumaContacts from "../luma-contacts.json";

// Luma's API and its event pages, as a fixture build's calendar, guests,
// contacts and tags.

/** An event on the calendar that isn't public, which the import leaves out. */
const LUMA_PRIVATE_EVENT = {
  id: "evt-fixture-private-planning",
  url: "https://luma.com/fixture-private-planning",
  name: "Organisers' planning call",
  start_at: "2030-03-20T19:00:00.000Z",
  visibility: "private",
  access: "manage",
  platform: "luma",
  geo_address_json: null,
  coordinate: null,
};

/** The fixture's hosts, as Luma's event details list them. */
const LUMA_HOST = {
  jane: { id: "usr-fixture-1", email: "Jane.Fixture@example.com", name: "Jane Fixture", avatar_url: null },
  sam: { id: "usr-fixture-2", email: "sam.fixture@example.com", name: "Sam Fixture", avatar_url: null },
  alex: { id: "usr-fixture-3", email: "alex.fixture@example.com", name: "Alex Fixture", avatar_url: null },
  // A host Luma has no name for.
  noName: { id: "usr-fixture-7", email: "host.fixture@example.com", name: null, avatar_url: null },
};

/** Each event's hosts, where they aren't Alex alone: the London protest's three, Jane, who registered for it too, Sam and one with no name. */
const LUMA_HOSTS: Record<string, object[]> = {
  "evt-fixture-london-protest": [LUMA_HOST.sam, LUMA_HOST.noName, LUMA_HOST.jane],
};

/** A list as Luma pages it: the first `size` entries, then, from cursor "page-2", the rest. */
function pageOf<T>(entries: T[], cursor: string | null, size: number) {
  if (cursor === "page-2") return { entries: entries.slice(size), has_more: false };
  return { entries: entries.slice(0, size), has_more: entries.length > size, next_cursor: "page-2" };
}

export const lumaFake: Fake = ({ hostname, pathname, searchParams }, init) => {
  if (hostname === "public-api.luma.com" && pathname === "/v1/calendars/events/list") {
    // lib/server/outside-services/luma-calendar.server.ts asks for past events with
    // "before", upcoming with "after"; the import asks for every event, and
    // gets both, and a private one it must leave out.
    if (searchParams.has("before")) return json(lumaPast);
    if (searchParams.has("after")) return json(lumaFuture);
    return json({ entries: [...lumaFuture.entries, ...lumaPast.entries, LUMA_PRIVATE_EVENT], has_more: false });
  }
  if (hostname === "public-api.luma.com" && pathname === "/v1/events/guests/list") {
    // The same guests for every event, each guest row's ID made unique to
    // the event, over two pages: the first three, then the rest.
    const eventId = searchParams.get("event_id") ?? "";
    const guests = lumaGuests.entries.map((guest) => ({ ...guest, id: `${guest.id}-${eventId}`, api_id: undefined }));
    return json(pageOf(guests, searchParams.get("pagination_cursor"), 3));
  }
  if (hostname === "public-api.luma.com" && pathname === "/v1/events/get") {
    // Any event's details, as far as the site reads them: its guest counts
    // and its hosts, which Luma gives for an event our calendar manages.
    const status = (guests: number) => ({ guests, tickets: guests });
    const eventId = searchParams.get("event_id") ?? "";
    return json({
      id: eventId,
      access: "manage",
      hosts: LUMA_HOSTS[eventId] ?? [LUMA_HOST.alex],
      guest_counts: {
        approved: status(1234),
        pending_approval: status(0),
        waitlist: status(0),
        invited: status(5),
        declined: status(12),
        checked_in: status(0),
      },
    });
  }
  if (hostname === "api.lu.ma" && pathname === "/event/get") {
    // Any event as its page on luma.com loads it, as far as the site reads
    // it: when it starts and ends, an evening in London, how many are going,
    // and the guests Luma features, with no photo a fixture build would
    // fetch: one with Luma's default, which next/image can't show, one with
    // none, and one with no name.
    return json({
      event: { start_at: "2026-11-20T18:00:00.000Z", end_at: "2026-11-20T21:00:00.000Z", timezone: "Europe/London" },
      guest_count: 1234,
      featured_guests: [
        { name: "Jane Fixture", avatar_url: "https://cdn.lu.ma/avatars-default/avatar_1.png" },
        { name: "Sam Fixture", avatar_url: null },
        { name: null, avatar_url: null },
        null,
      ],
    });
  }
  if (hostname === "public-api.luma.com" && pathname === "/v1/calendars/contacts/list") {
    return json(pageOf(lumaContacts.entries, searchParams.get("pagination_cursor"), 2));
  }
  if (hostname === "public-api.luma.com" && pathname === "/v1/calendars/event-tags/list") {
    return json({
      entries: [
        { id: "tag-fixture-big-events", name: "Big events", color: "orange" },
        { id: "tag-fixture-online", name: "Online", color: "cranberry" },
        { id: "tag-fixture-london", name: "London", color: "purple" },
        { id: "tag-fixture-manchester", name: "Manchester", color: "red" },
        { id: "tag-fixture-oxford", name: "Oxford", color: "green" },
        { id: "tag-fixture-scotland", name: "Scotland", color: "blue" },
        { id: "tag-fixture-west-of-england", name: "West of England", color: "yellow" },
        { id: "tag-fixture-leicester", name: "Leicester", color: "barney" },
      ],
      has_more: false,
    });
  }
  if (hostname === "public-api.luma.com" && pathname === "/v1/calendars/contacts/remove") {
    return json({});
  }
  if (hostname === "public-api.luma.com" && pathname === "/v1/calendars/event-tags/apply") {
    const { event_ids } = JSON.parse(String(init!.body)) as { event_ids: string[] };
    return json({ applied_count: event_ids.length, skipped_count: 0 });
  }
  if (hostname === "public-api.luma.com" && pathname === "/v1/events/guests/add") {
    // Sign-ups. Luma takes every guest but two: one it skips, as if they'd
    // unsubscribed from the calendar, and one that fails the whole call.
    const { guests } = JSON.parse(String(init!.body)) as { guests: { email: string }[] };
    const emails = guests.map((guest) => guest.email);
    if (emails.some((email) => email.startsWith("luma-fails@"))) {
      return new Response('{"message":"Fixture failure"}', { status: 500 });
    }
    return json({ skipped: emails.filter((email) => email.startsWith("luma-skips@")).map((email) => ({ email })) });
  }
  return undefined;
};
