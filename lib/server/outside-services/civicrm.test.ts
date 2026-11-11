import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { fetchContactsPage, lookUpContacts, readContact } from "./civicrm";

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

describe("get", () => {
  const GET = "https://crm.pauseai.info/civicrm/ajax/api4/PauseaiChapterContact/get";

  it("pages by GET with the key in its header, and looks up addresses by POST, out of the URL", async () => {
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
    expect(await lookUpContacts("key", ["jane@example.org"])).toHaveLength(1);
    expect(seen[0]).toMatchObject({ method: "GET", auth: "Bearer key", body: "" });
    expect(JSON.parse(new URL(seen[0].url).searchParams.get("params")!)).toEqual({ limit: 500, after_contact_id: 7 });
    expect(seen[1]).toMatchObject({ method: "POST", url: GET, auth: "Bearer key" });
    expect(JSON.parse(new URLSearchParams(seen[1].body).get("params")!)).toEqual({ email: ["jane@example.org"] });
  });

  it("refuses an answer with no list of contacts", async () => {
    server.use(http.get(GET, () => HttpResponse.json({ error_message: "Nope" })));
    await expect(fetchContactsPage("key", 0)).rejects.toThrow("CiviCRM's answer had no list of contacts");
    server.use(http.get(GET, () => HttpResponse.json(null)));
    await expect(fetchContactsPage("key", 0)).rejects.toThrow("no list of contacts");
  });
});
