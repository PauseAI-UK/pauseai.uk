import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SignupPlan, SignupUploadInput } from "@/lib/signup-upload";
import { server } from "@/tests/fixtures/msw";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "./db";
import { eraseSupporter } from "./erasure";
import { linkSupporters } from "./supporters";
import {
  finishSignupUpload,
  getSignupUpload,
  listSignupUploads,
  planSignupUpload,
  signupEventChoices,
} from "./signup-uploads";

const ADD = "https://public-api.luma.com/v1/events/guests/add";
const EVENT = "evt-march";
const BY = "jo@pauseai.uk";

/** An upload of `csv`, with no event, and forms dated the same day. */
const input = (csv: string, more: Partial<SignupUploadInput> = {}): SignupUploadInput => ({
  csv,
  filename: "flyering.csv",
  eventId: null,
  eventColumn: null,
  signedOn: "2026-10-10",
  note: "Flyering",
  ...more,
});

async function event(id: string, startAt = "2099-11-21T12:00:00Z", access = "manage", removed: string | null = null) {
  await query(
    `INSERT INTO luma_events (id, name, url, start_at, access, removed_at) VALUES ($1, 'The ' || $1, $1, $2, $3, $4)`,
    [id, startAt, access, removed],
  );
}

async function guest(email: string, status = "approved", removed: string | null = null, phone: string | null = null) {
  await query("INSERT INTO luma_people (user_id, email, name) VALUES ($1, $1, $1)", [email]);
  await query(
    `INSERT INTO luma_guests (id, event_id, user_id, approval_status, registered_at, removed_at, phone)
     VALUES ($1, $2, $1, $3, now(), $4, $5)`,
    [email, EVENT, status, removed, phone],
  );
}

async function planOf(upload: SignupUploadInput): Promise<SignupPlan> {
  const plan = await planSignupUpload(upload);
  if ("ok" in plan) throw new Error(plan.reason);
  return plan;
}

/** Previews and imports a file, returning its upload's ID. */
async function imported(upload: SignupUploadInput): Promise<number> {
  const finished = await finishSignupUpload(upload, (await planOf(upload)).signature, BY);
  if (!("uploadId" in finished)) throw new Error("Not imported");
  return finished.uploadId;
}

const piles = (plan: SignupPlan) => plan.rows.map((row) => row.pile);

describeWithDatabase("uploading sign-ups", () => {
  useTestDatabase();

  beforeEach(() => vi.stubEnv("LUMA_API_KEY", "key"));
  afterEach(() => vi.unstubAllEnvs());

  it("offers only events to come, on calendars we manage, soonest first", async () => {
    await event("evt-later", "2099-12-01T12:00:00Z");
    await event(EVENT);
    await event("evt-past", "2001-01-01T12:00:00Z");
    await event("evt-theirs", "2099-11-21T12:00:00Z", "view");
    await event("evt-gone", "2099-11-21T12:00:00Z", "manage", "2026-01-01T00:00:00Z");
    expect((await signupEventChoices()).map((choice) => choice.id)).toEqual([EVENT, "evt-later"]);
    expect((await signupEventChoices())[0].url).toBe(EVENT);
  });

  it("passes on why a file can't be read", async () => {
    expect(await planSignupUpload(input(""))).toEqual({ ok: false, reason: "empty" });
    const finished = await finishSignupUpload(input(""), "x", BY);
    expect(finished).toEqual({ ok: false, reason: "empty" });
  });

  it("refuses a date or an event that doesn't fit", async () => {
    await event(EVENT);
    const csv = "Name,Email,March\na,a@example.com,Y";
    const refused = { ok: false, reason: "bad-choice" };
    expect(await planSignupUpload(input(csv, { note: "  " }))).not.toEqual(refused);
    expect(await finishSignupUpload(input(csv, { note: "  " }), "x", BY)).toEqual(refused);
    expect(await planSignupUpload(input(csv, { signedOn: "soon" }))).toEqual(refused);
    expect(await planSignupUpload(input(csv, { signedOn: "2026-99-99" }))).toEqual(refused);
    expect(await planSignupUpload(input(csv, { eventId: EVENT }))).toEqual(refused);
    expect(await planSignupUpload(input(csv, { eventId: EVENT, eventColumn: "Name" }))).toEqual(refused);
    expect(await planSignupUpload(input(csv, { eventId: "evt-none", eventColumn: "March" }))).toEqual(refused);
  });

  it("sorts people by what will happen, and names the event", async () => {
    await event(EVENT);
    await guest("going@example.com");
    await guest("waiting@example.com", "waitlist");
    await guest("declined@example.com", "declined");
    await guest("left@example.com", "approved", "2026-01-01T00:00:00Z");
    await query(
      `WITH p AS (INSERT INTO email_problems (kind, address, can_reset) VALUES ('hard', 'blocked@example.com', true) RETURNING id)
       INSERT INTO email_blocks (address, problem_id) SELECT 'blocked@example.com', id FROM p`,
    );
    await linkSupporters();
    const plan = await planOf(
      input(
        `Name,Email,March,Colour
Going,going@example.com,Y,red
Waiting,waiting@example.com,Y,
Declined,declined@example.com,Y,
Left,left@example.com,Y,
New,new@example.com,Y,
Not,not@example.com,,
Blocked,blocked@example.com,Y,
Bad,bad,Y,`,
        { eventId: EVENT, eventColumn: "March" },
      ),
    );
    expect(piles(plan)).toEqual(["going", "going", "register", "register", "register", "none", "held", "held"]);
    expect(plan.rows.map((row) => row.problem?.kind ?? null).slice(-2)).toEqual(["blocked", "bad-email"]);
    expect(plan.eventName).toBe(`The ${EVENT}`);
    expect(plan.rows[0].known).toBe("email");
    expect(plan.rows[4].known).toBeNull();
  });

  it("knows someone by a mobile we hold or an earlier row's, but not a landline's", async () => {
    await event(EVENT);
    await guest("held@example.com", "approved", null, "+447700900111");
    await linkSupporters();
    const plan = await planOf(
      input(`Name,Email,Phone
A,a@example.com,07700 900111
B,b@example.com,07700900222
C,c@example.com,+44 7700 900222
D,d@example.com,020 7946 0000
E,e@example.com,020 7946 0000`),
    );
    expect(plan.rows.map((row) => row.known)).toEqual(["mobile", null, "mobile", null, null]);
  });

  it("imports form entries, supporters and the note, with Luma's answers, and says so", async () => {
    await event(EVENT);
    await guest("going@example.com");
    await query("INSERT INTO luma_people (user_id, email, name) VALUES ('other', 'other@example.com', 'Other')");
    let sent: unknown;
    server.use(
      http.post(ADD, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ skipped: [{ email: "skip@example.com" }] });
      }),
    );
    const id = await imported(
      input(
        `Name,Email,Phone,Postcode,Town,Mailing list,March
Going,going@example.com,,,,,Y
New Person,new@example.com,07700900333,se15,Leeds,Y,Y
Skip,skip@example.com,,,,,Y
Not,not@example.com,,,,,
Bad,bad,,,,,Y`,
        { eventId: EVENT, eventColumn: "March", note: " Camden ", filename: "camden.csv" },
      ),
    );
    expect(sent).toEqual({
      event_id: EVENT,
      guests: [
        { email: "new@example.com", name: "New Person" },
        { email: "skip@example.com", name: "Skip" },
      ],
    });
    const upload = (await getSignupUpload(id))!;
    expect(upload).toMatchObject({
      filename: "camden.csv",
      signedOn: "2026-10-10",
      note: "Camden",
      eventName: `The ${EVENT}`,
      eventUrl: EVENT,
      imported: 4,
      heldBack: 1,
      uploadedBy: BY,
    });
    // What it did for each, kept as it did it.
    expect(upload.people.map((p) => [p.email, p.newEntry, p.known, p.luma, p.supporterId !== null])).toEqual([
      ["going@example.com", true, null, "going", true],
      ["new@example.com", true, null, "added", true],
      ["skip@example.com", true, null, "skipped", true],
      ["not@example.com", true, null, null, true],
    ]);
    const consents = await query<{ consent: boolean }>(
      "SELECT contact_consent AS consent FROM form_entries WHERE form = 'paper-signup' ORDER BY id",
    );
    expect(consents.map((row) => row.consent)).toEqual([true, true, true, true]);
    expect(upload.people[1]).toMatchObject({ phone: "07700900333", postcode: "SE15" });
    // Their postcode looked up at once, not left for the next Luma import.
    const [looked] = await query<{ postcode: string }>("SELECT postcode FROM postcode_places WHERE postcode = 'SE15'");
    expect(looked).toEqual({ postcode: "SE15" });

    const [entry] = await query<{ created_at: Date; city: string | null; form: string }>(
      "SELECT created_at, city, form FROM form_entries WHERE email = 'new@example.com'",
    );
    // Town is ignored, as a postcode places someone better.
    expect(entry).toMatchObject({ city: null, form: "paper-signup" });
    expect(entry.created_at.toISOString()).toBe("2026-10-10T12:00:00.000Z");

    const [line] = await query<{ detail: string; href: string; status: string; title: string }>(
      `SELECT a.detail, a.href, a.status, a.title FROM supporter_activity_form a
       JOIN form_entries f ON f.id = a.source_id WHERE f.email = 'new@example.com'`,
    );
    expect(line).toEqual({
      detail: "Camden",
      href: `/staff/supporters/import/previous/${id}`,
      status: "added",
      title: "paper-signup",
    });

    const [permission] = await query<{ send: string; source: string }>(
      "SELECT send, source FROM contact_permission('site-forms', 'phone', '+447700900333')",
    );
    expect(permission).toEqual({ send: "yes", source: "paper-signup" });

    const [logged] = await query<{ details: object }>("SELECT details FROM audit_log WHERE action = 'import sign-ups'");
    expect(logged.details).toEqual({ uploadId: id, imported: 4, heldBack: 1 });

    const [listed] = await query("SELECT id FROM supporters_list WHERE name = 'New Person'");
    expect(listed).toBeTruthy();
  });

  it("does nothing the second time, unless Luma hadn't taken them, and takes a later date as new forms", async () => {
    await event(EVENT);
    const upload = input("Name,Email,March\nJo,jo@example.com,Y", { eventId: EVENT, eventColumn: "March" });
    server.use(http.post(ADD, () => new HttpResponse("down", { status: 500 })));
    const first = await imported(upload);
    expect((await getSignupUpload(first))!.people[0]).toMatchObject({ newEntry: true, luma: "failed" });

    // Luma failed, so it's still to register, on the entry there already, which is now this upload's.
    const retry = await planOf(upload);
    expect(retry.rows[0]).toMatchObject({ pile: "register", newEntry: false });
    server.use(http.post(ADD, () => HttpResponse.json({ skipped: [] })));
    const second = await imported(upload);
    expect((await getSignupUpload(second))!.people[0]).toMatchObject({ newEntry: false, luma: "added" });
    expect((await getSignupUpload(second))!.imported).toBe(0);
    expect((await getSignupUpload(first))!.people).toEqual([]);

    const again = await planOf(upload);
    expect(again.rows[0]).toMatchObject({ pile: "done", newEntry: false });
    const later = await planOf({ ...upload, signedOn: "2026-10-11" });
    expect(later.rows[0]).toMatchObject({ pile: "going", newEntry: true });
  });

  it("does no more than say so when things changed since the preview", async () => {
    await event(EVENT);
    const upload = input("Name,Email,March\nJo,jo@example.com,Y", { eventId: EVENT, eventColumn: "March" });
    const { signature } = await planOf(upload);
    await guest("jo@example.com");
    const finished = await finishSignupUpload(upload, signature, BY);
    expect(finished).toMatchObject({ changed: { rows: [{ pile: "going" }] } });
    expect(await query("SELECT id FROM form_entries")).toEqual([]);
  });

  it("records Luma's answer for no one when no one's registering", async () => {
    const id = await imported(input("Name,Email\nJo,jo@example.com"));
    expect((await getSignupUpload(id))!.people[0]).toMatchObject({ newEntry: true, luma: null });
    expect((await getSignupUpload(id))!.eventName).toBeNull();
  });

  it("lists the newest first, and has no upload for an unknown ID", async () => {
    const first = await imported(input("Name,Email\nA,a@example.com"));
    const second = await imported(input("Name,Email\nB,b@example.com", { filename: "two.csv", note: "Two" }));
    expect((await listSignupUploads()).map((upload) => upload.id)).toEqual([second, first]);
    expect(await getSignupUpload(0)).toBeUndefined();
  });

  it("loses a person on erasure, keeping the upload's counts", async () => {
    const id = await imported(input("Name,Email\nJo,jo@example.com"));
    const { supporterId } = (await getSignupUpload(id))!.people[0];
    await eraseSupporter(supporterId!, "REQ-1", BY);
    const upload = (await getSignupUpload(id))!;
    expect(upload.people).toEqual([]);
    expect(upload.imported).toBe(1);
  });
});
