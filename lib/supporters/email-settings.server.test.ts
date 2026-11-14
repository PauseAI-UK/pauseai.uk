import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { query } from "@/lib/server/db.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { notifications } from "@/tests/notifications";
import {
  copyPage,
  emailSettingsLink,
  hashOf,
  liftNoBulk,
  linkPage,
  newNumberLink,
  newSettingsLink,
  openAddress,
  resendLink,
  saveSettings,
  sendBulkNotice,
  settingsFor,
  stopEverything,
  unsubscribeCopy,
} from "./email-settings.server";
import { addFormEntry } from "./form-entries.server";
import { recordOptOut } from "./opt-outs.server";
import { inRun } from "@/lib/server/run-store.server";
import { settingsTopics } from "./settings-view";
import { supportersCopy } from "./copy";
import { emailCopy } from "@/lib/email/copy";

const JANE = "jane.smith@example.com";
const REMOVE = "https://public-api.luma.com/v1/calendars/contacts/remove";

/**
 * Jane, who ticked the march's box and gave a number, so she has the
 * newsletter by email and text, and events by text on the day.
 */
async function jane(consent = true) {
  await addFormEntry("march-2026-11", {
    name: "Jane Smith",
    email: JANE,
    phone: "07700 900123",
    city: null,
    postcode: null,
    consent,
    utmSource: null,
  });
}

/** A copy of a broadcast to Jane, under `topics`, sent `daysAgo`: its link's token. */
async function copyTo(topics: string[], daysAgo = 1): Promise<string> {
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO mailings (title, audience, channel, topic, filter, body, created_by, state)
     VALUES ('', 'supporters', 'email', 'newsletter', '{}', '{}', 'staff@pauseai.uk', 'draft') RETURNING id::int AS id`,
  );
  await query(
    `INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status, link_token_hash, topics, sent_at)
     VALUES ($1, (SELECT min(supporter_id) FROM supporter_links), $2, 'sent', $5, $3, now() - make_interval(days => $4))`,
    [id, JANE, topics, daysAgo, hashOf(`tok-${id}`)],
  );
  return `tok-${id}`;
}

/** Each opt-out, oldest first. */
const optOuts = () =>
  query("SELECT address, list, way, source, resubscribed_at IS NULL AS open FROM opt_outs ORDER BY id");

/** Each request to Luma's Remove. */
function lumaRemoves() {
  const removed: unknown[] = [];
  server.use(
    http.post(REMOVE, async ({ request }) => {
      removed.push(await request.json());
      return HttpResponse.json({});
    }),
  );
  return removed;
}

/** Jane's address, in CiviCRM with "No bulk emails". */
async function noBulkInCivicrm() {
  await query(
    `INSERT INTO civicrm_contacts (contact_id, email, on_hold, no_bulk_email, do_not_email, do_not_phone, do_not_sms,
       newsletter, volunteer_updates, on_hold_since, no_bulk_email_since, do_not_email_since, do_not_phone_since,
       do_not_sms_since, newsletter_since, volunteer_updates_since)
     VALUES (7, $1, false, true, false, false, false, 'subscribed', 'not_on_list',
       now(), now() - interval '1 day', now(), now(), now(), now(), now())`,
    [JANE],
  );
}

afterEach(() => vi.unstubAllEnvs());

describeWithDatabase("the contact preferences page", () => {
  useTestDatabase();

  it("emails a link to an address we have, once in a few minutes, and nothing to one we don't", async () => {
    const sent = notifications();
    await jane();
    await emailSettingsLink(" Jane.Smith@example.com ");
    await emailSettingsLink(JANE);
    await emailSettingsLink("nobody@example.com");
    await emailSettingsLink("not an address");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ To: JANE, Subject: emailSettingsCopy.linkEmail.subject });
    const link = /https:\/\/pauseai\.uk\/contact-preferences\/([\w-]+)/.exec(sent[0].TextBody)![1];
    expect(await query("SELECT purpose FROM email_sends")).toEqual([{ purpose: "preferences-link" }]);
    expect(await linkPage(link)).toMatchObject({ kind: "link", unsubscribe: null, view: { address: JANE } });
    expect(await openAddress("link", link)).toBe(JANE);
  });

  it("emails an address no more than five links a day, however they're asked for", async () => {
    const sent = notifications();
    await jane();
    for (let i = 0; i < 6; i++) {
      await emailSettingsLink(JANE);
      await query("UPDATE preference_links SET created_at = created_at - interval '3 minutes'");
    }
    expect(sent).toHaveLength(5);
    await query("UPDATE preference_links SET created_at = created_at - interval '1 day'");
    await emailSettingsLink(JANE);
    expect(sent).toHaveLength(6);
  });

  it("knows an address by an opt-out of its own, or a CiviCRM contact, too", async () => {
    const sent = notifications();
    await recordOptOut({
      address: "sam@example.com",
      list: "events",
      source: "luma-webhook",
      sourceRef: "1",
      unsubscribedAt: new Date(),
    });
    await emailSettingsLink("sam@example.com");
    await noBulkInCivicrm();
    await emailSettingsLink(JANE);
    expect(sent.map((email) => email.To)).toEqual(["sam@example.com", JANE]);
  });

  it("in a fixture build, makes each link's token from the address and how many it's had", async () => {
    vi.stubEnv("DATA_FIXTURES", "1");
    const token = (seed: string) => createHash("sha256").update(seed).digest().subarray(0, 24).toString("base64url");
    expect(await newSettingsLink(" Jane.Smith@example.com")).toBe(
      `/contact-preferences/${token(`settings ${JANE} 0`)}`,
    );
    expect(await newSettingsLink(JANE)).toBe(`/contact-preferences/${token(`settings ${JANE} 1`)}`);
  });

  it("offers a fresh link once a link has run out, and has no page for a link it never made", async () => {
    const sent = notifications();
    await jane();
    const token = (await newSettingsLink(JANE)).split("/").at(-1)!;
    await query(
      "UPDATE preference_links SET expires_at = now() - interval '1 second', created_at = now() - interval '1 hour'",
    );
    expect(await linkPage(token)).toEqual({ kind: "link", token, number: false, unsubscribe: null, view: null });
    expect(await openAddress("link", token)).toBeUndefined();
    await resendLink("link", token);
    await resendLink("link", "no-such-token");
    expect(sent.map((email) => email.To)).toEqual([JANE]);
    expect(await linkPage("no-such-token")).toBeUndefined();
  });

  it("shows each topic's answer for the address and its numbers, and what holds all its email", async () => {
    await jane();
    const view = await settingsFor(JANE);
    expect(view.numbers).toEqual(["+447700900123"]);
    expect(view.hold).toBeNull();
    expect(view.answers.filter((a) => a.send === "yes").map((a) => `${a.topic}:${a.way}:${a.address}`)).toEqual([
      "newsletter:email:jane.smith@example.com",
      "newsletter:text:+447700900123",
      "events:text:+447700900123",
    ]);
    await noBulkInCivicrm();
    expect((await settingsFor(JANE)).hold).toMatchObject({ kind: "no-bulk", source: "civicrm", everything: false });
  });

  it("opens a number's page on its texts and calls alone, for a month, and saves only those", async () => {
    await jane();
    const NUMBER = "+447700900123";
    const token = (await newNumberLink(NUMBER)).split("/").at(-1)!;
    const page = await linkPage(token);
    expect(page).toMatchObject({
      kind: "link",
      number: true,
      view: { address: NUMBER, numbers: [NUMBER], hold: null },
    });
    expect(page!.view!.answers.filter((a) => a.send === "yes").map((a) => `${a.topic}:${a.way}`)).toEqual([
      "newsletter:text",
      "events:text",
    ]);
    // An email box sent with it changes nothing; the number's boxes do.
    expect(await saveSettings(NUMBER, new Set(["newsletter:email", "newsletter:text"]))).toEqual([
      { topic: "events", way: "text", on: false },
    ]);
    expect((await settingsFor(JANE)).answers.find((a) => a.way === "email" && a.topic === "newsletter")?.send).toBe(
      "yes",
    );
    // Stop everything isn't offered there, so does nothing.
    await stopEverything(NUMBER);
    expect(await optOuts()).toEqual([
      { address: NUMBER, list: "events", way: "text", source: "preferences", open: true },
    ]);
    const [{ days }] = await query<{ days: number }>(
      "SELECT round(extract(epoch FROM expires_at - created_at) / 86400)::int AS days FROM preference_links",
    );
    expect(days).toBe(30);
    await query("UPDATE preference_links SET expires_at = now() - interval '1 second'");
    expect(await linkPage(token)).toEqual({ kind: "link", token, number: true, unsubscribe: null, view: null });
  });

  it("saves ticks as yeses with their words, and unticks as opt-outs, sending ours to CiviCRM", async () => {
    await jane();
    await recordOptOut({
      address: JANE,
      list: "volunteering",
      source: "civicrm",
      sourceRef: "v",
      unsubscribedAt: new Date("2026-01-01"),
    });
    const changed = await saveSettings(JANE, new Set(["volunteering:email", "events:text", "volunteering:call"]));
    expect(changed).toEqual([
      { topic: "newsletter", way: "email", on: false },
      { topic: "newsletter", way: "text", on: false },
      { topic: "volunteering", way: "email", on: true },
      { topic: "volunteering", way: "call", on: true },
    ]);
    expect(await query("SELECT address, way, topic, wording FROM preference_choices ORDER BY id")).toEqual([
      {
        address: JANE,
        way: "email",
        topic: "volunteering",
        wording: emailSettingsCopy.wording("volunteering", "email"),
      },
      {
        address: "+447700900123",
        way: "call",
        topic: "volunteering",
        wording: emailSettingsCopy.wording("volunteering", "call"),
      },
    ]);
    // The tick closed CiviCRM's older opt-out; the unticks are opt-outs from the page.
    expect(await optOuts()).toEqual([
      { address: JANE, list: "volunteering", way: "email", source: "civicrm", open: false },
      { address: JANE, list: "newsletter", way: "email", source: "preferences", open: true },
      { address: "+447700900123", list: "newsletter", way: "text", source: "preferences", open: true },
    ]);
    expect(await query("SELECT change, list FROM civicrm_updates")).toEqual([
      { change: "unsubscribe", list: "newsletter" },
    ]);
    const answers = (await settingsFor(JANE)).answers;
    expect(answers.find((a) => a.topic === "volunteering" && a.way === "email")).toMatchObject({
      send: "yes",
      reason: "chose",
      source: "preferences",
    });
    // Saving what's there changes nothing.
    expect(await saveSettings(JANE, new Set(["volunteering:email", "events:text", "volunteering:call"]))).toEqual([]);
  });

  it("takes a text box left as it was to change none of the numbers, though one of them said no", async () => {
    await jane();
    await addFormEntry("march-2026-11", {
      name: "Jane Smith",
      email: JANE,
      phone: "07700 900456",
      city: null,
      postcode: null,
      consent: true,
      utmSource: null,
    });
    // Her second number replied STOP to the newsletter.
    await recordOptOut({
      address: "+447700900456",
      way: "text",
      list: "newsletter",
      source: "preferences",
      sourceRef: "stop",
      unsubscribedAt: new Date(),
    });
    const ticks = ["newsletter:email", "newsletter:text", "events:text"];
    expect(await saveSettings(JANE, new Set([...ticks, "volunteering:email"]))).toEqual([
      { topic: "volunteering", way: "email", on: true },
    ]);
    const newsletterText = async () =>
      (await settingsFor(JANE)).answers
        .filter((a) => a.topic === "newsletter" && a.way === "text")
        .map((a) => [a.address, a.send])
        .sort();
    expect(await newsletterText()).toEqual([
      ["+447700900123", "yes"],
      ["+447700900456", "no"],
    ]);
    // Unticking it opts out the number that had a yes; ticking it again is a yes for both.
    await saveSettings(JANE, new Set(["newsletter:email", "events:text"]));
    expect((await newsletterText()).map(([, send]) => send)).toEqual(["no", "no"]);
    await saveSettings(JANE, new Set(ticks));
    expect((await newsletterText()).map(([, send]) => send)).toEqual(["yes", "yes"]);
  });

  it("takes the address off the Luma calendar when events by email goes off, on the live site only", async () => {
    const removed = lumaRemoves();
    vi.stubEnv("LUMA_API_KEY", "k");
    await query("INSERT INTO luma_people (user_id, email, name, contact_since) VALUES ('usr-1', $1, 'Jane', now())", [
      JANE,
    ]);
    await saveSettings(JANE, new Set());
    expect(removed).toEqual([]);
    await query("DELETE FROM opt_outs");
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    await saveSettings(JANE, new Set());
    expect(removed).toEqual([{ email: JANE }]);
  });

  it("reports Luma failing to remove someone, and records their opt-out all the same", async () => {
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    vi.stubEnv("LUMA_API_KEY", "k");
    server.use(http.post(REMOVE, () => new HttpResponse("Down", { status: 500 })));
    await query("INSERT INTO luma_people (user_id, email, name, contact_since) VALUES ('usr-1', $1, 'Jane', now())", [
      JANE,
    ]);
    const problems = await inRun(async (run) => {
      await saveSettings(JANE, new Set());
      return run.problems;
    });
    expect(problems).toEqual([
      { what: supportersCopy.problems.lumaRemoveFailed, error: "Luma answered 500 for /v1/calendars/contacts/remove" },
    ]);
    expect(await optOuts()).toEqual([
      { address: JANE, list: "events", way: "email", source: "preferences", open: true },
    ]);
  });

  it("changes no email while all its email is held, and lifts “No bulk emails” only while it's what holds it", async () => {
    await jane();
    expect(await liftNoBulk(JANE)).toBe(false);
    await noBulkInCivicrm();
    await recordOptOut({
      address: JANE,
      list: "bulk",
      source: "postmark-complaint",
      sourceRef: "1",
      unsubscribedAt: new Date(),
    });
    expect(await saveSettings(JANE, new Set(["newsletter:text", "events:text"]))).toEqual([]);
    expect(await liftNoBulk(JANE)).toBe(true);
    expect(await query("SELECT topic, wording FROM preference_choices")).toEqual([
      { topic: "bulk", wording: emailSettingsCopy.noBulk.wording },
    ]);
    expect(await query("SELECT change, wording FROM civicrm_updates ORDER BY id")).toEqual([
      { change: "no_bulk_email", wording: null },
      { change: "allow_bulk_email", wording: emailSettingsCopy.noBulk.wording },
    ]);
    // Neither CiviCRM's flag, older than the lift, nor our opt-out, closed, holds it now.
    expect((await settingsFor(JANE)).hold).toBeNull();
    // CiviCRM refusing the lift puts its flag back.
    await query("UPDATE preference_choices SET refused_at = now()");
    expect((await settingsFor(JANE)).hold).toMatchObject({ kind: "no-bulk" });
  });

  it("stops everything: every bulk email, every text and call to each number, for CiviCRM, and the Luma calendar", async () => {
    const removed = lumaRemoves();
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    vi.stubEnv("LUMA_API_KEY", "k");
    await jane();
    await stopEverything(JANE);
    expect(await optOuts()).toEqual([
      { address: JANE, list: "bulk", way: "email", source: "preferences", open: true },
      { address: "+447700900123", list: "all", way: "text", source: "preferences", open: true },
      { address: "+447700900123", list: "all", way: "call", source: "preferences", open: true },
    ]);
    expect(await query("SELECT change FROM civicrm_updates ORDER BY id")).toEqual([
      { change: "no_bulk_email" },
      { change: "do_not_sms" },
      { change: "do_not_phone" },
    ]);
    // Every text and call, those it had no yes for too, and any yes that comes later.
    await query(
      "INSERT INTO preference_choices (address, way, topic, wording) VALUES ('+447700900123', 'text', 'volunteering', 'w')",
    );
    const sends = await query<{ consent: string; send: string }>(
      `SELECT c.topic || ':' || c.way AS consent, d.send
       FROM (VALUES ('newsletter', 'text'), ('events', 'text'), ('volunteering', 'text'), ('volunteering', 'call')) c (topic, way)
       CROSS JOIN LATERAL contact_permission(c.topic, c.way, '+447700900123') d`,
    );
    expect(sends.map((row) => row.send)).toEqual(["no", "no", "no", "no"]);
    // The page locks those boxes, as Restart is what lifts them.
    expect(
      settingsTopics(await settingsFor(JANE)).flatMap((t) =>
        t.boxes.filter((b) => b.way !== "email").map((b) => b.locked),
      ),
    ).toEqual([true, true, true, true]);
    expect(removed).toEqual([{ email: JANE }]);
    expect((await settingsFor(JANE)).hold).toMatchObject({ kind: "no-bulk", source: "preferences", everything: true });
  });

  it("undoes Stop everything in full by Restart: bulk email, texts and calls, and no other opt-out", async () => {
    lumaRemoves();
    await jane();
    // Her own untick of events by text, before she stopped everything, stays.
    await saveSettings(JANE, new Set(["newsletter:email", "newsletter:text"]));
    await stopEverything(JANE);
    expect(await liftNoBulk(JANE)).toBe(true);
    expect(await optOuts()).toEqual([
      { address: "+447700900123", list: "events", way: "text", source: "preferences", open: true },
      { address: JANE, list: "bulk", way: "email", source: "preferences", open: false },
      { address: "+447700900123", list: "all", way: "text", source: "preferences", open: false },
      { address: "+447700900123", list: "all", way: "call", source: "preferences", open: false },
    ]);
    expect(await query("SELECT wording FROM preference_choices WHERE topic = 'bulk'")).toEqual([
      { wording: emailSettingsCopy.stopped.wording },
    ]);
    const view = await settingsFor(JANE);
    expect(view.hold).toBeNull();
    expect(view.answers.filter((a) => a.send === "yes").map((a) => `${a.topic}:${a.way}`)).toEqual([
      "newsletter:email",
      "newsletter:text",
    ]);
  });

  it("emails someone who ticked a box but has “No bulk emails” how to lift it, once, and nobody else", async () => {
    const sent = notifications();
    await jane();
    await jane(false);
    const [ticked, unticked] = (await query<{ id: number }>("SELECT id::int AS id FROM form_entries ORDER BY id")).map(
      (r) => r.id,
    );
    expect(await sendBulkNotice(ticked, "the march")).toBe(false);
    await noBulkInCivicrm();
    expect(await sendBulkNotice(unticked, "the march")).toBe(false);
    expect(await sendBulkNotice(ticked, "the march")).toBe(true);
    expect(await sendBulkNotice(ticked, "the march")).toBe(false);
    // Signing up again within thirty days brings no second notice; after, it does.
    await jane();
    const [{ again }] = await query<{ again: number }>("SELECT max(id)::int AS again FROM form_entries");
    expect(await sendBulkNotice(again, "the march")).toBe(false);
    await query("UPDATE form_entries SET bulk_notice_at = NULL WHERE id = $1", [again]);
    await query("UPDATE email_sends SET at = at - interval '31 days'");
    expect(await sendBulkNotice(again, "the march")).toBe(true);
    expect(sent).toHaveLength(2);
    sent.pop();
    expect(sent).toEqual([
      expect.objectContaining({
        To: JANE,
        Subject: emailSettingsCopy.bulkNotice.subject,
        TextBody: expect.stringMatching(/the march[\s\S]*https:\/\/pauseai\.uk\/contact-preferences\/[\w-]+/),
      }),
    ]);
    expect(await query("SELECT DISTINCT purpose FROM email_sends")).toEqual([{ purpose: "bulk-notice" }]);
  });

  it("reports a notice that fails, rather than failing the sign-up it follows", async () => {
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    await inRun(async (run) => {
      // An entry ID the database can't read, so its query fails.
      expect(await sendBulkNotice("x" as unknown as number, "the march")).toBe(false);
      expect(run.problems.map((p) => p.what)).toEqual([emailCopy.problems.sendFailed("bulk-notice")]);
    });
  });

  it("sends no notice from a build that doesn't know its own address", async () => {
    await jane();
    await noBulkInCivicrm();
    vi.stubEnv("SITE_ORIGIN", "");
    expect(await sendBulkNotice(1, "the march")).toBe(false);
    expect(await query("SELECT bulk_notice_at FROM form_entries")).toEqual([{ bulk_notice_at: null }]);
  });

  it("unsubscribes by an email's link forever, though its page works for thirty days", async () => {
    const removed = lumaRemoves();
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    vi.stubEnv("LUMA_API_KEY", "k");
    await jane();
    const fresh = await copyTo(["newsletter"]);
    const old = await copyTo(["events"], 40);
    expect(await copyPage(fresh)).toMatchObject({ kind: "copy", unsubscribe: ["newsletter"], view: { address: JANE } });
    expect(await copyPage(old)).toMatchObject({ unsubscribe: ["events"], view: null });
    expect(await openAddress("copy", old)).toBeUndefined();
    expect(await openAddress("copy", fresh)).toBe(JANE);
    expect(await unsubscribeCopy(fresh, "link")).toBe(true);
    expect(await unsubscribeCopy(fresh, "link")).toBe(true);
    expect(await unsubscribeCopy(old, "list-unsubscribe")).toBe(true);
    expect(await unsubscribeCopy("no-such-copy", "link")).toBe(false);
    expect(await copyPage("no-such-copy")).toBeUndefined();
    // Ticking the newsletter again on the page, then the same email's button: unsubscribed again.
    await saveSettings(JANE, new Set(["newsletter:email", "newsletter:text", "events:text"]));
    expect(await unsubscribeCopy(fresh, "link")).toBe(true);
    expect(
      await query(
        "SELECT list, source, message_id IS NOT NULL AS copy, resubscribed_at IS NULL AS open FROM opt_outs ORDER BY id",
      ),
    ).toEqual([
      { list: "newsletter", source: "link", copy: true, open: false },
      { list: "events", source: "list-unsubscribe", copy: true, open: true },
      { list: "newsletter", source: "link", copy: true, open: true },
    ]);
    expect(removed).toEqual([{ email: JANE }]);
    const sent = notifications();
    await resendLink("copy", old);
    expect(sent.map((email) => email.To)).toEqual([JANE]);
  });
});
