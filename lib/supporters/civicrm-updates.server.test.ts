import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { query } from "@/lib/server/db.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import {
  civicrmChange,
  civicrmResubscribe,
  queueBulkLift,
  queueResubscribe,
  sendCivicrmUpdates,
} from "./civicrm-updates.server";
import { recordOptOut, STOP_ALL, type OptOut } from "@/lib/supporters/opt-outs.server";
import { inRun } from "@/lib/server/run-store.server";
import { supportersCopy } from "./copy";

const UPDATE = "https://crm.pauseai.info/civicrm/ajax/api4/PauseaiChapterContact/updateSubscriptions";
const AT = new Date("2026-11-01T09:00:00Z");
const JO = "jo@pauseai.uk";

type Event = Record<string, unknown>;

/** CiviCRM's updateSubscriptions answering each event as `answer` says; every call's events. */
function serve(
  answer: (event: Event) => Event | undefined = (event) => ({ event_id: event.event_id, status: "accepted" }),
) {
  const calls: Event[][] = [];
  server.use(
    http.post(UPDATE, async ({ request }) => {
      const { events } = JSON.parse(new URLSearchParams(await request.text()).get("params")!) as { events: Event[] };
      calls.push(events);
      return HttpResponse.json({ values: events.map(answer).filter(Boolean) });
    }),
  );
  return calls;
}

const optOut = (fields: Partial<OptOut> = {}): OptOut => ({
  address: "Jane@Example.com",
  list: "newsletter",
  source: "link",
  sourceRef: "ref-1",
  unsubscribedAt: AT,
  ...fields,
});

/** Each update as kept, oldest first. */
const updates = () =>
  query<Event>(
    `SELECT change, list, email, contact_id::int AS "contactId", source, wording, tries, status, reason,
       answered_at IS NOT NULL AS answered FROM civicrm_updates ORDER BY id`,
  );

/** Contacts with `emails`, on both of CiviCRM's lists in the last pull, numbered from 1000. */
async function onLists(...emails: string[]) {
  for (const [n, email] of emails.entries()) {
    await query(
      `INSERT INTO civicrm_contacts (contact_id, email, on_hold, no_bulk_email, do_not_email, do_not_phone, do_not_sms,
         newsletter, volunteer_updates, on_hold_since, no_bulk_email_since, do_not_email_since, do_not_phone_since,
         do_not_sms_since, newsletter_since, volunteer_updates_since)
       VALUES ($1, $2, false, false, false, false, false, 'subscribed', 'subscribed',
         now(), now(), now(), now(), now(), now(), now())`,
      [1000 + n, email],
    );
  }
}

it("sends only the opt-outs CiviCRM takes: the newsletter or volunteering by email, or every bulk email", () => {
  expect(civicrmChange("newsletter", "email")).toEqual({ change: "unsubscribe", list: "newsletter" });
  expect(civicrmChange("volunteering", "email")).toEqual({ change: "unsubscribe", list: "volunteer_updates" });
  expect(civicrmChange("bulk", "email")).toEqual({ change: "no_bulk_email" });
  expect(civicrmChange("events", "email")).toBeUndefined();
  expect(civicrmChange("all", "email")).toBeUndefined();
  expect(civicrmChange("newsletter", "text")).toBeUndefined();
});

it("sends a yes from the page as a resubscribe to the list its opt-out unsubscribes from, if CiviCRM has one", () => {
  expect(civicrmResubscribe("newsletter", "email")).toEqual({ change: "resubscribe", list: "newsletter" });
  expect(civicrmResubscribe("volunteering", "email")).toEqual({ change: "resubscribe", list: "volunteer_updates" });
  expect(civicrmResubscribe("bulk", "email")).toBeUndefined();
  expect(civicrmResubscribe("events", "email")).toBeUndefined();
  expect(civicrmResubscribe("newsletter", "text")).toBeUndefined();
});

describeWithDatabase("our opt-outs sent to CiviCRM", () => {
  useTestDatabase();

  it("queues an opt-out of ours with the opt-out, with the contact ID of the address's contact", async () => {
    await query(
      `INSERT INTO civicrm_contacts (contact_id, email, on_hold, no_bulk_email, do_not_email, do_not_phone, do_not_sms,
         newsletter, volunteer_updates, on_hold_since, no_bulk_email_since, do_not_email_since, do_not_phone_since,
         do_not_sms_since, newsletter_since, volunteer_updates_since)
       VALUES (77, 'jane@example.com', false, false, false, false, false, 'subscribed', 'not_on_list',
         now(), now(), now(), now(), now(), now(), now())`,
    );
    await recordOptOut(optOut());
    await recordOptOut(optOut({ address: "sam@example.com", list: "bulk", source: "postmark-complaint" }));
    // Sent with the contact's ID, for the address CiviCRM has.
    const calls = serve();
    await sendCivicrmUpdates("key");
    expect(calls[0][0]).toMatchObject({ email: "jane@example.com", contact_id: 77 });
    await query("UPDATE civicrm_updates SET tries = 0, tried_at = NULL, status = NULL, answered_at = NULL");
    expect(await updates()).toEqual([
      {
        change: "unsubscribe",
        list: "newsletter",
        email: "jane@example.com",
        contactId: 77,
        source: "pauseai.uk:link",
        wording: null,
        tries: 0,
        status: null,
        reason: null,
        answered: false,
      },
      expect.objectContaining({ change: "no_bulk_email", list: null, email: "sam@example.com", contactId: null }),
    ]);
  });

  it("queues nothing for an opt-out CiviCRM doesn't take, or told us of", async () => {
    await recordOptOut(optOut({ list: "events" }));
    await recordOptOut(optOut({ source: "civicrm", sourceRef: "2" }));
    await recordOptOut(optOut({ address: "sam@example.com", list: "all", source: "civicrm-check", sourceRef: "3" }));
    await recordOptOut(optOut({ address: "+447700900123", way: "text", sourceRef: "4" }));
    expect(await updates()).toEqual([]);
  });

  it("queues an unsubscribe only from a list the last pull has the address on, and every bulk email always", async () => {
    await query(
      `INSERT INTO civicrm_contacts (contact_id, email, on_hold, no_bulk_email, do_not_email, do_not_phone, do_not_sms,
         newsletter, volunteer_updates, on_hold_since, no_bulk_email_since, do_not_email_since, do_not_phone_since,
         do_not_sms_since, newsletter_since, volunteer_updates_since, gone_at)
       VALUES (1, 'jane@example.com', false, false, false, false, false, 'not_opted_in', 'unsubscribed',
         now(), now(), now(), now(), now(), now(), now(), NULL),
         (2, 'jane@example.com', false, false, false, false, false, 'subscribed', 'not_on_list',
         now(), now(), now(), now(), now(), now(), now(), now())`,
    );
    // Contact 2, the only one on the newsletter, is gone; nobody has sam@.
    expect(await recordOptOut(optOut())).toBe(true);
    expect(await recordOptOut(optOut({ list: "volunteering", sourceRef: "ref-2" }))).toBe(true);
    expect(await recordOptOut(optOut({ address: "sam@example.com", sourceRef: "ref-3" }))).toBe(true);
    expect(await recordOptOut(optOut({ list: "bulk", sourceRef: "ref-4" }))).toBe(true);
    expect(await updates()).toEqual([expect.objectContaining({ change: "no_bulk_email", email: "jane@example.com" })]);
  });

  it("sends what's waiting, oldest first, and keeps each result; one answered isn't sent again", async () => {
    const calls = serve();
    await onLists("jane@example.com");
    await recordOptOut(optOut());
    await recordOptOut(optOut({ list: "volunteering", sourceRef: "ref-2" }));
    const [{ id }] = await query<{ id: number }>(
      `INSERT INTO preference_choices (address, way, topic, wording) VALUES ('jane@example.com', 'email', 'bulk', 'Email me again')
       RETURNING id::int AS id`,
    );
    await queueBulkLift({ id, address: "jane@example.com", at: AT, wording: "Email me again" });
    expect(await sendCivicrmUpdates("key")).toEqual({ sent: 3, refused: 0, unanswered: 0 });
    expect(calls).toEqual([
      [
        expect.objectContaining({ event_id: expect.stringMatching(/^opt-out:\d+$/), change: "unsubscribe" }),
        expect.objectContaining({ list: "volunteer_updates", occurred_at: AT.toISOString() }),
        {
          event_id: `lift:${id}`,
          email: "jane@example.com",
          change: "allow_bulk_email",
          occurred_at: AT.toISOString(),
          source: "pauseai.uk:preferences",
          wording: "Email me again",
        },
      ],
    ]);
    expect(await updates()).toEqual(
      Array(3).fill(expect.objectContaining({ tries: 1, status: "accepted", answered: true })),
    );
    expect(await sendCivicrmUpdates("key")).toEqual({ sent: 0, refused: 0, unanswered: 0 });
    expect(calls).toHaveLength(1);
  });

  it("sends a resubscribe with the box's words, and keeps a refused one without marking the yes", async () => {
    const calls = serve((event) => ({ event_id: event.event_id, status: "refused", reason: "not_opted_in" }));
    const [{ id }] = await query<{ id: number }>(
      `INSERT INTO preference_choices (address, way, topic, wording) VALUES ('jane@example.com', 'email', 'newsletter', 'News')
       RETURNING id::int AS id`,
    );
    const choice = { id, address: "jane@example.com", way: "email", at: AT, wording: "News" };
    expect(await queueResubscribe({ ...choice, topic: "events" })).toBe(false);
    expect(await queueResubscribe({ ...choice, topic: "newsletter" })).toBe(true);
    expect(await sendCivicrmUpdates("key")).toEqual({ sent: 0, refused: 1, unanswered: 0 });
    expect(calls[0]).toEqual([
      {
        event_id: `lift:${id}`,
        email: "jane@example.com",
        change: "resubscribe",
        list: "newsletter",
        occurred_at: AT.toISOString(),
        source: "pauseai.uk:preferences",
        wording: "News",
      },
    ]);
    expect(await updates()).toEqual([expect.objectContaining({ status: "refused", reason: "not_opted_in" })]);
    expect(await query("SELECT refused_at FROM preference_choices")).toEqual([{ refused_at: null }]);
  });

  it("keeps the list as an accepted change made it, from when the person made it, for the pull to find", async () => {
    serve();
    const contact = (id: number, email: string, volunteering: string) =>
      query(
        `INSERT INTO civicrm_contacts (contact_id, email, newsletter, newsletter_since, volunteer_updates,
           volunteer_updates_since, on_hold, on_hold_since, no_bulk_email, no_bulk_email_since, do_not_email,
           do_not_email_since, do_not_phone, do_not_phone_since, do_not_sms, do_not_sms_since)
         VALUES ($1, $2, 'subscribed', now(), $3, now(), false, now(), false, now(), false, now(), false, now(),
           false, now())`,
        [id, email, volunteering],
      );
    await contact(1, "jane@example.com", "subscribed");
    await contact(2, "jane@example.com", "unsubscribed");
    await contact(3, "sam@example.com", "subscribed");
    await recordOptOut(optOut({ list: "volunteering" }));
    await sendCivicrmUpdates("key");
    const lists = () =>
      query(
        `SELECT contact_id::int AS id, newsletter, volunteer_updates AS volunteering,
           volunteer_updates_since = $1 AS "fromThen" FROM civicrm_contacts ORDER BY contact_id`,
        [AT],
      );
    // Contact 2 was unsubscribed already, so it keeps when that was.
    expect(await lists()).toEqual([
      { id: 1, newsletter: "subscribed", volunteering: "unsubscribed", fromThen: true },
      { id: 2, newsletter: "subscribed", volunteering: "unsubscribed", fromThen: false },
      { id: 3, newsletter: "subscribed", volunteering: "subscribed", fromThen: false },
    ]);
    const [{ id }] = await query<{ id: number }>(
      `INSERT INTO preference_choices (address, way, topic, wording) VALUES ('jane@example.com', 'email', 'volunteering', 'Help')
       RETURNING id::int AS id`,
    );
    await queueResubscribe({
      id,
      address: "jane@example.com",
      topic: "volunteering",
      way: "email",
      at: AT,
      wording: "Help",
    });
    await sendCivicrmUpdates("key");
    expect(await lists()).toEqual([
      { id: 1, newsletter: "subscribed", volunteering: "subscribed", fromThen: true },
      { id: 2, newsletter: "subscribed", volunteering: "subscribed", fromThen: true },
      { id: 3, newsletter: "subscribed", volunteering: "subscribed", fromThen: false },
    ]);
  });

  it("marks a lift CiviCRM refused, so its newer “No bulk emails” still stands", async () => {
    serve((event) => ({ event_id: event.event_id, status: "refused", reason: "newer_no_bulk_email" }));
    const [{ id }] = await query<{ id: number }>(
      `INSERT INTO preference_choices (address, way, topic, wording) VALUES ('jane@example.com', 'email', 'bulk', 'Again')
       RETURNING id::int AS id`,
    );
    await queueBulkLift({ id, address: "jane@example.com", at: AT, wording: "Again" });
    expect(await sendCivicrmUpdates("key")).toEqual({ sent: 0, refused: 1, unanswered: 0 });
    expect(await updates()).toEqual([expect.objectContaining({ status: "refused", reason: "newer_no_bulk_email" })]);
    expect(await query("SELECT refused_at IS NOT NULL AS refused FROM preference_choices")).toEqual([
      { refused: true },
    ]);
  });

  it("tries again next time one CiviCRM left unanswered, and reports one it found wrong", async () => {
    serve((event) =>
      String(event.email).startsWith("wrong")
        ? { event_id: event.event_id, status: "invalid", error: "unknown list" }
        : undefined,
    );
    await onLists("jane@example.com", "wrong@example.com");
    await recordOptOut(optOut());
    await recordOptOut(optOut({ address: "wrong@example.com", sourceRef: "ref-2" }));
    const { counts, problems } = await inRun(async (run) => ({
      counts: await sendCivicrmUpdates("key"),
      problems: run.problems,
    }));
    expect(counts).toEqual({ sent: 0, refused: 0, unanswered: 2 });
    expect(problems).toEqual([
      { what: supportersCopy.problems.civicrmUpdatesUnanswered(1) },
      {
        what: supportersCopy.problems.civicrmUpdatesInvalid(1),
        error: expect.stringMatching(/^opt-out:\d+: unknown list$/),
      },
    ]);
    expect(await updates()).toEqual([
      expect.objectContaining({ tries: 1, status: null }),
      expect.objectContaining({ tries: 1, status: "invalid", reason: "unknown list" }),
    ]);
  });

  it("sends a hundred at a time, and stops when CiviCRM fails, leaving the rest to try again", async () => {
    let calls = 0;
    server.use(
      http.post(UPDATE, async ({ request }) => {
        calls++;
        if (calls > 1) return new HttpResponse("Down", { status: 503 });
        const { events } = JSON.parse(new URLSearchParams(await request.text()).get("params")!) as {
          events: Event[];
        };
        expect(events).toHaveLength(100);
        return HttpResponse.json({ values: events.map((event) => ({ event_id: event.event_id, status: "accepted" })) });
      }),
    );
    await onLists(...Array.from({ length: 150 }, (_, n) => `p${n}@example.com`));
    for (let n = 0; n < 150; n++) await recordOptOut(optOut({ address: `p${n}@example.com`, sourceRef: `r${n}` }));
    const { counts, problems } = await inRun(async (run) => ({
      counts: await sendCivicrmUpdates("key"),
      problems: run.problems,
    }));
    expect(counts).toEqual({ sent: 100, refused: 0, unanswered: 50 });
    expect(problems).toEqual([
      { what: supportersCopy.problems.civicrmUpdatesFailed, error: "CiviCRM request failed with status 503: Down" },
    ]);
    expect(await query("SELECT count(*)::int AS n FROM civicrm_updates WHERE status IS NULL AND tries = 0")).toEqual([
      { n: 50 },
    ]);
  });
});

describeWithDatabase("our stops of a number, kept from CiviCRM", () => {
  useTestDatabase();

  it("sends nothing for a stop of texts or calls: by topic, by WhatsApp, or by Stop everything", async () => {
    const stop = (fields: Partial<OptOut>) => recordOptOut(optOut({ address: "+447700900001", ...fields }));
    for (const list of ["events", "newsletter", "volunteering"] as const) {
      await stop({ list, way: "text", source: "staff", sourceRef: list, recordedBy: JO, how: "Told us" });
    }
    await stop({ list: "all", way: "text", source: "whatsapp", sourceRef: "setting all" });
    for (const way of ["text", "call"] as const) {
      await stop({ list: "all", way, source: "preferences", sourceRef: `${STOP_ALL} group-1 ${way}` });
    }
    expect(await query("SELECT 1 FROM civicrm_updates")).toEqual([]);
  });

  it("never sends a number's Do not SMS or Do not phone left waiting", async () => {
    const [{ id }] = await query<{ id: number }>(
      `INSERT INTO opt_outs (address, list, way, source, source_ref, unsubscribed_at)
       VALUES ('+447700900001', 'all', 'text', 'whatsapp', 'setting all', now()) RETURNING id::int AS id`,
    );
    await query(
      `INSERT INTO civicrm_updates (opt_out_id, change, phone, occurred_at, source)
       VALUES ($1, 'do_not_sms', '+447700900001', now(), 'pauseai.uk:whatsapp')`,
      [id],
    );
    const calls = serve();
    expect(await sendCivicrmUpdates("key")).toEqual({ sent: 0, refused: 0, unanswered: 0 });
    expect(calls).toEqual([]);
  });
});
