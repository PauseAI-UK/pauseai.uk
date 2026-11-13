import { describe, expect, it } from "vitest";
import { fixtureResponse } from "./outside-services";

describe("fixtureResponse", () => {
  it("serves the future and past calendars by period", async () => {
    const future = await fixtureResponse(
      "https://public-api.luma.com/v1/calendars/events/list?after=2026-01-01T00:00:00.000Z",
    )!.json();
    const past = await fixtureResponse(
      "https://public-api.luma.com/v1/calendars/events/list?before=2026-01-01T00:00:00.000Z",
    )!.json();
    expect(future.entries[0].url).toBe("https://luma.com/fixture-london-protest");
    expect(past.entries[0].url).toBe("https://luma.com/fixture-past-london-march");
  });

  it("serves every event, public or not, when asked for neither period", async () => {
    const all = await fixtureResponse("https://public-api.luma.com/v1/calendars/events/list?x=1")!.json();
    expect(all.entries.map((e: { visibility: string }) => e.visibility)).toContain("private");
    expect(all.entries.length).toBeGreaterThan(8);
  });

  it("serves an event's details with its hosts: the London protest's three, any other's one", async () => {
    const get = "https://public-api.luma.com/v1/events/get";
    const london = await fixtureResponse(`${get}?event_id=evt-fixture-london-protest`)!.json();
    expect(london.id).toBe("evt-fixture-london-protest");
    expect(london.hosts.map((h: { id: string }) => h.id)).toEqual(["usr-fixture-2", "usr-fixture-7", "usr-fixture-1"]);
    const noEvent = await fixtureResponse(`${get}?x=1`)!.json();
    expect(noEvent.id).toBe("");
    expect(noEvent.hosts.map((h: { id: string }) => h.id)).toEqual(["usr-fixture-3"]);
  });

  it("serves an event's guests over two pages, with IDs of their own, and the contacts", async () => {
    const guests = "https://public-api.luma.com/v1/events/guests/list?event_id=evt-1";
    const first = await fixtureResponse(guests)!.json();
    expect(first.entries.map((g: { id: string }) => g.id)).toEqual(["gst-1-evt-1", "gst-2-evt-1", "gst-3-evt-1"]);
    expect(first.has_more).toBe(true);
    const second = await fixtureResponse(`${guests}&pagination_cursor=${first.next_cursor}`)!.json();
    expect(second.entries).toHaveLength(2);
    expect(second.has_more).toBe(false);
    const noEvent = await fixtureResponse("https://public-api.luma.com/v1/events/guests/list")!.json();
    expect(noEvent.entries[0].id).toBe("gst-1-");
    const contacts = await fixtureResponse("https://public-api.luma.com/v1/calendars/contacts/list?x=1")!.json();
    expect(contacts.entries).toHaveLength(2);
    expect(contacts.has_more).toBe(true);
  });

  it("serves the UK Parliamentarians table, and nothing for another", async () => {
    const records = async (table: string) =>
      (await fixtureResponse(`https://eu.airtable.com/v0/appBInVvIm6opJ1Ob/${table}?x=1`)!.json()).records.map(
        (r: { id: string }) => r.id,
      );
    expect(await records("tblH3ks9wqQHLpYx3")).toContain("recPlaceholder");
    expect(fixtureResponse("https://eu.airtable.com/v0/appBInVvIm6opJ1Ob/tblOther")).toBeUndefined();
  });

  it("serves CiviCRM's UK chapter contacts a page after a contact ID, or those with some addresses", async () => {
    const get = "https://crm.pauseai.info/civicrm/ajax/api4/PauseaiChapterContact/get";
    const ids = async (response: Response | undefined) =>
      ((await response!.json()).values as { contact_id: number }[]).map((c) => c.contact_id);
    const page = (params: object) => `${get}?${new URLSearchParams({ params: JSON.stringify(params) })}`;
    expect(await ids(fixtureResponse(page({ limit: 2, after_contact_id: 103 })))).toEqual([104, 105]);
    expect(await ids(fixtureResponse(page({})))).toHaveLength(8);
    expect(await ids(fixtureResponse(get))).toHaveLength(8);
    const body = new URLSearchParams({ params: JSON.stringify({ email: ["kit.member@example.com"] }) });
    expect(await ids(fixtureResponse(get, { method: "POST", body: body.toString() }))).toEqual([105]);
  });

  it("checks CiviCRM's blocks: all for Do not email, bulk for No bulk emails, none for anyone else", async () => {
    const res = fixtureResponse("https://crm.pauseai.info/civicrm/ajax/api4/PauseaiChapterContact/checkSuppression", {
      method: "POST",
      body: new URLSearchParams({
        params: JSON.stringify({ email: ["rhea.member@example.com", "nobody@example.com"] }),
      }).toString(),
    })!;
    expect(await res.json()).toEqual({
      values: [
        { email: "rhea.member@example.com", block: "bulk" },
        { email: "nobody@example.com", block: "none" },
      ],
    });
    const none = fixtureResponse("https://crm.pauseai.info/civicrm/ajax/api4/PauseaiChapterContact/checkSuppression")!;
    expect(await none.json()).toEqual({ values: [] });
    // A number has its contact's flags; one no contact holds, none.
    const numbers = fixtureResponse(
      "https://crm.pauseai.info/civicrm/ajax/api4/PauseaiChapterContact/checkSuppression",
      {
        method: "POST",
        body: new URLSearchParams({ params: JSON.stringify({ phone: ["+447700900456", "+447700900001"] }) }).toString(),
      },
    )!;
    expect(await numbers.json()).toEqual({
      values: [
        { phone: "+447700900456", do_not_phone: true, do_not_sms: false },
        { phone: "+447700900001", do_not_phone: false, do_not_sms: false },
      ],
    });
  });

  it("answers the Graph API as WhatsApp's fake", async () => {
    const res = fixtureResponse("https://graph.facebook.com/v23.0/fixture-account/phone_numbers?fields=id")!;
    expect(await res.json()).toMatchObject({ data: [{ id: "fixture-phone" }] });
  });

  it("accepts every opt-out sent to CiviCRM, and a lift of No bulk emails only for a UK contact's address", async () => {
    const url = "https://crm.pauseai.info/civicrm/ajax/api4/PauseaiChapterContact/updateSubscriptions";
    const events = [
      { event_id: "a", email: "nobody@example.com", change: "unsubscribe" },
      { event_id: "b", email: "nobody@example.com", change: "allow_bulk_email" },
      { event_id: "c", email: "rhea.member@example.com", change: "allow_bulk_email" },
    ];
    const res = fixtureResponse(url, {
      method: "POST",
      body: new URLSearchParams({ params: JSON.stringify({ events }) }).toString(),
    })!;
    expect(await res.json()).toEqual({
      values: [
        { event_id: "a", status: "accepted" },
        { event_id: "b", status: "refused", reason: "not_in_uk" },
        { event_id: "c", status: "accepted" },
      ],
    });
    expect(await fixtureResponse(url)!.json()).toEqual({ values: [] });
  });

  it("takes anyone off Luma's calendar", async () => {
    expect(
      await fixtureResponse("https://public-api.luma.com/v1/calendars/contacts/remove", {
        method: "POST",
        body: "{}",
      })!.json(),
    ).toEqual({});
  });

  it("serves Airtable's members from the members table", async () => {
    const members = await fixtureResponse(
      "https://api.airtable.com/v0/appWPTGqZmUcs3NWu/tblL1icZBhTV1gQ9o?x=1",
    )!.json();
    expect(members.records[0].id).toBe("recMemberJane");
  });

  it("places each fixture postcode at its own point, with its constituency where it knows it, and 404s the rest", async () => {
    const found = await fixtureResponse("https://api.postcodes.io/postcodes/sw1a%201aa")!.json();
    expect(found.result.parliamentary_constituency).toBe("Cities of London and Westminster");
    expect(found.result.admin_district).toBe("Westminster");
    const manchester = await fixtureResponse("https://api.postcodes.io/postcodes/M1%201AE")!.json();
    expect(manchester.result).toMatchObject({
      parliamentary_constituency: "Manchester Central",
      admin_district: "Manchester",
      latitude: 53.4794,
    });
    const bristol = await fixtureResponse("https://api.postcodes.io/postcodes/BS11AA")!.json();
    expect(bristol.result).toMatchObject({ admin_district: "Bristol, City of", latitude: 51.4545 });
    expect(bristol.result.parliamentary_constituency).toBeUndefined();
    expect(fixtureResponse("https://api.postcodes.io/postcodes/XX11XX")!.status).toBe(404);
  });

  it("passes every Turnstile token", async () => {
    expect((await fixtureResponse("https://challenges.cloudflare.com/turnstile/v0/siteverify")!.json()).success).toBe(
      true,
    );
  });

  it("lists three MPs, each with an office email", async () => {
    expect(
      (await fixtureResponse("https://members-api.parliament.uk/api/Members/Search?House=1")!.json()).items,
    ).toHaveLength(3);
    const contact = await fixtureResponse("https://members-api.parliament.uk/api/Members/90001/Contact")!.json();
    expect(contact.value[0].email).toBe("mp90001.office@parliament.uk ");
  });

  it("accepts every email sent through Postmark", async () => {
    const sent = await fixtureResponse("https://api.postmarkapp.com/email")!.json();
    expect(sent.ErrorCode).toBe(0);
    expect(sent.MessageID).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("gives the same email the same MessageID every time, and another email a different one", async () => {
    const id = async (body: string) =>
      (await fixtureResponse("https://api.postmarkapp.com/email", { method: "POST", body })!.json()).MessageID;
    expect(await id("a letter")).toBe(await id("a letter"));
    expect(await id("a letter")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(await id("another")).not.toBe(await id("a letter"));
    // A letter's address's random digits don't change it.
    expect(await id("From: jane.smith.482913@letters.pauseai.uk")).toBe(
      await id("From: jane.smith.055350@letters.pauseai.uk"),
    );
  });

  it("takes any address off a Postmark stream's suppression list", async () => {
    const body = JSON.stringify({ Suppressions: [{ EmailAddress: "a@example.org" }] });
    const answer = fixtureResponse("https://api.postmarkapp.com/message-streams/outbound/suppressions/delete", {
      method: "POST",
      body,
    });
    expect(await answer!.json()).toEqual({
      Suppressions: [{ EmailAddress: "a@example.org", Status: "Deleted", Message: null }],
    });
  });

  it("has nothing for other URLs", () => {
    expect(fixtureResponse("https://public-api.luma.com/other")).toBeUndefined();
    expect(fixtureResponse("https://eu.airtable.com/other")).toBeUndefined();
    expect(fixtureResponse("https://members-api.parliament.uk/api/Members/90001")).toBeUndefined();
    expect(fixtureResponse("https://example.com/")).toBeUndefined();
  });

  it("answers Google for any account, by its token; a message it hasn't, Gmail's 404", async () => {
    const token = (body: string) =>
      fixtureResponse("https://oauth2.googleapis.com/token", { method: "POST", body })!.json();
    expect(await token("code=fixture%3Ajo%40pauseai.uk")).toEqual({
      access_token: "fixture-access:jo@pauseai.uk",
      expires_in: 3599,
      refresh_token: "fixture-refresh:jo@pauseai.uk",
    });
    expect(await token("refresh_token=fixture-refresh%3Ajo%40pauseai.uk")).toEqual({
      access_token: "fixture-access:jo@pauseai.uk",
      expires_in: 3599,
    });
    expect(fixtureResponse("https://oauth2.googleapis.com/revoke?token=x", { method: "POST" })!.status).toBe(200);
    const gmail = (path: string, init: RequestInit = {}) =>
      fixtureResponse(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
        ...init,
        headers: { authorization: "Bearer fixture-access:jo@pauseai.uk" },
      })!;
    expect(await gmail("/profile").json()).toEqual({ emailAddress: "jo@pauseai.uk", historyId: "1000" });
    const sent = await gmail("/messages/send", { method: "POST", body: '{"raw":"x"}' }).json();
    expect(sent).toEqual(await gmail("/messages/send", { method: "POST", body: '{"raw":"x"}' }).json());
    expect(await gmail("/history?startHistoryId=1").json()).toEqual({ historyId: "1000" });
    expect(await gmail("/messages?q=x").json()).toEqual({ resultSizeEstimate: 0 });
    expect(gmail("/messages/abc").status).toBe(404);
    // An email it sent says the Message-ID it went with.
    const raw = Buffer.from("Message-ID: <ours@pauseai.uk>\r\nSubject: Hi\r\n\r\nHello").toString("base64url");
    const { id } = await gmail("/messages/send", { method: "POST", body: JSON.stringify({ raw }) }).json();
    expect(await gmail(`/messages/${id}?format=metadata&metadataHeaders=Message-ID`).json()).toMatchObject({
      id,
      payload: { headers: [{ name: "Message-ID", value: "<ours@pauseai.uk>" }] },
    });
  });
});
