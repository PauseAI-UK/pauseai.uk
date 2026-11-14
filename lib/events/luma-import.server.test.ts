import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { query } from "@/lib/server/db.server";
import { allResults, heldAtOnce } from "@/tests/at-once";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { startRunning } from "@/lib/server/import-runs.server";
import { ANOTHER_RUNNING, runJob } from "@/lib/jobs/jobs.server";
import { importLuma } from "./luma-import.server";

const API = "https://public-api.luma.com/v1";

/** An ISO time `n` days from now. */
const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

type Guest = Record<string, unknown>;

/** A small Luma: its lists, how it pages them, and what it refuses. Every request is noted. */
type FakeLuma = {
  events: Record<string, unknown>[];
  guests: Record<string, Guest[]>;
  /** Each event's hosts, as its details list them. */
  hosts: Record<string, unknown[]>;
  contacts: Record<string, unknown>[];
  pageSize: number;
  remaining?: number;
  /** Events whose guest list answers 500. */
  failGuests: string[];
  /** Events whose guest list answers 429. */
  rateLimitGuests: string[];
  /** Events whose details answer 500, and 429. */
  failHosts: string[];
  rateLimitHosts: string[];
  failEvents: boolean;
  /** A contacts cursor that answers 500. */
  failContactsCursor?: string;
  /** "events", "guests:evt-1", "hosts:evt-1" or "contacts", with the cursor if any. */
  requests: string[];
};

function page(fake: FakeLuma, list: unknown[], cursor: string | null) {
  const from = Number(cursor ?? 0);
  const entries = list.slice(from, from + fake.pageSize);
  const more = from + fake.pageSize < list.length;
  const headers: Record<string, string> =
    fake.remaining === undefined ? {} : { "x-ratelimit-remaining": String(fake.remaining) };
  return HttpResponse.json(
    { entries, has_more: more, next_cursor: more ? String(from + fake.pageSize) : undefined },
    { headers },
  );
}

function fakeLuma(fake: Partial<FakeLuma> = {}): FakeLuma {
  const luma: FakeLuma = {
    events: [],
    guests: {},
    hosts: {},
    contacts: [],
    pageSize: 50,
    failGuests: [],
    rateLimitGuests: [],
    failHosts: [],
    rateLimitHosts: [],
    failEvents: false,
    requests: [],
    ...fake,
  };
  const note = (what: string, cursor: string | null) => luma.requests.push(cursor ? `${what}@${cursor}` : what);
  server.use(
    http.get(`${API}/calendars/events/list`, ({ request }) => {
      const cursor = new URL(request.url).searchParams.get("pagination_cursor");
      note("events", cursor);
      if (luma.failEvents) return new HttpResponse(null, { status: 500 });
      return page(luma, luma.events, cursor);
    }),
    http.get(`${API}/events/guests/list`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const id = params.get("event_id")!;
      const cursor = params.get("pagination_cursor");
      note(`guests:${id}`, cursor);
      if (luma.failGuests.includes(id)) return new HttpResponse(null, { status: 500 });
      if (luma.rateLimitGuests.includes(id)) return new HttpResponse(null, { status: 429 });
      return page(luma, luma.guests[id] ?? [], cursor);
    }),
    http.get(`${API}/events/get`, ({ request }) => {
      const id = new URL(request.url).searchParams.get("event_id")!;
      note(`hosts:${id}`, null);
      if (luma.failHosts.includes(id)) return new HttpResponse(null, { status: 500 });
      if (luma.rateLimitHosts.includes(id)) return new HttpResponse(null, { status: 429 });
      const headers: Record<string, string> =
        luma.remaining === undefined ? {} : { "x-ratelimit-remaining": String(luma.remaining) };
      return HttpResponse.json({ hosts: luma.hosts[id] ?? [] }, { headers });
    }),
    http.get(`${API}/calendars/contacts/list`, ({ request }) => {
      const cursor = new URL(request.url).searchParams.get("pagination_cursor");
      note("contacts", cursor);
      if (cursor && cursor === luma.failContactsCursor) return new HttpResponse(null, { status: 500 });
      return page(luma, luma.contacts, cursor);
    }),
  );
  return luma;
}

const event = (id: string, startAt: string, more: Record<string, unknown> = {}) => ({
  id,
  url: `https://luma.com/${id}`,
  name: `Event ${id}`,
  start_at: startAt,
  visibility: "public",
  access: "manage",
  geo_address_json: { city: "London", address: "Somewhere" },
  coordinate: { latitude: 51.5, longitude: -0.1 },
  ...more,
});

const guest = (n: number, more: Guest = {}): Guest => ({
  id: `gst-${n}`,
  user_id: `usr-${n}`,
  user_email: `Person${n}@Example.com`,
  user_name: `Person ${n}`,
  approval_status: "approved",
  registered_at: "2026-10-01T10:00:00.000Z",
  phone_number: null,
  utm_source: null,
  registration_answers: [],
  ...more,
});

const contact = (n: number, createdAt = "2026-09-01T00:00:00.000Z") => ({
  user_id: `usr-${n}`,
  email: `person${n}@example.com`,
  name: `Person ${n}`,
  created_at: createdAt,
});

const optOuts = () =>
  query<{ address: string; source: string; resubscribed_at: Date | null }>(
    "SELECT address, source, resubscribed_at FROM opt_outs ORDER BY id",
  );
const runs = () =>
  query<{ status: string; error: string | null; result: Record<string, unknown> }>(
    "SELECT status, error, result FROM import_runs ORDER BY id",
  );
const guestRows = () =>
  query<{ id: string; event_id: string; user_id: string; removed_at: Date | null; postcode: string | null }>(
    "SELECT id, event_id, user_id, removed_at, postcode FROM luma_guests ORDER BY id",
  );
const eventRows = () =>
  query<{ id: string; guests_synced_at: Date | null; guests_error: string | null }>(
    "SELECT id, guests_synced_at, guests_error FROM luma_events ORDER BY id",
  );
const setSynced = (id: string, interval: string | null) =>
  query(
    `UPDATE luma_events SET guests_synced_at = CASE WHEN $2::text IS NULL THEN NULL ELSE now() - $2::interval END WHERE id = $1`,
    [id, interval],
  );

beforeEach(() => vi.stubEnv("LUMA_API_KEY", "k"));
afterEach(() => vi.unstubAllEnvs());

describeWithDatabase("importLuma", () => {
  useTestDatabase();

  it("copies the events, their registered guests and the contacts, once", async () => {
    const jane = guest(1, {
      phone_number: "+447700900001",
      registration_answers: [{ label: "Your postcode", answer: "M1 1AE" }],
      utm_source: "flyer",
    });
    const luma = fakeLuma({
      events: [
        event("evt-live", days(1)),
        event("evt-old", days(-60), { geo_address_json: null, coordinate: null }),
        { id: "evt-private", url: "p", name: "P", start_at: days(2), visibility: "private" },
      ],
      guests: {
        "evt-live": [
          jane,
          { api_id: "gst-2", guest: guest(2, { approval_status: "waitlist" }) },
          guest(3, { approval_status: "invited", registered_at: null }),
          guest(4, { approval_status: "session" }),
          // Luma never lists a guest twice; if it did, the row would be written once.
          jane,
        ],
        "evt-old": [guest(1, { id: "gst-6" }), guest(5, { approval_status: "declined" })],
      },
      contacts: [contact(1), contact(6)],
    });

    const result = await importLuma("jo@pauseai.uk");
    expect(result).toEqual({
      events: 2,
      eventsSynced: 2,
      eventsLeft: 0,
      guestsChanged: 4,
      hostsChanged: 0,
      people: 3,
      contacts: 2,
      contactPages: 1,
      eventsTagged: 0,
      supportersAdded: 4,
      linked: 4,
      places: { postcodes: 1, towns: 1, failed: false },
      requests: 6,
      refreshed: true,
    });
    expect(await query("SELECT count(*)::int AS n FROM supporter_links")).toEqual([{ n: 4 }]);
    expect(luma.requests).toEqual([
      "events",
      "guests:evt-live",
      "guests:evt-old",
      "hosts:evt-live",
      "hosts:evt-old",
      "contacts",
    ]);
    expect(await query("SELECT id, name, city, latitude FROM luma_events ORDER BY id")).toEqual([
      { id: "evt-live", name: "Event evt-live", city: "London", latitude: 51.5 },
      { id: "evt-old", name: "Event evt-old", city: null, latitude: null },
    ]);
    expect(await query("SELECT user_id, email, name, contact_since FROM luma_people ORDER BY user_id")).toEqual([
      {
        user_id: "usr-1",
        email: "person1@example.com",
        name: "Person 1",
        contact_since: new Date(contact(1).created_at),
      },
      { user_id: "usr-2", email: "person2@example.com", name: "Person 2", contact_since: null },
      { user_id: "usr-5", email: "person5@example.com", name: "Person 5", contact_since: null },
      {
        user_id: "usr-6",
        email: "person6@example.com",
        name: "Person 6",
        contact_since: new Date(contact(1).created_at),
      },
    ]);
    expect(await query("SELECT id, approval_status, phone, postcode, utm_source FROM luma_guests ORDER BY id")).toEqual(
      [
        { id: "gst-1", approval_status: "approved", phone: "+447700900001", postcode: "M1 1AE", utm_source: "flyer" },
        { id: "gst-2", approval_status: "waitlist", phone: null, postcode: null, utm_source: null },
        { id: "gst-5", approval_status: "declined", phone: null, postcode: null, utm_source: null },
        { id: "gst-6", approval_status: "approved", phone: null, postcode: null, utm_source: null },
      ],
    );
    expect((await eventRows()).map((e) => e.guests_synced_at !== null)).toEqual([true, true]);
    expect((await runs())[0]).toMatchObject({ status: "ok", result: { events: 2 } });

    // At once: neither event's guests nor hosts are due again, and nothing's new.
    const again = await importLuma("jo@pauseai.uk");
    expect(again).toEqual({
      events: 0,
      eventsSynced: 0,
      eventsLeft: 0,
      guestsChanged: 0,
      hostsChanged: 0,
      people: 0,
      contacts: 0,
      contactPages: 1,
      eventsTagged: 0,
      supportersAdded: 0,
      linked: 0,
      // Nothing new to look up.
      places: { postcodes: 0, towns: 0, failed: false },
      requests: 2,
    });
    expect((await runs())[1].status).toBe("unchanged");

    // An event edited in Luma: changed here, and its guests not read again for it.
    luma.events[0] = event("evt-live", days(1), { name: "Renamed" });
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ events: 1, eventsSynced: 0, requests: 2 });
  });

  it("works out the supporters again after a change, and after an hour without, but not after a run that changed nothing within the hour", async () => {
    fakeLuma({ events: [event("evt-1", days(1))], guests: { "evt-1": [guest(1)] }, contacts: [contact(1)] });
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ events: 1, refreshed: true });
    expect(await importLuma("jo@pauseai.uk")).not.toHaveProperty("refreshed");
    // The run that worked them out, over an hour ago.
    await query("UPDATE import_runs SET at = now() - interval '61 minutes' WHERE (result->>'refreshed')::boolean");
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ events: 0, refreshed: true });
    expect(await importLuma("jo@pauseai.uk")).not.toHaveProperty("refreshed");
  });

  it("stops at the first events page with nothing new, and once a day reads every page and marks events gone from the calendar removed", async () => {
    const luma = fakeLuma({
      events: [event("evt-3", days(3)), event("evt-2", days(2)), event("evt-1", days(1))],
      guests: { "evt-1": [guest(1)] },
      pageSize: 1,
    });
    await importLuma("jo@pauseai.uk");
    expect(luma.requests.filter((r) => r.startsWith("events"))).toEqual(["events", "events@1", "events@2"]);
    expect(await guestRows()).toHaveLength(1);

    // Not due a full pass, so the first unchanged page ends it.
    luma.requests.length = 0;
    luma.events[0] = event("evt-3", days(3), { name: "Renamed" });
    expect((await importLuma("jo@pauseai.uk")).events).toBe(1);
    expect(luma.requests.filter((r) => r.startsWith("events"))).toEqual(["events", "events@1"]);

    // Due one: every page, and the event no longer listed is marked removed, keeping its guests.
    const fullPassDue = () =>
      query("UPDATE luma_import_state SET full_pass_at = now() - interval '1 day' WHERE list = 'events'");
    const removed = () => query<{ id: string }>("SELECT id FROM luma_events WHERE removed_at IS NOT NULL");
    await fullPassDue();
    const gone = luma.events.pop()!;
    luma.requests.length = 0;
    expect((await importLuma("jo@pauseai.uk")).events).toBe(1);
    expect(luma.requests.filter((r) => r.startsWith("events"))).toEqual(["events", "events@1"]);
    expect(await removed()).toEqual([{ id: "evt-1" }]);
    expect(await guestRows()).toHaveLength(1);

    // Its guests aren't read while it's removed, however long since they were.
    await setSynced("evt-1", "100 days");
    luma.requests.length = 0;
    await importLuma("jo@pauseai.uk");
    expect(luma.requests).not.toContain("guests:evt-1");

    // A second full pass leaves it as it was; listed again, it's back.
    await fullPassDue();
    expect((await importLuma("jo@pauseai.uk")).events).toBe(0);
    luma.events.push(gone);
    await fullPassDue();
    expect((await importLuma("jo@pauseai.uk")).events).toBe(1);
    expect(await removed()).toEqual([]);
  });

  it("reads guests again when due, live events first, then never read, then settled, with failed ones last", async () => {
    const luma = fakeLuma({
      events: [
        event("evt-live", days(1)),
        event("evt-new", days(-10)),
        event("evt-settled-early", days(-10)),
        event("evt-settled-stale", days(-100)),
        event("evt-settled-fresh", days(-100)),
        event("evt-failed", days(2)),
        event("evt-view", days(1), { access: "view" }),
      ],
      failGuests: ["evt-failed"],
    });
    await importLuma("jo@pauseai.uk");
    expect((await eventRows()).find((e) => e.id === "evt-failed")).toMatchObject({
      guests_synced_at: null,
      guests_error: "Luma answered 500 for /v1/events/guests/list",
    });
    await setSynced("evt-live", "2 hours");
    await setSynced("evt-new", null);
    // Read a day after it started, so still settling.
    await query("UPDATE luma_events SET guests_synced_at = start_at + interval '1 day' WHERE id = 'evt-settled-early'");
    await setSynced("evt-settled-stale", "31 days");
    await setSynced("evt-settled-fresh", "10 days");
    luma.requests.length = 0;
    luma.failGuests = [];
    const result = await importLuma("jo@pauseai.uk");
    expect(luma.requests).toEqual([
      "events",
      "guests:evt-live",
      "guests:evt-new",
      "guests:evt-settled-early",
      "guests:evt-settled-stale",
      "guests:evt-failed",
      "contacts",
    ]);
    expect(result).toMatchObject({ eventsSynced: 5, eventsLeft: 0 });
    expect((await eventRows()).find((e) => e.id === "evt-failed")).toMatchObject({ guests_error: null });
  });

  it("marks a guest gone from the list as removed, and back again when seen, and changes a person's details", async () => {
    const luma = fakeLuma({ events: [event("evt-1", days(1))], guests: { "evt-1": [guest(1), guest(2)] } });
    await importLuma("jo@pauseai.uk");
    luma.guests["evt-1"] = [guest(1, { user_name: "Person One" })];
    await setSynced("evt-1", "2 hours");
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ guestsChanged: 1, people: 1 });
    expect((await guestRows()).map((g) => [g.id, g.removed_at !== null])).toEqual([
      ["gst-1", false],
      ["gst-2", true],
    ]);
    luma.guests["evt-1"] = [guest(1, { user_name: "Person One" }), guest(2)];
    await setSynced("evt-1", "2 hours");
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ guestsChanged: 1, people: 0 });
    expect((await guestRows()).map((g) => g.removed_at)).toEqual([null, null]);
  });

  it("never brings back an erased user, as a guest or a contact", async () => {
    await query("INSERT INTO luma_erased (user_id) VALUES ('usr-1')");
    fakeLuma({ events: [event("evt-1", days(1))], guests: { "evt-1": [guest(1), guest(2)] }, contacts: [contact(1)] });
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ guestsChanged: 1, people: 1, contacts: 0 });
    expect((await query("SELECT user_id FROM luma_people")).map((p) => p.user_id)).toEqual(["usr-2"]);
  });

  it("reads our events' hosts when due: never read, or still to come and not read in the last hour; still to come first, then never read, newest first, failed last", async () => {
    const luma = fakeLuma({
      events: [
        event("evt-soon", days(1)),
        event("evt-later", days(5)),
        event("evt-recent", days(3)),
        event("evt-past-read", days(-30)),
        event("evt-past-new", days(-20)),
        event("evt-past-old", days(-90)),
        event("evt-gone", days(4)),
        event("evt-failed", days(2)),
        event("evt-view", days(1), { access: "view" }),
      ],
      failHosts: ["evt-failed"],
    });
    await importLuma("jo@pauseai.uk");
    expect(await query("SELECT hosts_error FROM luma_events WHERE id = 'evt-failed'")).toEqual([
      { hosts_error: "Luma answered 500 for /v1/events/get" },
    ]);
    const hostsRead = (interval: string | null, ids: string[]) =>
      query(
        `UPDATE luma_events SET hosts_synced_at = CASE WHEN $1::text IS NULL THEN NULL ELSE now() - $1::interval END
         WHERE id = ANY($2)`,
        [interval, ids],
      );
    await hostsRead("2 hours", ["evt-soon", "evt-later", "evt-past-read", "evt-gone"]);
    await hostsRead("30 minutes", ["evt-recent"]);
    await hostsRead(null, ["evt-past-new", "evt-past-old"]);
    // Taken off the calendar.
    luma.events = luma.events.filter((e) => e.id !== "evt-gone");
    await query("UPDATE luma_events SET removed_at = now() WHERE id = 'evt-gone'");
    luma.requests.length = 0;
    luma.failHosts = [];
    await importLuma("jo@pauseai.uk");
    expect(luma.requests.filter((r) => r.startsWith("hosts:"))).toEqual([
      "hosts:evt-later",
      "hosts:evt-soon",
      "hosts:evt-past-new",
      "hosts:evt-past-old",
      "hosts:evt-failed",
    ]);
    expect(await query("SELECT hosts_error FROM luma_events WHERE id = 'evt-failed'")).toEqual([{ hosts_error: null }]);
  });

  it("adds an event's hosts as people, dated from the second read on, takes off those no longer listed, and never brings back an erased one", async () => {
    await query("INSERT INTO luma_erased (user_id) VALUES ('usr-9'), ('usr-8')");
    // Erased, yet still a person here: never a host either.
    await query("INSERT INTO luma_people (user_id, email) VALUES ('usr-8', 'person8@example.com')");
    const host = (n: number, name: string | null = `Person ${n}`) => ({
      id: `usr-${n}`,
      email: ` Person${n}@Example.com `,
      name,
    });
    const luma = fakeLuma({
      events: [event("evt-1", days(1))],
      guests: { "evt-1": [guest(1)] },
      hosts: { "evt-1": [host(1), host(2, null), host(9), host(8), host(2, null)] },
    });
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ hostsChanged: 2, people: 2 });
    const hosts = () =>
      query("SELECT event_id, user_id, added_at IS NOT NULL AS dated FROM luma_event_hosts ORDER BY user_id");
    // The first read's hosts may have been there since the event was made: no date of their own.
    expect(await hosts()).toEqual([
      { event_id: "evt-1", user_id: "usr-1", dated: false },
      { event_id: "evt-1", user_id: "usr-2", dated: false },
    ]);
    expect(await query("SELECT user_id, email, name FROM luma_people ORDER BY user_id")).toEqual([
      { user_id: "usr-1", email: "person1@example.com", name: "Person 1" },
      { user_id: "usr-2", email: "person2@example.com", name: "" },
      { user_id: "usr-8", email: "person8@example.com", name: "" },
    ]);
    expect(await query("SELECT hosts_synced_at IS NOT NULL AS read FROM luma_events")).toEqual([{ read: true }]);

    // Two hours on: one host gone, another named, and one new.
    luma.hosts["evt-1"] = [host(2), host(3)];
    await query("UPDATE luma_events SET hosts_synced_at = now() - interval '2 hours'");
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ hostsChanged: 2, people: 2 });
    // The new one is dated by this read; the one kept keeps none.
    expect(await hosts()).toEqual([
      { event_id: "evt-1", user_id: "usr-2", dated: false },
      { event_id: "evt-1", user_id: "usr-3", dated: true },
    ]);

    // The same again changes nothing.
    await query("UPDATE luma_events SET hosts_synced_at = now() - interval '2 hours'");
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ hostsChanged: 0, people: 0 });
  });

  it("stops reading hosts when Luma's rate limit is reached, leaving the rest for the next run", async () => {
    const luma = fakeLuma({ events: [event("evt-1", days(1)), event("evt-2", days(2))], rateLimitHosts: ["evt-2"] });
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ hostsChanged: 0, stoppedBy: "rate-limit" });
    expect(luma.requests.filter((r) => r.startsWith("hosts:"))).toEqual(["hosts:evt-2"]);
    expect(await query("SELECT count(*)::int AS n FROM luma_events WHERE hosts_synced_at IS NULL")).toEqual([{ n: 2 }]);
  });

  it("copies when each event was made on Luma, and counts a change to it as a change to the event", async () => {
    const luma = fakeLuma({ events: [event("evt-1", days(1))] });
    await importLuma("jo@pauseai.uk");
    expect(await query("SELECT created_at FROM luma_events")).toEqual([{ created_at: null }]);
    luma.events[0] = event("evt-1", days(1), { created_at: "2026-09-01T10:00:00.000Z" });
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ events: 1 });
    expect(await query("SELECT created_at FROM luma_events")).toEqual([
      { created_at: new Date("2026-09-01T10:00:00.000Z") },
    ]);
  });

  it("stops choosing work when Luma's rate limit is near, or reached, or its time is up, and says so", async () => {
    const luma = fakeLuma({ events: [event("evt-1", days(1)), event("evt-2", days(2))], remaining: 10 });
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({
      events: 2,
      eventsSynced: 0,
      eventsLeft: 2,
      requests: 1,
      stoppedBy: "rate-limit",
    });
    expect((await runs()).at(-1)).toMatchObject({ status: "ok", result: { stoppedBy: "rate-limit" } });

    luma.remaining = undefined;
    luma.rateLimitGuests = ["evt-2"];
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({
      eventsSynced: 0,
      eventsLeft: 2,
      requests: 2,
      stoppedBy: "rate-limit",
    });

    luma.rateLimitGuests = [];
    expect(await importLuma("jo@pauseai.uk", 0)).toEqual({
      events: 0,
      eventsSynced: 0,
      eventsLeft: 2,
      guestsChanged: 0,
      hostsChanged: 0,
      people: 0,
      contacts: 0,
      // A pass over the contacts begins, and none of it read.
      contactPages: 0,
      eventsTagged: 0,
      supportersAdded: 0,
      linked: 0,
      places: { postcodes: 0, towns: 0, failed: false },
      requests: 0,
      stoppedBy: "time",
    });
    expect((await runs()).at(-1)).toMatchObject({ status: "unchanged" });
  });

  it("gives new events their owners by the rules, and emails each owner once the run is kept", async () => {
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "server-token");
    const sent: { To: string; Subject: string }[] = [];
    server.use(
      http.post("https://api.postmarkapp.com/email", async ({ request }) => {
        sent.push((await request.json()) as { To: string; Subject: string });
        return HttpResponse.json({ ErrorCode: 0, MessageID: "m-1" });
      }),
    );
    for (const email of ["joseph@pauseai.uk", "sean@pauseai.uk"]) {
      await query("INSERT INTO staff_accounts (email, added_by) VALUES ($1, 'admin@pauseai.uk')", [email]);
    }
    fakeLuma({
      events: [
        event("evt-london", days(3)),
        event("evt-oxford", days(4), { geo_address_json: { city: "Oxford", address: "Somewhere" } }),
      ],
    });
    await importLuma("jo@pauseai.uk");
    expect(await query("SELECT event_id, owner FROM event_owners ORDER BY event_id")).toEqual([
      { event_id: "evt-london", owner: "joseph@pauseai.uk" },
      { event_id: "evt-oxford", owner: "sean@pauseai.uk" },
    ]);
    expect(sent.map((email) => email.To)).toEqual(["joseph@pauseai.uk", "sean@pauseai.uk"]);
  });

  it("copies each event, guest and contact once when runs overlap", async () => {
    fakeLuma({
      events: [event("evt-1", days(1)), event("evt-2", days(2))],
      guests: { "evt-1": [guest(1), guest(2)], "evt-2": [guest(2, { id: "gst-22" }), guest(3)] },
      contacts: [contact(1), contact(4)],
    });
    // The run that goes waits at Luma until the other two have been turned away.
    const { held, start } = heldAtOnce(
      () => runJob("import-luma", "nightly", undefined),
      (run) => run === ANOTHER_RUNNING,
    );
    server.use(
      http.get(`${API}/calendars/events/list`, async () => {
        await held;
      }),
    );
    const results = allResults(await start());
    // One run copied each once: those started while it was going didn't go.
    expect(results.filter((result) => result === ANOTHER_RUNNING)).toHaveLength(2);
    expect(results.find((result) => result !== ANOTHER_RUNNING)).toMatchObject({
      events: 2,
      guestsChanged: 4,
      contacts: 2,
      supportersAdded: 4,
    });
    expect((await guestRows()).map((row) => row.id)).toEqual(["gst-1", "gst-2", "gst-22", "gst-3"]);
    expect(await query("SELECT count(*)::int AS supporters FROM supporters")).toEqual([{ supporters: 4 }]);
    expect(await runs()).toHaveLength(1);
  });

  it("doesn't go, keeping nothing, while a staff member's run is going", async () => {
    const luma = fakeLuma({ events: [event("evt-1", days(1))] });
    await startRunning("import-luma", "jo@pauseai.uk");
    expect(await runJob("import-luma", "nightly", undefined)).toBe(ANOTHER_RUNNING);
    expect(luma.requests).toEqual([]);
    expect(await runs()).toEqual([]);
  });

  it("fails the run, keeping nothing, when Luma won't list the events", async () => {
    fakeLuma({ events: [event("evt-1", days(1))], failEvents: true });
    await expect(importLuma("jo@pauseai.uk")).rejects.toThrow("Luma answered 500");
    expect(await eventRows()).toEqual([]);
    expect(await runs()).toMatchObject([
      { status: "failed", error: "Luma answered 500 for /v1/calendars/events/list" },
    ]);
  });

  it("reads every contact, ten pages a run, one pass after another, and the newest first while a pass is going", async () => {
    const contacts = Array.from({ length: 12 }, (_, i) => contact(i + 1));
    const luma = fakeLuma({ contacts, pageSize: 1 });
    const contactRequests = () => luma.requests.filter((r) => r.startsWith("contacts"));
    // A contact from an earlier import that Luma no longer lists: only a finished pass says they've gone.
    await query(
      "INSERT INTO luma_people (user_id, email, contact_since) VALUES ('usr-99', 'person99@example.com', now())",
    );

    // The first run starts the first pass: ten pages, and the cursor kept.
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ contacts: 10, contactPages: 10 });
    expect(contactRequests()).toHaveLength(10);
    expect(await query("SELECT cursor, full_pass_at FROM luma_import_state WHERE list = 'contacts'")).toEqual([
      { cursor: "10", full_pass_at: null },
    ]);
    expect(await optOuts()).toEqual([]);

    // The next reads the newest page, nothing new on it, then finishes the pass: two contacts more,
    // and the one it never listed opted out.
    luma.requests.length = 0;
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ contacts: 3, contactPages: 3 });
    expect(await optOuts()).toMatchObject([{ address: "person99@example.com", resubscribed_at: null }]);
    expect(contactRequests()).toEqual(["contacts", "contacts@10", "contacts@11"]);
    const [state] = await query<{ cursor: string; full_pass_at: Date | null }>(
      "SELECT cursor, full_pass_at FROM luma_import_state WHERE list = 'contacts'",
    );
    expect(state.cursor).toBe("");
    expect(state.full_pass_at).not.toBeNull();

    // The run after starts the next pass at once.
    luma.requests.length = 0;
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ contacts: 0, contactPages: 10 });
    expect(contactRequests()[0]).toBe("contacts");

    // A new contact at the top is read before the pass carries on, and the newest stop at a page with nothing new.
    luma.contacts.unshift(contact(13));
    luma.requests.length = 0;
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ contacts: 1, contactPages: 5 });
    expect(contactRequests()).toEqual(["contacts", "contacts@1", "contacts@10", "contacts@11", "contacts@12"]);

    // The newest every page new are read to the end of the list, then the pass from its cursor.
    luma.contacts = [contact(14), contact(15)];
    await query("UPDATE luma_import_state SET cursor = '1' WHERE list = 'contacts'");
    luma.requests.length = 0;
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ contacts: 2, contactPages: 3 });
    expect(contactRequests()).toEqual(["contacts", "contacts@1", "contacts@1"]);
  });

  it("reads no more than ten pages of the newest while a pass is going", async () => {
    const luma = fakeLuma({ contacts: Array.from({ length: 12 }, (_, i) => contact(i + 1)), pageSize: 1 });
    await query("INSERT INTO luma_import_state (list, cursor, pass_started_at) VALUES ('contacts', '5', now())");
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ contacts: 10, contactPages: 10 });
    expect(luma.requests.filter((r) => r.startsWith("contacts"))).toHaveLength(10);
    expect(await query("SELECT cursor FROM luma_import_state WHERE list = 'contacts'")).toEqual([{ cursor: "5" }]);
  });

  it("keeps a pass's cursor when the run runs out before reading the newest", async () => {
    // Luma's rate limit is near after the events' page, so no contacts are read.
    const luma = fakeLuma({ contacts: [contact(1), contact(2)], pageSize: 1, remaining: 10 });
    await query("INSERT INTO luma_import_state (list, cursor, pass_started_at) VALUES ('contacts', '1', now())");
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ contactPages: 0, stoppedBy: "rate-limit" });
    expect(luma.requests.filter((r) => r.startsWith("contacts"))).toEqual([]);
    expect(await query("SELECT cursor FROM luma_import_state WHERE list = 'contacts'")).toEqual([{ cursor: "1" }]);
  });

  it("doesn't count a full pass of the contacts as done when the run ran out before reading any", async () => {
    // Luma's rate limit is near after the events' page, so the contacts aren't read.
    const luma = fakeLuma({ contacts: [contact(1), contact(2)], pageSize: 1, remaining: 10 });
    expect((await importLuma("jo@pauseai.uk")).stoppedBy).toBe("rate-limit");
    expect(await query("SELECT cursor, full_pass_at FROM luma_import_state WHERE list = 'contacts'")).toEqual([
      { cursor: "", full_pass_at: null },
    ]);
    // The next run, with room, reads the whole pass.
    luma.remaining = undefined;
    luma.requests.length = 0;
    expect((await importLuma("jo@pauseai.uk")).contacts).toBe(2);
    expect(luma.requests.filter((r) => r.startsWith("contacts"))).toEqual(["contacts", "contacts@1"]);
  });

  it("drops a contacts cursor Luma no longer honours, failing that run, and starts the pass again on the next", async () => {
    const luma = fakeLuma({ contacts: [contact(1), contact(2)], pageSize: 1, failContactsCursor: "stale" });
    await query("INSERT INTO luma_import_state (list, cursor) VALUES ('contacts', 'stale')");
    await expect(importLuma("jo@pauseai.uk")).rejects.toThrow("Luma answered 500");
    expect(await query("SELECT cursor FROM luma_import_state WHERE list = 'contacts'")).toEqual([{ cursor: "" }]);
    // The newest contacts it read before the cursor failed are kept.
    const contactsKept = () =>
      query("SELECT user_id FROM luma_people WHERE contact_since IS NOT NULL ORDER BY user_id");
    expect(await contactsKept()).toEqual([{ user_id: "usr-1" }, { user_id: "usr-2" }]);
    luma.requests.length = 0;
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ contacts: 0, contactPages: 2 });
    expect(luma.requests).toEqual(["events", "contacts", "contacts@1"]);

    // Reading the newest, ahead of the pass, a failure is just a failure: the pass's cursor is kept.
    await query("UPDATE luma_import_state SET cursor = '2' WHERE list = 'contacts'");
    luma.contacts.unshift(contact(3));
    luma.failContactsCursor = "1";
    await expect(importLuma("jo@pauseai.uk")).rejects.toThrow("Luma answered 500");
    expect(await query("SELECT cursor FROM luma_import_state WHERE list = 'contacts'")).toEqual([{ cursor: "2" }]);
  });
  it("opts out a contact a full pass doesn't list, once, and ends that when a later pass lists them again", async () => {
    const luma = fakeLuma({ contacts: [contact(1), contact(2), contact(3)] });
    // Someone who only registered for an event was never a contact, so can't leave.
    await query("INSERT INTO luma_people (user_id, email) VALUES ('usr-9', 'person9@example.com')");
    expect((await importLuma("jo@pauseai.uk")).contacts).toBe(3);
    expect(await optOuts()).toEqual([]);

    // Person 2 unsubscribes: Luma stops listing them, and the next pass opts them out.
    luma.contacts = [contact(1), contact(3)];
    expect((await importLuma("jo@pauseai.uk")).contacts).toBe(1);
    expect(await optOuts()).toEqual([
      { address: "person2@example.com", source: "luma-contacts", resubscribed_at: null },
    ]);
    // The pass after changes nothing: they're opted out already.
    expect((await importLuma("jo@pauseai.uk")).contacts).toBe(0);
    expect(await optOuts()).toHaveLength(1);

    // They follow again: Luma lists them as before, and the next pass ends the opt-out.
    luma.contacts = [contact(1), contact(2), contact(3)];
    expect((await importLuma("jo@pauseai.uk")).contacts).toBe(1);
    const [back] = await optOuts();
    expect(back.resubscribed_at).not.toBeNull();
  });

  it("keeps an opt-out begun after the pass listed the address, and one for an address another contact still has", async () => {
    const luma = fakeLuma({ contacts: [contact(1), contact(2)] });
    await importLuma("jo@pauseai.uk");
    // Person 1 unsubscribes after this pass reads their page; Luma's webhook says so.
    await query(
      `INSERT INTO opt_outs (address, list, source, source_ref, unsubscribed_at)
       VALUES ('person1@example.com', 'events', 'luma-webhook', 'msg_1', now() + interval '1 minute')`,
    );
    // A second Luma account with person 2's address, no longer listed, while the first still is.
    await query(
      "INSERT INTO luma_people (user_id, email, contact_since) VALUES ('usr-20', 'person2@example.com', now())",
    );
    luma.contacts = [contact(1), contact(2)];
    expect((await importLuma("jo@pauseai.uk")).contacts).toBe(0);
    expect(await optOuts()).toEqual([
      { address: "person1@example.com", source: "luma-webhook", resubscribed_at: null },
    ]);
  });

  it("keeps an opt-out from our own pages though a pass still lists the address, and tries again to take it off the calendar", async () => {
    const luma = fakeLuma({ contacts: [contact(1), contact(2)] });
    await importLuma("jo@pauseai.uk");
    // Person 2 turned events off on the contact preferences page, and Luma failed to take them off.
    await query(
      `INSERT INTO opt_outs (address, list, source, source_ref, unsubscribed_at)
       VALUES ('person2@example.com', 'events', 'preferences', 'p', now() - interval '1 minute')`,
    );
    const removed: unknown[] = [];
    server.use(
      http.post(`${API}/calendars/contacts/remove`, async ({ request }) => {
        removed.push(await request.json());
        return HttpResponse.json({});
      }),
    );
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    luma.contacts = [contact(1), contact(2)];
    await importLuma("jo@pauseai.uk");
    expect(await optOuts()).toEqual([{ address: "person2@example.com", source: "preferences", resubscribed_at: null }]);
    expect(removed).toEqual([{ email: "person2@example.com" }]);
  });

  it("finishes a pass whose start wasn't noted without opting anyone out", async () => {
    fakeLuma({ contacts: [contact(1), contact(2)], pageSize: 1 });
    await query("INSERT INTO luma_import_state (list, cursor) VALUES ('contacts', '1')");
    await query(
      "INSERT INTO luma_people (user_id, email, contact_since) VALUES ('usr-5', 'person5@example.com', now())",
    );
    // The newest first, both new, then the pass's last page.
    expect(await importLuma("jo@pauseai.uk")).toMatchObject({ contacts: 2, contactPages: 3 });
    expect(await optOuts()).toEqual([]);
  });
});
