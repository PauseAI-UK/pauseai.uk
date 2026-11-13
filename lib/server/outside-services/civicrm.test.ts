import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { checkSuppression, fetchContactsPage, readContact, updateSubscriptions } from "./civicrm";

const ROW = {
  contact_id: 12345,
  airtable_id: "recJane",
  email: " Jane@Example.org ",
  first_name: "Jane",
  last_name: " Smith ",
  city: "Bristol",
  postal_code: "BS1 4DJ",
  joined_date: "2025-03-14",
  intent: "volunteer",
  phone: "+447700900123",
  on_hold: false,
  no_bulk_email: true,
  do_not_email: false,
  do_not_phone: true,
  do_not_sms: false,
  lists: { newsletter: "subscribed", volunteer_updates: "not_opted_in" },
};

describe("readContact", () => {
  it("reads a row of get, its address trimmed and lowercased, and no Airtable ID as null", () => {
    expect(readContact(ROW)).toEqual({
      contactId: 12345,
      airtableId: "recJane",
      email: "jane@example.org",
      firstName: "Jane",
      lastName: "Smith",
      city: "Bristol",
      postalCode: "BS1 4DJ",
      joinedDate: "2025-03-14",
      intent: "volunteer",
      phone: "+447700900123",
      onHold: false,
      noBulkEmail: true,
      doNotEmail: false,
      doNotPhone: true,
      doNotSms: false,
      newsletter: "subscribed",
      volunteerUpdates: "not_opted_in",
    });
    expect(readContact({ ...ROW, airtable_id: null }).airtableId).toBeNull();
    expect(readContact({ ...ROW, airtable_id: "" }).airtableId).toBeNull();
  });

  it("reads a member detail CiviCRM has no value for, or a blank one, as null", () => {
    const { first_name, last_name, city, postal_code, joined_date, intent, phone, ...without } = ROW;
    void [first_name, last_name, city, postal_code, joined_date, intent, phone];
    expect(readContact(without)).toMatchObject({
      firstName: null,
      lastName: null,
      city: null,
      postalCode: null,
      joinedDate: null,
      intent: null,
      phone: null,
    });
    expect(readContact({ ...ROW, city: null, phone: " " })).toMatchObject({ city: null, phone: null });
  });

  it("refuses a row it can't be sure of, rather than keep a guess", () => {
    expect(() => readContact({ ...ROW, contact_id: "12345" })).toThrow("no contact ID");
    expect(() => readContact({ ...ROW, contact_id: 0 })).toThrow("no contact ID");
    expect(() => readContact({ ...ROW, email: " " })).toThrow("CiviCRM gave contact 12345 no email");
    expect(() => readContact({ ...ROW, email: null })).toThrow("no email");
    expect(() => readContact({ ...ROW, airtable_id: 5 })).toThrow("an Airtable ID that isn't text");
    expect(() => readContact({ ...ROW, lists: null })).toThrow("no lists");
    expect(() => readContact({ ...ROW, lists: "subscribed" })).toThrow("no lists");
    expect(() => readContact({ ...ROW, on_hold: 1 })).toThrow("a on_hold that isn't true or false");
    expect(() => readContact({ ...ROW, city: 5 })).toThrow("a city that isn't text");
    expect(() => readContact({ ...ROW, joined_date: "14/03/2025" })).toThrow(
      "a joined_date that isn't a day: 14/03/2025",
    );
    expect(() => readContact({ ...ROW, intent: "dance" })).toThrow("an intent we don't know: dance");
    expect(() => readContact({ ...ROW, lists: { ...ROW.lists, newsletter: "maybe" } })).toThrow(
      "a newsletter status we don't know: maybe",
    );
  });
});

describe("fetchContactsPage", () => {
  const GET = "https://crm.pauseai.info/civicrm/ajax/api4/PauseaiChapterContact/get";

  it("pages by GET with the key in its header", async () => {
    const seen: { method: string; url: string; auth: string | null; body: string }[] = [];
    server.use(
      http.all(GET, async ({ request }) => {
        seen.push({
          method: request.method,
          url: request.url,
          auth: request.headers.get("X-Civi-Auth"),
          body: await request.text(),
        });
        return HttpResponse.json({ values: [ROW] });
      }),
    );
    expect(await fetchContactsPage("key", 7)).toHaveLength(1);
    expect(seen[0]).toMatchObject({ method: "GET", auth: "Bearer key", body: "" });
    expect(JSON.parse(new URL(seen[0].url).searchParams.get("params")!)).toEqual({ limit: 500, after_contact_id: 7 });
  });

  it("refuses an answer with no list of contacts", async () => {
    server.use(http.get(GET, () => HttpResponse.json({ error_message: "Nope" })));
    await expect(fetchContactsPage("key", 0)).rejects.toThrow("CiviCRM's answer to get had no list of values");
    server.use(http.get(GET, () => HttpResponse.json(null)));
    await expect(fetchContactsPage("key", 0)).rejects.toThrow("no list of values");
  });
});

/** The params a POST to `action` was sent, from its body. */
const paramsOf = async (request: Request) =>
  JSON.parse(new URLSearchParams(await request.text()).get("params")!) as Record<string, unknown>;

describe("checkSuppression", () => {
  const CHECK = "https://crm.pauseai.info/civicrm/ajax/api4/PauseaiChapterContact/checkSuppression";

  it("asks by POST whether each address is blocked, and gives each block by address", async () => {
    let asked: Record<string, unknown> | undefined;
    server.use(
      http.post(CHECK, async ({ request }) => {
        asked = await paramsOf(request);
        return HttpResponse.json({
          values: [
            { email: " A@Example.org", block: "none" },
            { email: "b@example.org", block: "bulk" },
            { email: "c@example.org", block: "all" },
            { neither: true },
          ],
        });
      }),
    );
    const blocks = await checkSuppression("key", ["a@example.org", "b@example.org", "c@example.org"]);
    expect(asked).toEqual({ email: ["a@example.org", "b@example.org", "c@example.org"], phone: [] });
    expect([...blocks.emails]).toEqual([
      ["a@example.org", "none"],
      ["b@example.org", "bulk"],
      ["c@example.org", "all"],
    ]);
  });

  it("asks of numbers too, giving each one's flags, and a flag left null blocks nothing", async () => {
    let asked: Record<string, unknown> | undefined;
    server.use(
      http.post(CHECK, async ({ request }) => {
        asked = await paramsOf(request);
        return HttpResponse.json({
          values: [
            { phone: "+447700900001", do_not_phone: true, do_not_sms: false },
            { phone: "+447700900002", do_not_phone: false, do_not_sms: true },
            { phone: "+447700900003", do_not_phone: null, do_not_sms: null },
          ],
        });
      }),
    );
    const blocks = await checkSuppression("key", [], ["+447700900001", "+447700900002", "+447700900003"]);
    expect(asked).toEqual({ email: [], phone: ["+447700900001", "+447700900002", "+447700900003"] });
    expect([...blocks.phones]).toEqual([
      ["+447700900001", { doNotPhone: true, doNotSms: false }],
      ["+447700900002", { doNotPhone: false, doNotSms: true }],
      ["+447700900003", { doNotPhone: false, doNotSms: false }],
    ]);
  });

  it("refuses a block it doesn't know, or an answer that leaves an address or a number out", async () => {
    server.use(http.post(CHECK, () => HttpResponse.json({ values: [{ email: "a@example.org", block: "some" }] })));
    await expect(checkSuppression("key", ["a@example.org"])).rejects.toThrow("a block we don't know: some");
    server.use(http.post(CHECK, () => HttpResponse.json({ values: [] })));
    await expect(checkSuppression("key", ["a@example.org"])).rejects.toThrow("didn't say whether 1 addresses");
    await expect(checkSuppression("key", [], ["+447700900001"])).rejects.toThrow("didn't say whether 1 numbers");
  });

  it("matches each address to its echo whatever its case or the space round it, and gives it as it was asked", async () => {
    server.use(http.post(CHECK, () => HttpResponse.json({ values: [{ email: "A@Example.org ", block: "bulk" }] })));
    expect([...(await checkSuppression("key", ["A@Example.org "])).emails]).toEqual([["A@Example.org ", "bulk"]]);
  });

  it("takes unchecked, CiviCRM's answer for an address it may not look up yet, as an answer", async () => {
    server.use(http.post(CHECK, () => HttpResponse.json({ values: [{ email: "a@example.org", block: "unchecked" }] })));
    expect([...(await checkSuppression("key", ["a@example.org"])).emails]).toEqual([["a@example.org", "unchecked"]]);
  });
});

describe("updateSubscriptions", () => {
  const UPDATE = "https://crm.pauseai.info/civicrm/ajax/api4/PauseaiChapterContact/updateSubscriptions";
  const AT = new Date("2026-11-01T09:00:00Z");

  it("sends each event with only the fields it has, and reads each result by its ID", async () => {
    let asked: Record<string, unknown> | undefined;
    server.use(
      http.post(UPDATE, async ({ request }) => {
        asked = await paramsOf(request);
        return HttpResponse.json({
          values: [
            { event_id: "opt-out:1", status: "accepted" },
            { event_id: "lift:2", status: "refused", reason: "not_in_uk" },
            { event_id: "opt-out:3", status: "invalid", error: "unknown list" },
            { event_id: "opt-out:4", status: "invalid" },
            { event_id: "opt-out:5", status: "pending" },
            { status: "accepted" },
          ],
        });
      }),
    );
    const results = await updateSubscriptions("key", [
      {
        eventId: "opt-out:1",
        email: "a@example.org",
        change: "unsubscribe",
        list: "newsletter",
        contactId: 12,
        occurredAt: AT,
        source: "pauseai.uk:link",
      },
      {
        eventId: "lift:2",
        email: "b@example.org",
        change: "allow_bulk_email",
        occurredAt: AT,
        source: "pauseai.uk:preferences",
        wording: "Email me again",
      },
    ]);
    expect(asked).toEqual({
      events: [
        {
          event_id: "opt-out:1",
          email: "a@example.org",
          change: "unsubscribe",
          list: "newsletter",
          contact_id: 12,
          occurred_at: "2026-11-01T09:00:00.000Z",
          source: "pauseai.uk:link",
        },
        {
          event_id: "lift:2",
          email: "b@example.org",
          change: "allow_bulk_email",
          occurred_at: "2026-11-01T09:00:00.000Z",
          source: "pauseai.uk:preferences",
          wording: "Email me again",
        },
      ],
    });
    expect([...results]).toEqual([
      ["opt-out:1", { status: "accepted" }],
      ["lift:2", { status: "refused", reason: "not_in_uk" }],
      ["opt-out:3", { status: "invalid", reason: "unknown list" }],
      ["opt-out:4", { status: "invalid", reason: "" }],
    ]);
  });
});
