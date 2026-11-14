import "server-only";
import { emailSettingsCopy, settingsDate } from "@/lib/content/email-settings";
import { NOTICE_DAYS, sendBulkNotice } from "./email-settings";
import { createHash } from "node:crypto";
import { now } from "@/lib/now";
import {
  readSignupFile,
  signupEventColumns,
  signupRows,
  type SignupFileRead,
  type SignupPlan,
  type SignupPlanRow,
  type SignupRow,
  type SignupUploadInput,
} from "./signup-csv";
import { logChange } from "@/lib/server/audit";
import { config } from "@/lib/server/config";
import { query, transaction } from "@/lib/server/db";
import { startLumaImport } from "@/lib/server/outside-services/netlify-functions";
import { addLumaGuests } from "@/lib/server/outside-services/luma-guests";
import { refreshSupportersList } from "./facts";
import { lookUpPlaces } from "./places";
import { linkSupporters } from "./records";

// Uploading a CSV of paper sign-ups: what it would do, for the preview, and
// doing it. Each person becomes a form entry, and with a yes for the upload's
// event, a guest on Luma. Nothing is kept of the file but its name.
// docs/domain-concepts.md, "Form entries".

/** An event a file can sign people up for: one to come, on a calendar we manage. */
export type SignupEventChoice = { id: string; name: string; startAt: Date; url: string };

/** The events a file can sign people up for, soonest first. */
export async function signupEventChoices(): Promise<SignupEventChoice[]> {
  return query<SignupEventChoice>(
    `SELECT id, name, start_at AS "startAt", url FROM luma_events
     WHERE access = 'manage' AND removed_at IS NULL AND start_at >= $1 ORDER BY start_at, id`,
    [now()],
  );
}

/** The time a paper entry is dated: midday on the date on the forms, which says the day and no more. */
function entryTime(signedOn: string): string {
  return `${signedOn}T12:00:00Z`;
}

/** Why a file can't be previewed: it can't be read, or what the form chose doesn't fit it. */
export type SignupUploadRefused = Extract<SignupFileRead, { ok: false }> | { ok: false; reason: "bad-choice" };

/** What's held of the people in a file, by email and by mobile. */
async function whatWeHold(rows: SignupRow[], input: SignupUploadInput) {
  const emails = rows.map((row) => row.email);
  const phones = rows.flatMap((row) => (row.phone ? [row.phone] : []));
  const lower = async (sql: string, values: unknown[]) =>
    new Set((await query<{ email: string }>(sql, values)).map((row) => row.email));
  const [known, blocked, entered, going, numbers, holds] = await Promise.all([
    lower("SELECT DISTINCT email FROM supporter_identity WHERE email = ANY($1::text[])", [emails]),
    lower("SELECT address AS email FROM email_blocks WHERE address = ANY($1::text[])", [emails]),
    lower(
      `SELECT DISTINCT lower(trim(email)) AS email FROM form_entries
       WHERE form = 'paper-signup' AND lower(trim(email)) = ANY($1::text[]) AND created_at = $2`,
      [emails, entryTime(input.signedOn)],
    ),
    lower(
      `SELECT p.email FROM luma_guests g JOIN luma_people p USING (user_id)
       WHERE g.event_id = $1 AND g.removed_at IS NULL AND g.approval_status <> 'declined' AND p.email = ANY($2::text[])
       UNION
       SELECT lower(trim(f.email)) FROM form_entry_luma l JOIN form_entries f ON f.id = l.entry_id
       WHERE l.event_id = $1 AND l.status = 'added' AND lower(trim(f.email)) = ANY($2::text[])`,
      [input.eventId, emails],
    ),
    query<{ given: string; number: string; held: boolean }>(
      `SELECT given, phone_number(given) AS number, EXISTS (
         SELECT 1 FROM supporter_contact c WHERE phone_number(c.phone) = phone_number(given)
       ) AS held FROM unnest($1::text[]) given`,
      [phones],
    ),
    // What stops all bulk email to each, which a new entry's yes can't get past, and whether they've had a notice of it lately.
    query<{ email: string; reason: string; noticed: boolean }>(
      `SELECT e.email, d.reason, EXISTS (
           SELECT 1 FROM email_sends s WHERE s.purpose = 'bulk-notice' AND s.address = e.email
             AND s.at > now() - make_interval(days => $2)) AS noticed
       FROM unnest($1::text[]) e (email)
         CROSS JOIN LATERAL contact_permission('newsletter', 'email', e.email) d
       WHERE d.reason IN ('no-bulk-email', 'do-not-email')`,
      [emails, NOTICE_DAYS],
    ),
  ]);
  const notices = new Map(
    holds
      .filter((hold) => hold.reason !== "no-bulk-email" || !hold.noticed)
      .map((hold) => [hold.email, hold.reason === "no-bulk-email" ? ("bulk" as const) : ("no-email" as const)]),
  );
  return { known, blocked, entered, going, numbers, notices };
}

/**
 * What a file would do: each person's pile, and how they're known already.
 * Two people on one UK mobile are merged wherever they're seen (supporters.ts),
 * so a later row on the same one is known by it, as is any on a number we hold.
 */
export async function planSignupUpload(input: SignupUploadInput): Promise<SignupPlan | SignupUploadRefused> {
  const file = readSignupFile(input.csv);
  if (!file.ok) return file;
  const fits =
    /^\d{4}-\d{2}-\d{2}$/.test(input.signedOn) &&
    !Number.isNaN(Date.parse(input.signedOn)) &&
    (input.eventId ? Boolean(input.eventColumn && signupEventColumns(file).includes(input.eventColumn)) : true);
  const events = input.eventId ? await signupEventChoices() : [];
  const event = events.find((choice) => choice.id === input.eventId);
  if (!fits || (input.eventId && !event)) return { ok: false, reason: "bad-choice" };

  const read = signupRows(file, input.eventId ? input.eventColumn : null);
  const held = await whatWeHold(read, input);
  const seen = new Set(held.numbers.filter((n) => n.held).map((n) => n.number));
  const rows = read.map((row): SignupPlanRow => {
    const problem = row.problem ?? (held.blocked.has(row.email) ? ({ kind: "blocked" } as const) : null);
    const number = held.numbers.find((n) => n.given === row.phone)?.number;
    const byMobile = Boolean(number?.startsWith("+447") && seen.has(number));
    if (!problem && number) seen.add(number);
    const registers = row.going && !held.going.has(row.email);
    const action = registers ? "register" : row.going ? "going" : "none";
    const entered = held.entered.has(row.email);
    return {
      ...row,
      problem,
      pile: problem ? "held" : !registers && entered ? "done" : action,
      known: held.known.has(row.email) ? "email" : byMobile ? "mobile" : null,
      newEntry: !problem && !entered,
      notice: !problem && !entered ? (held.notices.get(row.email) ?? null) : null,
    };
  });
  const plan = { input, eventName: event?.name ?? null, rows };
  return {
    ...plan,
    signature: createHash("sha256")
      .update(JSON.stringify([input.csv, input.eventId, input.eventColumn, input.signedOn, rows]))
      .digest("hex"),
  };
}

/** What finishing a file came to: its upload's ID; or that it can no longer go in as shown, with what it would do now. */
export type SignupUploadFinished = { uploadId: number } | { changed: SignupPlan } | SignupUploadRefused;

/**
 * Does what the preview said, if `signature` says it would still do the same:
 * the form entries and their supporters together, then Luma, whose answers are
 * kept as they come. An entry already there that Luma didn't take moves to this
 * upload, whose registering it is now.
 */
export async function finishSignupUpload(
  input: SignupUploadInput,
  signature: string,
  by: string,
): Promise<SignupUploadFinished> {
  const plan = await planSignupUpload(input);
  if ("ok" in plan) return plan;
  // The note says where the forms came from, on everyone's history, so nothing goes in without one.
  if (!input.note.trim()) return { ok: false, reason: "bad-choice" };
  if (plan.signature !== signature) return { changed: plan };

  const fresh = plan.rows.filter((row) => row.newEntry);
  const registering = plan.rows.filter((row) => row.pile === "register");
  const heldBack = plan.rows.filter((row) => row.pile === "held").length;
  const { uploadId, entries } = await transaction(async (db) => {
    const [{ id }] = await query<{ id: number }>(
      `INSERT INTO signup_uploads (filename, signed_on, note, event_id, imported, held_back, uploaded_by, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id::int AS id`,
      [input.filename, input.signedOn, input.note.trim(), input.eventId, fresh.length, heldBack, by, now()],
      db,
    );
    const added = await query<{ id: number; email: string }>(
      `INSERT INTO form_entries (form, created_at, name, email, phone, postcode, contact_consent)
       SELECT 'paper-signup', $1, *, true FROM unnest($2::text[], $3::text[], $4::text[], $5::text[])
       RETURNING id::int AS id, email`,
      [
        entryTime(input.signedOn),
        fresh.map((row) => row.name),
        fresh.map((row) => row.email),
        fresh.map((row) => row.phone),
        fresh.map((row) => row.postcode),
      ],
      db,
    );
    const earlier = await query<{ id: number; email: string }>(
      `SELECT id::int AS id, email FROM form_entries
       WHERE form = 'paper-signup' AND created_at = $1 AND email = ANY($2::text[]) AND NOT id = ANY($3::bigint[])`,
      [entryTime(input.signedOn), registering.map((row) => row.email), added.map((row) => row.id)],
      db,
    );
    const entries = [...added, ...earlier];
    // What the preview said of each, kept as it was: Luma's answer is added once it's given.
    const rowOf = new Map(plan.rows.map((row) => [row.email, row]));
    await query(
      `INSERT INTO signup_upload_entries (entry_id, upload_id, new_entry, known, luma)
       SELECT unnest($1::bigint[]), $2, unnest($3::boolean[]), unnest($4::text[]), unnest($5::text[])
       ON CONFLICT (entry_id) DO UPDATE SET upload_id = EXCLUDED.upload_id, new_entry = EXCLUDED.new_entry,
         known = EXCLUDED.known, luma = EXCLUDED.luma`,
      [
        entries.map((entry) => entry.id),
        id,
        entries.map((entry) => rowOf.get(entry.email)!.newEntry),
        entries.map((entry) => rowOf.get(entry.email)!.known),
        entries.map((entry) => (rowOf.get(entry.email)!.pile === "going" ? "going" : null)),
      ],
      db,
    );
    await linkSupporters(db);
    await refreshSupportersList(db);
    await logChange(by, "import sign-ups", { uploadId: id, imported: fresh.length, heldBack }, db);
    return { uploadId: id, entries };
  });

  if (input.eventId && registering.length > 0) {
    const statuses = await addLumaGuests(
      input.eventId,
      registering.map(({ name, email }) => ({ name, email })),
    );
    const said = entries.flatMap((entry) => {
      const status = statuses.get(entry.email);
      return status ? [{ id: entry.id, status }] : [];
    });
    await query(
      `INSERT INTO form_entry_luma (entry_id, event_id, status)
       SELECT unnest($1::bigint[]), $2, unnest($3::text[])
       ON CONFLICT (entry_id) DO UPDATE SET event_id = EXCLUDED.event_id, status = EXCLUDED.status`,
      [said.map((row) => row.id), input.eventId, said.map((row) => row.status)],
    );
    await query(
      `UPDATE signup_upload_entries u SET luma = s.status
       FROM unnest($1::bigint[], $2::text[]) AS s(entry_id, status) WHERE u.entry_id = s.entry_id`,
      [said.map((row) => row.id), said.map((row) => row.status)],
    );
    // Our copy of the event's guests, with those just registered, without waiting for the next run: its
    // guests due to be read again however lately they were (eventsDueGuests in luma-import.ts), and a run
    // started. One already going does nothing, and the next scheduled run reads them.
    await query("UPDATE luma_events SET guests_synced_at = NULL WHERE id = $1", [input.eventId]);
    await startLumaImport();
  }
  // Signing the form is joining the list, so each new entry with "No bulk emails" is told how to lift it.
  const where = emailSettingsCopy.bulkNotice.paper(
    input.note.trim(),
    settingsDate(new Date(entryTime(input.signedOn))),
  );
  const noticed = new Set(plan.rows.filter((row) => row.notice === "bulk").map((row) => row.email));
  for (const entry of entries) {
    if (noticed.has(entry.email)) await sendBulkNotice(entry.id, where);
  }
  // Their postcodes' places and MPs now, rather than at the next Luma import, which also looks up any left over.
  await lookUpPlaces();
  await refreshSupportersList();
  return { uploadId };
}

/** An upload, in the list of them. */
export type SignupUploadSummary = {
  id: number;
  filename: string;
  signedOn: string;
  note: string | null;
  eventName: string | null;
  /** The event's page on Luma. */
  eventUrl: string | null;
  imported: number;
  heldBack: number;
  uploadedBy: string;
  uploadedAt: Date;
};

/** A person an upload added. */
export type SignupUploadPerson = {
  entryId: number;
  name: string;
  email: string;
  phone: string | null;
  postcode: string | null;
  /** Whether the upload made their form entry, rather than finding it there from an earlier one of the same day's forms. */
  newEntry: boolean;
  /** How they were already a supporter when it was imported, or null if they were new. */
  known: "email" | "mobile" | null;
  /** Already going to the upload's event, or what Luma said to registering them; null if neither. */
  luma: "going" | "added" | "skipped" | "not-configured" | "failed" | null;
  supporterId: number | null;
};

const UPLOAD_COLUMNS = `u.id::int AS id, u.filename, u.signed_on::text AS "signedOn", u.note, e.name AS "eventName", e.url AS "eventUrl",
  u.imported, u.held_back AS "heldBack", u.uploaded_by AS "uploadedBy", u.uploaded_at AS "uploadedAt"`;

/** How many uploads the page lists: there's little reason to look further back. */
const UPLOADS_LISTED = 50;

/** The latest uploads, newest first. */
export async function listSignupUploads(): Promise<SignupUploadSummary[]> {
  return query<SignupUploadSummary>(
    `SELECT ${UPLOAD_COLUMNS} FROM signup_uploads u LEFT JOIN luma_events e ON e.id = u.event_id
     ORDER BY u.uploaded_at DESC, u.id DESC LIMIT $1`,
    [UPLOADS_LISTED],
  );
}

/** How long after an upload its page waits for the Luma import it started: longer than a run takes to start and go. */
const LUMA_READING_FOR = "10 minutes";

/**
 * Whether the Luma import an upload started (startLumaImport) is still to
 * read its event's guests: it registered someone, lately, on a build that can
 * start a run, and the event's guests haven't been read since.
 */
async function lumaReading(id: number): Promise<boolean> {
  if (config.localBuild || !config.cronSecret) return false;
  const [row] = await query<{ reading: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM signup_uploads u JOIN luma_events e ON e.id = u.event_id
       WHERE u.id = $1 AND u.uploaded_at > $2::timestamptz - interval '${LUMA_READING_FOR}'
         AND (e.guests_synced_at IS NULL OR e.guests_synced_at < u.uploaded_at)
         AND EXISTS (SELECT 1 FROM signup_upload_entries x WHERE x.upload_id = u.id AND x.luma = 'added')
     ) AS reading`,
    [id, now()],
  );
  return row.reading;
}

/** An upload and the people still in it, or undefined if there's no such upload. */
export async function getSignupUpload(
  id: number,
): Promise<(SignupUploadSummary & { people: SignupUploadPerson[]; lumaReading: boolean }) | undefined> {
  const [upload] = await query<SignupUploadSummary>(
    `SELECT ${UPLOAD_COLUMNS} FROM signup_uploads u LEFT JOIN luma_events e ON e.id = u.event_id WHERE u.id = $1`,
    [id],
  );
  if (!upload) return undefined;
  const people = await query<SignupUploadPerson>(
    `SELECT f.id::int AS "entryId", f.name, f.email, f.phone, f.postcode,
       u.new_entry AS "newEntry", u.known, u.luma, k.supporter_id::int AS "supporterId"
     FROM signup_upload_entries u JOIN form_entries f ON f.id = u.entry_id
       LEFT JOIN supporter_links k ON k.form_entry_id = f.id
     WHERE u.upload_id = $1 ORDER BY f.id`,
    [id],
  );
  return { ...upload, people, lumaReading: await lumaReading(id) };
}
