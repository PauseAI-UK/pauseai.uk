import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { staffCopy } from "@/lib/content/staff-interface";
import { query } from "@/lib/server/db";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { importCivicrm } from "./civicrm-import";
import { unblock } from "./delivery-problems";
import { recordOptOut } from "./opt-outs";

const GET = "https://crm.pauseai.info/civicrm/ajax/api4/PauseaiChapterContact/get";

type Row = Record<string, unknown>;

/** A contact as `get` gives it: on neither list, with no flags, unless told otherwise. */
function contact(id: number, email: string, fields: Row = {}, lists: Row = {}): Row {
  return {
    contact_id: id,
    airtable_id: null,
    email,
    on_hold: false,
    no_bulk_email: false,
    do_not_email: false,
    do_not_phone: false,
    do_not_sms: false,
    ...fields,
    lists: { newsletter: "not_on_list", volunteer_updates: "not_on_list", ...lists },
  };
}

/** CiviCRM's `get` answering with `contacts`: a page of them after a contact ID, or those with some addresses; every request it got. */
function serve(contacts: Row[]) {
  const asked: { method: string; params: Row }[] = [];
  server.use(
    http.all(GET, async ({ request }) => {
      const body =
        request.method === "POST" ? new URLSearchParams(await request.text()) : new URL(request.url).searchParams;
      const params = JSON.parse(body.get("params")!) as Row;
      asked.push({ method: request.method, params });
      const emails = params.email as string[] | undefined;
      const found = emails
        ? contacts.filter((c) => emails.includes(c.email as string))
        : contacts.filter((c) => (c.contact_id as number) > (params.after_contact_id as number));
      return HttpResponse.json({ values: found.slice(0, (params.limit as number | undefined) ?? found.length) });
    }),
  );
  return asked;
}

/** Each contact as kept, by ID: its address, flags and lists, and whether it's gone. */
async function kept() {
  return query<Row>(
    `SELECT contact_id::int AS id, airtable_id, email, on_hold, no_bulk_email, newsletter, volunteer_updates,
       gone_at IS NOT NULL AS gone FROM civicrm_contacts ORDER BY contact_id`,
  );
}

/** Every opt-out, oldest first: its address, topic and source, and whether it's still open. */
async function optOuts() {
  return query<Row>(
    `SELECT address, list, way, source, resubscribed_at IS NULL AS open FROM opt_outs ORDER BY unsubscribed_at, id`,
  );
}

beforeEach(() => vi.stubEnv("CIVICRM_CHAPTER_KEY", "k"));
afterEach(() => vi.unstubAllEnvs());

describeWithDatabase("importCivicrm", () => {
  useTestDatabase();

  it("pulls every page, keeps each contact as told, and a second run changes nothing", async () => {
    // A full page, then one more: two requests, each after the last contact of the one before.
    const many = Array.from({ length: 500 }, (_, i) => contact(1000 + i, `many${i}@example.com`));
    const asked = serve([
      ...many,
      contact(
        2000,
        " Jane@Example.com ",
        { airtable_id: "recJane", no_bulk_email: true },
        { newsletter: "subscribed", volunteer_updates: "unsubscribed" },
      ),
    ]);

    // Nobody else has their addresses, so each is a new supporter.
    expect(await importCivicrm("jo@pauseai.uk")).toEqual({
      contacts: 501,
      added: 501,
      changed: 0,
      gone: 0,
      optOuts: 1,
      blocked: 0,
      supportersAdded: 501,
      linked: 501,
    });
    expect(asked).toEqual([
      { method: "GET", params: { limit: 500, after_contact_id: 0 } },
      { method: "GET", params: { limit: 500, after_contact_id: 1499 } },
    ]);
    expect((await kept()).at(-1)).toEqual({
      id: 2000,
      airtable_id: "recJane",
      email: "jane@example.com",
      on_hold: false,
      no_bulk_email: true,
      newsletter: "subscribed",
      volunteer_updates: "unsubscribed",
      gone: false,
    });
    // An unsubscribe from the volunteer list is an opt-out from volunteering by email.
    expect(await optOuts()).toEqual([
      { address: "jane@example.com", list: "volunteering", way: "email", source: "civicrm", open: true },
    ]);
    // Every value is from when we first saw the contact.
    const [since] = await query<{ same: boolean }>(
      `SELECT bool_and(first_seen_at = newsletter_since AND first_seen_at = no_bulk_email_since) AS same
       FROM civicrm_contacts`,
    );
    expect(since.same).toBe(true);

    expect(await importCivicrm("nightly")).toEqual({
      contacts: 501,
      added: 0,
      changed: 0,
      gone: 0,
      optOuts: 0,
      blocked: 0,
    });
    expect(await query("SELECT status, started_by FROM import_runs WHERE job = 'import-civicrm' ORDER BY id")).toEqual([
      { status: "ok", started_by: "jo@pauseai.uk" },
      { status: "unchanged", started_by: "nightly" },
    ]);
  });

  it("sends our opt-outs first, so the pull has them, and the run says so", async () => {
    serve([contact(1, "kit@example.com")]);
    await recordOptOut({
      address: "kit@example.com",
      list: "newsletter",
      source: "link",
      sourceRef: "1",
      unsubscribedAt: new Date("2026-11-01T09:00:00Z"),
    });
    expect(await importCivicrm("nightly")).toMatchObject({ updates: { sent: 1, refused: 0, unanswered: 0 } });
    expect(await query("SELECT status FROM civicrm_updates")).toEqual([{ status: "accepted" }]);
  });

  it("keeps when each value changed, and a list joined again ends the opt-out it made", async () => {
    serve([contact(1, "kit@example.com", {}, { newsletter: "unsubscribed" })]);
    await importCivicrm("nightly");
    expect(await optOuts()).toEqual([
      { address: "kit@example.com", list: "newsletter", way: "email", source: "civicrm", open: true },
    ]);
    // A day later.
    await query(
      `UPDATE civicrm_contacts SET first_seen_at = first_seen_at - interval '1 day',
         ${["on_hold", "no_bulk_email", "do_not_email", "do_not_phone", "do_not_sms", "newsletter", "volunteer_updates"]
           .map((field) => `${field}_since = ${field}_since - interval '1 day'`)
           .join(", ")}`,
    );
    await query("UPDATE opt_outs SET unsubscribed_at = unsubscribed_at - interval '1 day'");

    serve([contact(1, "kit@example.com", { no_bulk_email: true }, { newsletter: "subscribed" })]);
    expect(await importCivicrm("nightly")).toMatchObject({ changed: 1, optOuts: 1 });
    const [row] = await query<{ newsletter: boolean; bulk: boolean; first: boolean }>(
      `SELECT newsletter_since > first_seen_at AS newsletter, no_bulk_email_since > first_seen_at AS bulk,
         do_not_email_since = first_seen_at AS first FROM civicrm_contacts`,
    );
    expect(row).toEqual({ newsletter: true, bulk: true, first: true });
    expect(await optOuts()).toEqual([
      { address: "kit@example.com", list: "newsletter", way: "email", source: "civicrm", open: false },
    ]);
  });

  it("leaves an opt-out begun after the list was joined", async () => {
    serve([contact(1, "kit@example.com", {}, { newsletter: "subscribed" })]);
    await importCivicrm("nightly");
    await query(
      `INSERT INTO opt_outs (address, list, way, source, source_ref, unsubscribed_at)
       VALUES ('kit@example.com', 'newsletter', 'email', 'luma-webhook', 'later', now() + interval '1 minute')`,
    );
    expect(await importCivicrm("nightly")).toMatchObject({ optOuts: 0 });
    expect(await optOuts()).toEqual([
      { address: "kit@example.com", list: "newsletter", way: "email", source: "luma-webhook", open: true },
    ]);
  });

  it("marks gone a contact a complete pull leaves out, and back when one returns it", async () => {
    const all = Array.from({ length: 30 }, (_, i) => contact(i + 1, `c${i}@example.com`));
    serve(all);
    await importCivicrm("nightly");
    serve(all.slice(1));
    expect(await importCivicrm("nightly")).toMatchObject({ contacts: 29, gone: 1 });
    expect((await kept())[0]).toMatchObject({ id: 1, gone: true });
    serve(all);
    expect(await importCivicrm("nightly")).toMatchObject({ changed: 1, gone: 0 });
    expect((await kept())[0]).toMatchObject({ id: 1, gone: false });
  });

  it("marks nobody gone from a pull over 5% shorter than the last, and says so", async () => {
    const all = Array.from({ length: 20 }, (_, i) => contact(i + 1, `c${i}@example.com`));
    serve(all);
    await importCivicrm("nightly");
    serve(all.slice(2));
    expect(await importCivicrm("nightly")).toMatchObject({ contacts: 18, gone: 0, held: true });
    expect((await kept()).filter((c) => c.gone)).toEqual([]);
    const [run] = await query<{ problems: unknown }>(
      "SELECT problems FROM import_runs WHERE job = 'import-civicrm' ORDER BY id DESC LIMIT 1",
    );
    expect(run.problems).toEqual([{ what: staffCopy.problems.job.civicrmTooFew, error: "18 returned, 20 before" }]);
    // Its log says why nobody went.
    const held = { contacts: 18, added: 0, changed: 0, gone: 0, held: true as const, optOuts: 0, blocked: 0 };
    expect(staffCopy.civicrm.result(held)).not.toBe(staffCopy.civicrm.result({ ...held, held: undefined }));
    // And any new supporters, when it linked some.
    expect(staffCopy.civicrm.result({ ...held, supportersAdded: 1, linked: 2 })).toContain(
      staffCopy.civicrm.result(held),
    );
    expect(staffCopy.civicrm.result({ ...held, supportersAdded: 1, linked: 2 })).not.toBe(
      staffCopy.civicrm.result(held),
    );
  });

  it("skips an erased contact", async () => {
    await query("INSERT INTO civicrm_erased (contact_id) VALUES (7)");
    serve([contact(7, "erin@example.com", {}, { newsletter: "subscribed" }), contact(8, "sam@example.com")]);
    expect(await importCivicrm("nightly")).toMatchObject({ contacts: 2, added: 1 });
    expect((await kept()).map((c) => c.id)).toEqual([8]);
  });

  it("blocks an address for a new hold, once, which staff can lift without Postmark, until a new hold", async () => {
    serve([contact(1, "held@example.com", { on_hold: true }), contact(2, "also@example.com", { on_hold: true })]);
    await query(
      `WITH p AS (INSERT INTO email_problems (address, kind, reason, can_reset) VALUES ('also@example.com', 'complaint', 'spam', false) RETURNING id, address)
       INSERT INTO email_blocks (address, problem_id) SELECT address, id FROM p`,
    );
    // The other address is blocked already, by a complaint, which stays.
    expect(await importCivicrm("nightly")).toMatchObject({ blocked: 1 });
    expect(
      await query(
        "SELECT b.address, p.kind, p.can_reset FROM email_blocks b JOIN email_problems p ON p.id = b.problem_id ORDER BY 1",
      ),
    ).toEqual([
      { address: "also@example.com", kind: "complaint", can_reset: false },
      { address: "held@example.com", kind: "hold", can_reset: true },
    ]);

    expect(await unblock("held@example.com", "jo@pauseai.uk", "Global say it's fine")).toBe(true);
    // The same hold doesn't block it again.
    expect(await importCivicrm("nightly")).toMatchObject({ blocked: 0 });
    expect(await query("SELECT 1 FROM email_blocks WHERE address = 'held@example.com'")).toEqual([]);

    // A hold lifted, then set again, does.
    serve([contact(1, "held@example.com"), contact(2, "also@example.com", { on_hold: true })]);
    await importCivicrm("nightly");
    serve([contact(1, "held@example.com", { on_hold: true }), contact(2, "also@example.com", { on_hold: true })]);
    expect(await importCivicrm("nightly")).toMatchObject({ blocked: 1 });
  });

  it("unblocks an address when CiviCRM lifts its hold, unless another of its contacts is still on hold", async () => {
    serve([
      contact(1, "held@example.com", { on_hold: true }),
      contact(2, "twice@example.com", { on_hold: true }),
      contact(3, "twice@example.com", { on_hold: true }),
    ]);
    expect(await importCivicrm("nightly")).toMatchObject({ blocked: 2 });
    expect(await importCivicrm("nightly")).not.toHaveProperty("unblocked");

    // Both lift one hold; the address with another contact on hold stays blocked.
    serve([
      contact(1, "held@example.com"),
      contact(2, "twice@example.com"),
      contact(3, "twice@example.com", { on_hold: true }),
    ]);
    expect(await importCivicrm("nightly")).toMatchObject({ unblocked: 1 });
    expect(await query("SELECT address FROM email_blocks ORDER BY 1")).toEqual([{ address: "twice@example.com" }]);
    // The hold stays in the address's history.
    expect(await query("SELECT kind FROM email_problems WHERE address = 'held@example.com'")).toEqual([
      { kind: "hold" },
    ]);
    expect(
      staffCopy.civicrm.result({ contacts: 3, added: 0, changed: 2, gone: 0, optOuts: 0, blocked: 0, unblocked: 1 }),
    ).not.toBe(staffCopy.civicrm.result({ contacts: 3, added: 0, changed: 2, gone: 0, optOuts: 0, blocked: 0 }));
  });

  it("fails the run when CiviCRM fails, keeping nothing", async () => {
    server.use(http.get(GET, () => new HttpResponse("Down", { status: 503 })));
    await expect(importCivicrm("nightly")).rejects.toThrow("CiviCRM request failed with status 503: Down");
    expect(await kept()).toEqual([]);
    expect(await query("SELECT status FROM import_runs")).toEqual([{ status: "failed" }]);
  });

  it("fails without the key", async () => {
    vi.stubEnv("CIVICRM_CHAPTER_KEY", "");
    await expect(importCivicrm("nightly")).rejects.toThrow("CIVICRM_CHAPTER_KEY isn't set");
  });

  it("stops a pull whose pages never come up short", async () => {
    server.use(
      http.get(GET, ({ request }) => {
        const after = JSON.parse(new URL(request.url).searchParams.get("params")!).after_contact_id as number;
        return HttpResponse.json({
          values: Array.from({ length: 500 }, (_, i) => contact(after + i + 1, `c${after + i}@example.com`)),
        });
      }),
    );
    await expect(importCivicrm("nightly")).rejects.toThrow("CiviCRM's contacts ran past 100 pages");
  });

  it("brings the supporters list up to date when a contact changes or goes, linking nobody", async () => {
    const jane = { first_name: "Jane", last_name: "Smith", joined_date: "2026-09-12" };
    const sam = { first_name: "Sam", last_name: "Jones", joined_date: "2026-09-13" };
    // Enough others that one going is too few to hold back as CiviCRM's mistake.
    const others = Array.from({ length: 30 }, (_, i) => contact(100 + i, `other${i}@example.com`));
    serve([contact(1, "jane@example.com", jane), contact(2, "sam@example.com", sam), ...others]);
    await importCivicrm("nightly");
    const listed = () =>
      query<Row>(
        `SELECT name, member, first_seen_at FROM supporters_list
         WHERE emails && '{jane@example.com,sam@example.com}' ORDER BY emails`,
      );
    expect(await listed()).toEqual([
      { name: "Jane Smith", member: true, first_seen_at: new Date("2026-09-12T00:00:00Z") },
      { name: "Sam Jones", member: true, first_seen_at: new Date("2026-09-13T00:00:00Z") },
    ]);

    // Jane's name and joining change; Sam is no longer returned.
    serve([contact(1, "jane@example.com", { ...jane, last_name: "Brown", joined_date: "2026-09-01" }), ...others]);
    expect(await importCivicrm("nightly")).toMatchObject({ changed: 1, gone: 1 });
    expect(await listed()).toEqual([
      { name: "Jane Brown", member: true, first_seen_at: new Date("2026-09-01T00:00:00Z") },
      { name: null, member: false, first_seen_at: new Date("2026-09-13T00:00:00Z") },
    ]);
  });
});
