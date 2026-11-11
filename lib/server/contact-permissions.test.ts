import { expect, it } from "vitest";
import type { Topic, Way } from "@/lib/contact-permissions";
import { addTestLetter, addTestMp, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "./db";
import { permissionsFor } from "./contact-permissions";

/** A Luma account, a contact of the calendar since `since` or not one. */
async function luma(email: string, since: string | null) {
  await query("INSERT INTO luma_people (user_id, email, contact_since) VALUES ($1, $2, $3)", [
    `usr-${email}`,
    email,
    since,
  ]);
}

/** A member record: made at `createdAt`, with "Keep me informed" ticked or not, removed or not, and a phone and intent if given. */
async function member(
  id: string,
  email: string,
  createdAt: string,
  keepInformed: boolean,
  removed = false,
  phone: string | null = null,
  intent: string | null = null,
) {
  await query(
    `INSERT INTO members (id, email, name, joined_at, created_at, keep_informed, share_permission, source_modified_at, removed_at, phone, intent)
     VALUES ($1, $2, 'X', $3, $3, $4, true, $3, $5, $6, $7)`,
    [id, email, createdAt, keepInformed, removed ? createdAt : null, phone, intent],
  );
}

type Civicrm = {
  airtableId?: string | null;
  newsletter?: string;
  volunteer?: string;
  flags?: Partial<Record<"on_hold" | "no_bulk_email" | "do_not_email" | "do_not_phone" | "do_not_sms", boolean>>;
  gone?: string | null;
};

let contactIds = 0;

/** A CiviCRM contact with `email`, every value as of `since`: on neither list and no flags, unless told otherwise. */
async function civicrm(email: string, since: string, contact: Civicrm = {}) {
  const flags = { on_hold: false, no_bulk_email: false, do_not_email: false, do_not_phone: false, do_not_sms: false };
  Object.assign(flags, contact.flags);
  await query(
    `INSERT INTO civicrm_contacts (contact_id, airtable_id, email, on_hold, on_hold_since, no_bulk_email, no_bulk_email_since,
       do_not_email, do_not_email_since, do_not_phone, do_not_phone_since, do_not_sms, do_not_sms_since,
       newsletter, newsletter_since, volunteer_updates, volunteer_updates_since, first_seen_at, gone_at)
     VALUES ($1, $2, $3, $4, $11, $5, $11, $6, $11, $7, $11, $8, $11, $9, $11, $10, $11, $11, $12)`,
    [
      ++contactIds,
      contact.airtableId ?? null,
      email,
      flags.on_hold,
      flags.no_bulk_email,
      flags.do_not_email,
      flags.do_not_phone,
      flags.do_not_sms,
      contact.newsletter ?? "not_on_list",
      contact.volunteer ?? "not_on_list",
      since,
      contact.gone ?? null,
    ],
  );
}

/** A registration for an event by `email`'s Luma account, giving `phone`. */
async function lumaGuest(email: string, phone: string) {
  await query(
    `INSERT INTO luma_events (id, name, url, start_at, access) VALUES ('evt-1', 'E', 'e', '2026-10-01T18:00:00Z', 'manage')
     ON CONFLICT DO NOTHING`,
  );
  await query(
    `INSERT INTO luma_guests (id, event_id, user_id, approval_status, registered_at, phone)
     VALUES ($1, 'evt-1', $2, 'approved', '2026-09-30T00:00:00Z', $3)`,
    [`gst-${email}-${phone}`, `usr-${email}`, phone],
  );
}

/** An entry on `form` from `email`, giving `phone`, with the consent box ticked or not. */
async function formEntry(email: string, form: string, phone: string | null, consent: boolean, at: string) {
  await query(
    `INSERT INTO form_entries (form, created_at, name, email, phone, contact_consent) VALUES ($1, $2, 'X', $3, $4, $5)`,
    [form, at, email, phone, consent],
  );
}

/** A letter from `email`, with the consent box ticked or not. */
async function letter(mp: number, email: string, consent: boolean, at: string) {
  await addTestLetter({
    politicianId: mp,
    senderEmail: email,
    contactConsent: consent,
    postmarkMailbox: `${email}-${at}`,
    createdAt: at,
  });
}

/** An opt-out of `list` by `way` from `source`, lifted at `resubscribedAt` if given. */
async function optOut(
  address: string,
  at: string,
  { list = "events", way = "email", source = "luma-webhook", resubscribedAt = null as string | null } = {},
) {
  await query(
    `INSERT INTO opt_outs (address, list, way, source, source_ref, unsubscribed_at, resubscribed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [address, list, way, source, `w-${address}-${list}-${at}`, at, resubscribedAt],
  );
}

/** A block on an address, from a problem of `kind`. */
async function block(address: string, kind: string, at: string) {
  await query(
    `WITH p AS (INSERT INTO email_problems (at, address, kind, reason, can_reset) VALUES ($2, $1, $3, '', $3 <> 'complaint')
       RETURNING id)
     INSERT INTO email_blocks (address, problem_id) SELECT $1, id FROM p`,
    [address, at, kind],
  );
}

/** One address's answer for a topic by email, as [send, reason, at, source]; undefined when it has none. */
async function answer(address: string, topic: Topic) {
  const found = (await permissionsFor([address])).find((p) => p.topic === topic);
  return found && [found.send, found.reason, found.at && new Date(found.at).toISOString(), found.source];
}

/** One number's answer for a topic by a way, as [send, reason, at, source]; undefined when it has none. */
async function phoneAnswer(number: string, topic: Topic, way: Way = "text") {
  const found = (await permissionsFor([], [number])).find((p) => p.topic === topic && p.way === way);
  return found && [found.send, found.reason, found.at && new Date(found.at).toISOString(), found.source];
}

describeWithDatabase("permissionsFor", () => {
  useTestDatabase();

  it("answers each address in the order asked, then each number, a topic at a time, text before call", async () => {
    await luma("b@example.com", "2026-09-01T00:00:00Z");
    await civicrm("a@example.com", "2026-11-01T00:00:00Z", { newsletter: "subscribed", volunteer: "subscribed" });
    await member("recV", "v@example.com", "2026-09-12T00:00:00Z", false, false, "+447700900030", "Volunteer");
    expect(
      (await permissionsFor([" A@Example.com", "b@example.com", "nobody@example.com"], ["+447700900030"])).map((p) => [
        p.address,
        p.topic,
        p.way,
        p.channel,
        p.send,
      ]),
    ).toEqual([
      ["a@example.com", "newsletter", "email", "email", "yes"],
      ["a@example.com", "volunteering", "email", "email", "yes"],
      ["b@example.com", "events", "email", "email", "yes"],
      ["+447700900030", "volunteering", "text", "phone", "yes"],
      ["+447700900030", "volunteering", "call", "phone", "yes"],
    ]);
  });

  it("says yes to the newsletter by email for a box ticked on any of our forms or a paper sign-up, and the latest says", async () => {
    const mp = await addTestMp();
    await letter(mp, "asked@example.com", true, "2026-10-01T00:00:00Z");
    expect(await answer("asked@example.com", "newsletter")).toEqual([
      "yes",
      "asked",
      "2026-10-01T00:00:00.000Z",
      "email-your-mp",
    ]);
    // A later box left unticked doesn't undo it, as it isn't a stop.
    await letter(mp, "asked@example.com", false, "2026-10-20T00:00:00Z");
    expect((await answer("asked@example.com", "newsletter"))?.slice(0, 2)).toEqual(["yes", "asked"]);
    // Only boxes left unticked: why not.
    await letter(mp, "declined@example.com", false, "2026-10-01T00:00:00Z");
    expect(await answer("declined@example.com", "newsletter")).toEqual([
      "no",
      "declined",
      "2026-10-01T00:00:00.000Z",
      "email-your-mp",
    ]);
    await formEntry("paper@example.com", "paper-signup", null, true, "2026-11-01T12:00:00Z");
    expect(await answer("paper@example.com", "newsletter")).toEqual([
      "yes",
      "signed-up",
      "2026-11-01T12:00:00.000Z",
      "paper-signup",
    ]);
  });

  it("takes CiviCRM's newsletter list: on it a yes, unsubscribed a stop, never opted in or gone why not", async () => {
    await civicrm("on@example.com", "2026-11-01T00:00:00Z", { newsletter: "subscribed" });
    await civicrm("never@example.com", "2026-11-01T00:00:00Z", { newsletter: "not_opted_in" });
    await civicrm("gone@example.com", "2026-11-01T00:00:00Z", {
      newsletter: "subscribed",
      gone: "2026-11-05T00:00:00Z",
    });
    await civicrm("off@example.com", "2026-11-01T00:00:00Z", { newsletter: "not_on_list" });
    await optOut("off2@example.com", "2026-11-02T00:00:00Z", { list: "newsletter", source: "civicrm" });
    expect(await answer("on@example.com", "newsletter")).toEqual([
      "yes",
      "subscribed",
      "2026-11-01T00:00:00.000Z",
      "civicrm",
    ]);
    expect(await answer("never@example.com", "newsletter")).toEqual([
      "no",
      "not-opted-in",
      "2026-11-01T00:00:00.000Z",
      "civicrm",
    ]);
    expect(await answer("gone@example.com", "newsletter")).toEqual([
      "no",
      "left",
      "2026-11-05T00:00:00.000Z",
      "civicrm",
    ]);
    expect(await answer("off@example.com", "newsletter")).toBeUndefined();
    expect(await answer("off2@example.com", "newsletter")).toEqual([
      "no",
      "unsubscribed",
      "2026-11-02T00:00:00.000Z",
      "civicrm",
    ]);
  });

  it("weighs a stop against a yes by which came later, a stop winning a tie, while never opted in is no stop", async () => {
    const mp = await addTestMp();
    // Unsubscribed in CiviCRM after ticking a box, then ticked another.
    await letter(mp, "kit@example.com", true, "2026-10-01T00:00:00Z");
    await optOut("kit@example.com", "2026-10-10T00:00:00Z", { list: "newsletter", source: "civicrm" });
    expect((await answer("kit@example.com", "newsletter"))?.slice(0, 2)).toEqual(["no", "unsubscribed"]);
    await letter(mp, "kit@example.com", true, "2026-10-20T00:00:00Z");
    expect((await answer("kit@example.com", "newsletter"))?.slice(0, 3)).toEqual([
      "yes",
      "asked",
      "2026-10-20T00:00:00.000Z",
    ]);
    await optOut("tie@example.com", "2026-10-01T00:00:00Z", { list: "newsletter", source: "civicrm" });
    await letter(mp, "tie@example.com", true, "2026-10-01T00:00:00Z");
    expect((await answer("tie@example.com", "newsletter"))?.slice(0, 2)).toEqual(["no", "unsubscribed"]);
    await civicrm("owen@example.com", "2026-11-01T00:00:00Z", { newsletter: "not_opted_in" });
    await letter(mp, "owen@example.com", true, "2026-10-01T00:00:00Z");
    expect((await answer("owen@example.com", "newsletter"))?.slice(0, 2)).toEqual(["yes", "asked"]);
  });

  it("stops every topic by email for a block, then CiviCRM's Do not email, then No bulk emails, whatever was said", async () => {
    const mp = await addTestMp();
    for (const address of ["blocked@example.com", "dne@example.com", "nbe@example.com"]) {
      await letter(mp, address, true, "2026-10-01T00:00:00Z");
      await luma(address, "2026-09-01T00:00:00Z");
    }
    await block("blocked@example.com", "complaint", "2026-10-05T00:00:00Z");
    await civicrm("blocked@example.com", "2026-11-01T00:00:00Z", { flags: { do_not_email: true } });
    // A flag on a contact that's gone still stops.
    await civicrm("dne@example.com", "2026-11-01T00:00:00Z", {
      flags: { do_not_email: true, no_bulk_email: true },
      gone: "2026-11-02T00:00:00Z",
    });
    await civicrm("nbe@example.com", "2026-11-01T00:00:00Z", {
      flags: { no_bulk_email: true },
      newsletter: "subscribed",
    });
    for (const topic of ["newsletter", "events"] as const) {
      expect(await answer("blocked@example.com", topic)).toEqual([
        "no",
        "blocked",
        "2026-10-05T00:00:00.000Z",
        "complaint",
      ]);
      expect(await answer("dne@example.com", topic)).toEqual([
        "no",
        "do-not-email",
        "2026-11-01T00:00:00.000Z",
        "civicrm",
      ]);
      expect(await answer("nbe@example.com", topic)).toEqual([
        "no",
        "no-bulk-email",
        "2026-11-01T00:00:00.000Z",
        "civicrm",
      ]);
    }
  });

  it("takes Keep me informed for a member CiviCRM has never returned, and nothing from one it no longer returns", async () => {
    await member("recRobin", "robin@example.com", "2026-07-01T00:00:00Z", true);
    await member("recLee", "lee@example.com", "2026-07-01T00:00:00Z", false);
    // Before 30 June 2026 the box was required or not there, so a tick then says nothing.
    await member("recKit", "kit@example.com", "2026-05-01T00:00:00Z", true);
    await member("recJane", "jane@example.com", "2026-09-01T00:00:00Z", true);
    await civicrm("jane@example.com", "2026-11-01T00:00:00Z", { airtableId: "recJane", newsletter: "unsubscribed" });
    await optOut("jane@example.com", "2026-11-01T00:00:00Z", { list: "newsletter", source: "civicrm" });
    await member("recGil", "gil@example.com", "2026-08-01T00:00:00Z", true);
    await civicrm("gil@example.com", "2026-11-01T00:00:00Z", {
      airtableId: "recGil",
      newsletter: "subscribed",
      gone: "2026-11-05T00:00:00Z",
    });
    await member("recOld", "old@example.com", "2026-08-01T00:00:00Z", true, true);
    expect(await answer("robin@example.com", "newsletter")).toEqual([
      "yes",
      "asked",
      "2026-07-01T00:00:00.000Z",
      "member",
    ]);
    expect(await answer("lee@example.com", "newsletter")).toEqual([
      "no",
      "declined",
      "2026-07-01T00:00:00.000Z",
      "member",
    ]);
    expect(await answer("kit@example.com", "newsletter")).toEqual([
      "no",
      "not-opted-in",
      "2026-05-01T00:00:00.000Z",
      "member",
    ]);
    // CiviCRM returns Jane, so its list is the answer, not her record's box.
    expect((await answer("jane@example.com", "newsletter"))?.slice(0, 2)).toEqual(["no", "unsubscribed"]);
    expect(await answer("gil@example.com", "newsletter")).toEqual([
      "no",
      "left",
      "2026-11-05T00:00:00.000Z",
      "civicrm",
    ]);
    expect(await answer("old@example.com", "newsletter")).toEqual(["no", "left", "2026-08-01T00:00:00.000Z", "member"]);
  });

  it("emails about events the calendar's contacts, however long ago they joined, not those who unsubscribed or never were", async () => {
    await luma("follower@example.com", "2026-09-01T00:00:00Z");
    await luma("left@example.com", "2026-09-01T00:00:00Z");
    await optOut("left@example.com", "2026-10-01T00:00:00Z");
    await luma("back@example.com", "2026-09-01T00:00:00Z");
    await optOut("back@example.com", "2026-10-01T00:00:00Z", { resubscribedAt: "2026-10-05T00:00:00Z" });
    await luma("guest@example.com", null);
    expect(await answer("follower@example.com", "events")).toEqual([
      "yes",
      "following",
      "2026-09-01T00:00:00.000Z",
      "luma",
    ]);
    expect(await answer("left@example.com", "events")).toEqual([
      "no",
      "unsubscribed",
      "2026-10-01T00:00:00.000Z",
      "luma-webhook",
    ]);
    expect((await answer("back@example.com", "events"))?.slice(0, 2)).toEqual(["yes", "following"]);
    expect(await answer("guest@example.com", "events")).toEqual(["no", "not-following", null, "luma"]);
  });

  it("gives a Luma number its account's answer for events by text, and texts the march's numbers until its day ends", async () => {
    await luma("pat@example.com", "2026-09-20T00:00:00Z");
    await lumaGuest("pat@example.com", "07700 900020");
    await luma("tom@example.com", "2026-09-20T00:00:00Z");
    await lumaGuest("tom@example.com", "+447700900021");
    await optOut("tom@example.com", "2026-10-23T00:00:00Z");
    await luma("never@example.com", null);
    await lumaGuest("never@example.com", "+447700900022");
    expect(await phoneAnswer("+447700900020", "events")).toEqual([
      "yes",
      "following",
      "2026-09-20T00:00:00.000Z",
      "luma",
    ]);
    expect(await phoneAnswer("+447700900021", "events")).toEqual([
      "no",
      "unsubscribed",
      "2026-10-23T00:00:00.000Z",
      "luma",
    ]);
    expect(await phoneAnswer("+447700900022", "events")).toEqual(["no", "not-following", null, "luma"]);
    expect(await phoneAnswer("+447700900020", "events", "call")).toBeUndefined();

    // A number for texts on the day, and the day over for another form.
    await query("INSERT INTO day_texts (form, ends_at) VALUES ('paper-signup', now() - interval '1 day')");
    await query("UPDATE day_texts SET ends_at = now() + interval '1 day' WHERE form = 'march-2026-11'");
    await formEntry("m@example.com", "march-2026-11", "+447700900023", false, "2026-11-01T00:00:00Z");
    await formEntry("p@example.com", "paper-signup", "+447700900024", false, "2026-11-01T00:00:00Z");
    expect(await phoneAnswer("+447700900023", "events")).toEqual([
      "yes",
      "gave-number",
      "2026-11-01T00:00:00.000Z",
      "march-2026-11",
    ]);
    expect(await phoneAnswer("+447700900024", "events")).toEqual(["no", "ended", expect.any(String), "paper-signup"]);
  });

  it("texts the newsletter to a number given with a ticked box on a form whose box covers texts", async () => {
    await formEntry("m@example.com", "march-2026-11", "+447700900030", true, "2026-11-01T00:00:00Z");
    await formEntry("d@example.com", "march-2026-11", "+447700900031", false, "2026-11-01T00:00:00Z");
    await formEntry("l@example.com", "email-your-mp", "+447700900032", true, "2026-11-01T00:00:00Z");
    expect(await phoneAnswer("+447700900030", "newsletter")).toEqual([
      "yes",
      "asked",
      "2026-11-01T00:00:00.000Z",
      "march-2026-11",
    ]);
    expect((await phoneAnswer("+447700900031", "newsletter"))?.slice(0, 2)).toEqual(["no", "declined"]);
    expect(await phoneAnswer("+447700900032", "newsletter")).toBeUndefined();
    expect(await phoneAnswer("+447700900030", "newsletter", "call")).toBeUndefined();
  });

  it("emails about volunteering CiviCRM's volunteer list, and texts and calls volunteers' numbers but for CiviCRM's flags", async () => {
    await civicrm("jane@example.com", "2026-11-01T00:00:00Z", { volunteer: "subscribed" });
    await civicrm("kit@example.com", "2026-11-01T00:00:00Z", { volunteer: "unsubscribed" });
    await optOut("kit@example.com", "2026-11-01T00:00:00Z", { list: "volunteering", source: "civicrm" });
    expect((await answer("jane@example.com", "volunteering"))?.slice(0, 2)).toEqual(["yes", "subscribed"]);
    expect((await answer("kit@example.com", "volunteering"))?.slice(0, 2)).toEqual(["no", "unsubscribed"]);

    await member("recV", "v@example.com", "2026-09-12T00:00:00Z", false, false, "+447700900040", "Volunteer");
    await member("recT", "t@example.com", "2025-06-06T00:00:00Z", false, false, "07700 900041", null);
    await member("recL", "l@example.com", "2026-09-12T00:00:00Z", false, false, "+447700900042", "Lead");
    await member("recR", "r@example.com", "2026-09-12T00:00:00Z", false, true, "+447700900043", "Volunteer");
    await member("recS", "s@example.com", "2026-09-12T00:00:00Z", false, false, "+447700900044", "Volunteer");
    await civicrm("s@example.com", "2026-11-01T00:00:00Z", { airtableId: "recS", flags: { do_not_sms: true } });
    await member("recP", "p@example.com", "2026-09-12T00:00:00Z", false, false, "+447700900045", "Volunteer");
    await civicrm("p@example.com", "2026-11-01T00:00:00Z", { airtableId: "recP", flags: { do_not_phone: true } });
    await member("recG", "g@example.com", "2026-09-12T00:00:00Z", false, false, "+447700900046", "Volunteer");
    await civicrm("g@example.com", "2026-11-01T00:00:00Z", { airtableId: "recG", gone: "2026-11-02T00:00:00Z" });
    for (const way of ["text", "call"] as const) {
      expect(await phoneAnswer("+447700900040", "volunteering", way)).toEqual([
        "yes",
        "volunteered",
        "2026-09-12T00:00:00.000Z",
        "member",
      ]);
      // Before the join form asked, no intent was the Tally form's volunteers.
      expect((await phoneAnswer("+447700900041", "volunteering", way))?.slice(0, 2)).toEqual(["yes", "volunteered"]);
      expect((await phoneAnswer("+447700900042", "volunteering", way))?.slice(0, 2)).toEqual(["no", "not-volunteer"]);
      expect(await phoneAnswer("+447700900043", "volunteering", way)).toEqual([
        "no",
        "left",
        expect.any(String),
        "member",
      ]);
      expect(await phoneAnswer("+447700900046", "volunteering", way)).toEqual([
        "no",
        "left",
        "2026-11-02T00:00:00.000Z",
        "civicrm",
      ]);
    }
    // Do not SMS stops texts only, Do not phone calls only.
    expect(await phoneAnswer("+447700900044", "volunteering", "text")).toEqual([
      "no",
      "do-not-sms",
      "2026-11-01T00:00:00.000Z",
      "civicrm",
    ]);
    expect((await phoneAnswer("+447700900044", "volunteering", "call"))?.slice(0, 1)).toEqual(["yes"]);
    expect(await phoneAnswer("+447700900045", "volunteering", "call")).toEqual([
      "no",
      "do-not-phone",
      "2026-11-01T00:00:00.000Z",
      "civicrm",
    ]);
    expect((await phoneAnswer("+447700900045", "volunteering", "text"))?.slice(0, 1)).toEqual(["yes"]);
  });

  it("lists each opt-out that's the answer now, and finds whether any consent lets us use a number", async () => {
    await luma("gone@example.com", "2026-09-20T00:00:00Z");
    await lumaGuest("gone@example.com", "+447700900031");
    await optOut("gone@example.com", "2026-10-23T00:00:00Z");
    await optOut("blocked@example.com", "2026-10-23T00:00:00Z");
    await block("blocked@example.com", "hard", "2026-10-24T00:00:00Z");
    await optOut("+447700900050", "2026-10-23T00:00:00Z", { list: "newsletter", way: "text", source: "civicrm" });
    expect(await query("SELECT way, topic, address, source FROM contact_unsubscribes ORDER BY address")).toEqual([
      { way: "text", topic: "newsletter", address: "+447700900050", source: "civicrm" },
      { way: "email", topic: "events", address: "gone@example.com", source: "luma-webhook" },
    ]);
    await member("recV", "v@example.com", "2026-09-12T00:00:00Z", false, false, "+447700900030", "Volunteer");
    const usable = async (number: string) =>
      (await query<{ ok: boolean }>("SELECT phone_usable($1) AS ok", [number]))[0].ok;
    expect(await usable("+447700900030")).toBe(true);
    expect(await usable("+447700900031")).toBe(false);
    expect(await usable("+447700900099")).toBe(false);
  });

  it("writes numbers the same way, however they were typed", async () => {
    const written = async (raw: string | null) =>
      (await query<{ n: string | null }>("SELECT phone_number($1) AS n", [raw]))[0].n;
    for (const raw of ["07700 900123", "+44 (0)7700 900123", "0044 7700-900123", "447700900123", "+447700900123"]) {
      expect(await written(raw)).toBe("+447700900123");
    }
    expect(await written("+1 (555) 000-0000")).toBe("+15550000000");
    // One that can't be read as a number is kept as typed, trimmed; a blank is none.
    expect(await written(" ext. 12 ")).toBe("ext. 12");
    expect(await written("  ")).toBeNull();
    expect(await written(null)).toBeNull();
  });
});
