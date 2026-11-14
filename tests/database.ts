// A Postgres database for each test file that needs one, a copy of the
// migrated template (tests/vitest.global-setup.node.ts). See docs/testing.md.
import { afterAll, beforeAll, beforeEach, describe, inject, onTestFinished, vi } from "vitest";
import { closeDb, query } from "@/lib/server/db";
import { encryptToken } from "@/lib/accounts/gmail-tokens";
import { copyDatabase, databaseUrl, dropDatabase, freshDatabase } from "@/scripts/fresh-database.mjs";

/**
 * describe() for tests that need the database. Netlify's build runs the unit
 * tests with no Postgres, so they're skipped there; CI and local machines
 * have one, and run them.
 */
export const describeWithDatabase = describe.skipIf(process.env.NETLIFY === "true");

/**
 * Options for a test that makes or drops databases itself, in psql, or
 * applies a migration and every one after it with migrate(), slower with each
 * migration added. Under a second or two alone, but over 6s has been seen
 * while every other test file makes its database on a loaded machine, past
 * the 5s default.
 */
export const MAKES_DATABASES = { timeout: 30_000 };

/**
 * The time a hook that makes or drops a test file's database is given. Over
 * 30s has been seen dropping one with several storyboards' builds and test
 * runs alongside, on a machine loaded to four times its cores.
 */
const DATABASE_HOOK = 60_000;

/**
 * The tables not truncated before each test: those whose rows the migrations
 * seed, which tests read and leave alone (the asks and campaigns, their
 * statuses and the day's text), and two emptied by a DELETE instead: the
 * mailings, of only those a test wrote, and the message templates, as
 * truncating them would take the imported mailings that refer to them. Every
 * other table in the database is truncated.
 */
const SEEDED = ["ask_kind_statuses", "asks", "campaigns", "day_texts", "mailings", "whatsapp_templates"];

/**
 * Gives this test file its own database, empty before each test: a copy of
 * the migrated template made once for the run (tests/vitest.global-setup.node.ts).
 * Call at the top of a describeWithDatabase block.
 */
export function useTestDatabase() {
  const name = `test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const original = process.env.NETLIFY_DB_URL;
  let tables = "";

  beforeAll(async () => {
    copyDatabase(name, inject("templateDatabase"));
    process.env.NETLIFY_DB_URL = databaseUrl(name);
    const rows = await query<{ name: string }>(
      "SELECT quote_ident(tablename) AS name FROM pg_tables WHERE schemaname = 'public' AND NOT tablename = ANY($1) ORDER BY 1",
      [SEEDED],
    );
    tables = rows.map((row) => row.name).join(", ");
  }, DATABASE_HOOK);
  beforeEach(async () => {
    await query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
    // The mailings written here; the imported ones come with the migrations.
    await query("DELETE FROM mailings WHERE body IS NOT NULL");
    await query("DELETE FROM whatsapp_templates");
    // The kept supporters list, emptied with the tables it's made from.
    await query("REFRESH MATERIALIZED VIEW supporters_list");
  });
  afterAll(async () => {
    await closeDb();
    dropDatabase(name);
    process.env.NETLIFY_DB_URL = original;
  }, DATABASE_HOOK);
}

/**
 * Gives this test file a database with only the migrations up to `upTo`
 * ("0012") applied, so a test can fill the old tables, then apply the next
 * migration with migrate() and see what it did. Returns the database's URL.
 */
export function useDatabaseUpTo(upTo: string): { url: string } {
  const name = `test_${process.pid}_upto_${upTo}`;
  const original = process.env.NETLIFY_DB_URL;
  const db = { url: "" };
  beforeAll(async () => {
    await closeDb();
    db.url = process.env.NETLIFY_DB_URL = freshDatabase(name, { upTo });
  }, DATABASE_HOOK);
  afterAll(async () => {
    await closeDb();
    dropDatabase(name);
    process.env.NETLIFY_DB_URL = original;
  }, DATABASE_HOOK);
  return db;
}

type MpRow = {
  airtableId?: string | null;
  house?: string;
  name?: string;
  salutation?: string;
  constituency?: string | null;
  party?: string;
  email?: string | null;
  /** Makes them a test MP, found by this postcode. */
  testPostcode?: string;
  status?: string;
};

/** The asks the migrations add, which tests leave in place while deleting those they added. */
export const MIGRATION_ASKS = [
  "frontier-ai-letter",
  "deepmind-letter",
  "controlai-statement",
  "controlai-letter",
  "edinburgh-conference-2026",
  "go-to-parliament-oct-2026",
];

/** Adds a politician straight into the tables, and returns their ID. */
export async function addTestPolitician(row: MpRow = {}): Promise<number> {
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO notable_people (kind, airtable_id, name, salutation, email, status)
     VALUES ('politician', $1, $2, $3, $4, $5) RETURNING id::int AS id`,
    [
      row.airtableId === undefined ? "recPlaceholder" : row.airtableId,
      row.name ?? "Polly Placeholder",
      row.salutation ?? "Ms Placeholder",
      row.email === undefined ? "polly.placeholder.mp@parliament.uk" : row.email,
      row.status ?? "in_office",
    ],
  );
  await query(
    `INSERT INTO politicians (id, house, constituency, party, is_test, test_postcode) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      row.house ?? "commons",
      row.constituency === undefined ? "Cities of London and Westminster" : row.constituency,
      row.party ?? "Labour (Co-op)",
      row.testPostcode !== undefined,
      row.testPostcode ?? null,
    ],
  );
  return id;
}

/** A letter from a supporter, straight into the tables: its row, and its sender's form entry. Returns its ID. */
export async function addTestLetter(letter: {
  politicianId: number;
  campaign?: string;
  status?: string;
  senderName?: string;
  senderEmail?: string;
  senderPostcode?: string;
  contactConsent?: boolean;
  subject?: string;
  postmarkMailbox?: string;
  createdAt?: string;
  sentAt?: string | null;
  repliedAt?: string | null;
}): Promise<number> {
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO letters (kind, notable_person_id, status, created_at, sent_at, replied_at)
     VALUES ('supporter', $1, $2, coalesce($3::timestamptz, now()), $4, $5) RETURNING id::int AS id`,
    [
      letter.politicianId,
      letter.status ?? "sent",
      letter.createdAt ?? null,
      letter.sentAt ?? null,
      letter.repliedAt ?? null,
    ],
  );
  const [entry] = await query<{ id: number }>(
    `INSERT INTO form_entries (form, created_at, name, email, address, postcode, contact_consent)
     SELECT 'email-your-mp', created_at, $2, $3, '1 Example Street', $4, $5 FROM letters WHERE id = $1
     RETURNING id::int AS id`,
    [
      id,
      letter.senderName ?? "Sam Sender",
      letter.senderEmail ?? "sam@example.com",
      letter.senderPostcode ?? "SW1A 1AA",
      letter.contactConsent ?? false,
    ],
  );
  await query(
    "INSERT INTO letters_from_supporters (id, entry_id, campaign, subject, postmark_mailbox) VALUES ($1, $2, $3, $4, $5)",
    [
      id,
      entry.id,
      letter.campaign ?? "regulate-letter-pm",
      letter.subject ?? "A letter",
      letter.postmarkMailbox ?? `reply-${id}`,
    ],
  );
  return id;
}

/** Testy McTestface MP (ZZ99ZZ), as the sync adds them, without statuses. */
export function addTestMp(email: string | null = "test-mp@parliament.example"): Promise<number> {
  return addTestPolitician({
    airtableId: null,
    name: "Testy McTestface MP",
    salutation: "Mr McTestface",
    constituency: "Testshire",
    party: "",
    email,
    testPostcode: "ZZ99ZZ",
  });
}

/** What CiviCRM says of a contact's member; each left out, it has none. */
export type TestContactDetails = {
  name?: string;
  city?: string;
  postcode?: string;
  joined?: string;
  intent?: string;
  phone?: string;
  newsletter?: string;
  gone?: string;
};

/**
 * Adds a UK chapter contact as a CiviCRM pull keeps it: every flag off, on
 * neither list unless `details` says, and everything seen first on `seen`.
 */
export async function addTestContact(
  id: number,
  email: string,
  details: TestContactDetails = {},
  seen = "2026-09-01T00:00:00Z",
): Promise<void> {
  await query(
    `INSERT INTO civicrm_contacts (contact_id, email, first_name, city, postal_code, joined_date, intent, phone,
       on_hold, on_hold_since, no_bulk_email, no_bulk_email_since, do_not_email, do_not_email_since, do_not_phone,
       do_not_phone_since, do_not_sms, do_not_sms_since, newsletter, newsletter_since, volunteer_updates,
       volunteer_updates_since, first_seen_at, gone_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, false, $9, false, $9, false, $9, false, $9, $10, $9,
       'not_on_list', $9, $9, $11)`,
    [
      id,
      email,
      details.name ?? null,
      details.city ?? null,
      details.postcode ?? null,
      details.joined ?? null,
      details.intent ?? null,
      details.phone ?? null,
      seen,
      details.newsletter ?? "not_on_list",
      details.gone ?? null,
    ],
  );
}

/**
 * Adds an entry straight into the audit log, of any action and details: only
 * what the reader of an entry needs, or an action logChange doesn't log.
 */
export async function addAuditEntry(actor: string, action: string, details: object): Promise<void> {
  await query("INSERT INTO audit_log (actor, action, details) VALUES ($1, $2, $3)", [
    actor,
    action,
    JSON.stringify(details),
  ]);
}

/** Runs `work` with the database unreachable, then reconnects. */
export async function withDatabaseDown<T>(work: () => Promise<T>): Promise<T> {
  const url = process.env.NETLIFY_DB_URL;
  await closeDb();
  process.env.NETLIFY_DB_URL = "postgresql://nobody@localhost/none?host=/nonexistent";
  try {
    return await work();
  } finally {
    await closeDb();
    process.env.NETLIFY_DB_URL = url;
  }
}

/** A test key for Gmail's tokens (GMAIL_TOKEN_KEY), the same in every test. */
export const TEST_GMAIL_TOKEN_KEY = Buffer.alloc(32, 1).toString("base64");

/**
 * Gives `email` a staff account with its Gmail connected, straight into the
 * table, read up to `historyId`. Its token is the Gmail fixture's
 * (lib/server/fixtures/outside-services.ts), which knows the account by it.
 * Sets GMAIL_TOKEN_KEY and the OAuth client's settings; the test unstubs them.
 */
export async function connectTestGmail(email = "jo@pauseai.uk", historyId = "1000"): Promise<void> {
  vi.stubEnv("GMAIL_TOKEN_KEY", TEST_GMAIL_TOKEN_KEY);
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
  await query(
    `INSERT INTO staff_accounts (email, added_by, gmail_token, gmail_connected_at, gmail_history_id)
     VALUES ($1, 'test', $2, now(), $3)
     ON CONFLICT (email) DO UPDATE SET gmail_token = $2, gmail_connected_at = now(), gmail_history_id = $3`,
    [email, encryptToken(`fixture-refresh:${email}`), historyId],
  );
}

let refusals = 0;

/**
 * Makes the database refuse, till the test ends, each `write` (UPDATE or
 * INSERT) of `table` whose new row matches `when`, SQL on NEW, as if it
 * failed just then: for what happens when a write goes wrong partway. The
 * database lasts the whole file, so the trigger is dropped once the test
 * is done.
 */
export async function refuseWrites(table: string, when: string, write: "UPDATE" | "INSERT" = "UPDATE"): Promise<void> {
  const name = `refuse_write_${++refusals}`;
  await query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'the database went away'; END $$`);
  await query(
    `CREATE TRIGGER ${name} BEFORE ${write} ON ${table} FOR EACH ROW WHEN (${when}) EXECUTE FUNCTION ${name}()`,
  );
  onTestFinished(async () => {
    await query(`DROP TRIGGER ${name} ON ${table}`);
    await query(`DROP FUNCTION ${name}`);
  });
}
