import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { staffCopy } from "@/lib/content/staff-interface";
import { query } from "@/lib/server/db";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { civicrmChange, queueBulkLift, sendCivicrmUpdates } from "./civicrm-updates";
import { recordOptOut, type OptOut } from "./opt-outs";
import { inRun } from "./run-store";

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

it("sends only the opt-outs CiviCRM takes: the newsletter or volunteering by email, or every bulk email", () => {
  expect(civicrmChange("newsletter", "email")).toEqual({ change: "unsubscribe", list: "newsletter" });
  expect(civicrmChange("volunteering", "email")).toEqual({ change: "unsubscribe", list: "volunteer_updates" });
  expect(civicrmChange("bulk", "email")).toEqual({ change: "no_bulk_email" });
  expect(civicrmChange("events", "email")).toBeUndefined();
  expect(civicrmChange("all", "email")).toBeUndefined();
  expect(civicrmChange("newsletter", "text")).toBeUndefined();
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

  it("sends what's waiting, oldest first, and keeps each result; one answered isn't sent again", async () => {
    const calls = serve();
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
    expect(calls[0][0]).not.toHaveProperty("contact_id");
    expect(await updates()).toEqual(
      Array(3).fill(expect.objectContaining({ tries: 1, status: "accepted", answered: true })),
    );
    expect(await sendCivicrmUpdates("key")).toEqual({ sent: 0, refused: 0, unanswered: 0 });
    expect(calls).toHaveLength(1);
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
    await recordOptOut(optOut());
    await recordOptOut(optOut({ address: "wrong@example.com", sourceRef: "ref-2" }));
    const { counts, problems } = await inRun(async (run) => ({
      counts: await sendCivicrmUpdates("key"),
      problems: run.problems,
    }));
    expect(counts).toEqual({ sent: 0, refused: 0, unanswered: 2 });
    expect(problems).toEqual([
      { what: staffCopy.problems.job.civicrmUpdatesUnanswered(1) },
      {
        what: staffCopy.problems.job.civicrmUpdatesInvalid(1),
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
    for (let n = 0; n < 150; n++) await recordOptOut(optOut({ address: `p${n}@example.com`, sourceRef: `r${n}` }));
    const { counts, problems } = await inRun(async (run) => ({
      counts: await sendCivicrmUpdates("key"),
      problems: run.problems,
    }));
    expect(counts).toEqual({ sent: 100, refused: 0, unanswered: 50 });
    expect(problems).toEqual([
      { what: staffCopy.problems.job.civicrmUpdatesFailed, error: "CiviCRM request failed with status 503: Down" },
    ]);
    expect(await query("SELECT count(*)::int AS n FROM civicrm_updates WHERE status IS NULL AND tries = 0")).toEqual([
      { n: 50 },
    ]);
  });
});

describeWithDatabase("our stops of a number sent to CiviCRM", () => {
  useTestDatabase();

  it("sends a stop of every text as Do not SMS, and of calls as Do not phone, but not a stop of some texts", async () => {
    const stop = (list: OptOut["list"], way: "text" | "call", ref: string) =>
      recordOptOut(
        optOut({
          address: "+447700900001",
          list,
          way,
          source: "staff",
          sourceRef: ref,
          recordedBy: JO,
          how: "Told us",
        }),
      );
    await stop("events", "text", "a");
    await stop("newsletter", "text", "b");
    expect(await query("SELECT 1 FROM civicrm_updates")).toEqual([]);
    await stop("volunteering", "text", "c");
    await stop("volunteering", "call", "d");
    expect(await query("SELECT change, phone, email FROM civicrm_updates ORDER BY id")).toEqual([
      { change: "do_not_sms", phone: "+447700900001", email: null },
      { change: "do_not_phone", phone: "+447700900001", email: null },
    ]);
    const calls = serve();
    expect(await sendCivicrmUpdates("key")).toEqual({ sent: 2, refused: 0, unanswered: 0 });
    expect(calls[0]).toEqual([
      expect.objectContaining({ phone: "+447700900001", change: "do_not_sms", source: "pauseai.uk:staff" }),
      expect.objectContaining({ phone: "+447700900001", change: "do_not_phone" }),
    ]);
    expect(calls[0][0]).not.toHaveProperty("email");
  });

  it("sends nothing for a number's stop CiviCRM told us of", async () => {
    for (const list of ["events", "newsletter", "volunteering"] as const) {
      await recordOptOut(optOut({ address: "+447700900001", list, way: "text", source: "civicrm", sourceRef: list }));
    }
    expect(await query("SELECT 1 FROM civicrm_updates")).toEqual([]);
  });
});
