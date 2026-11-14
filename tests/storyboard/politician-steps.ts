// The fixture politicians in a flow's database: brought in as the nightly
// imports bring them, with what they had from Airtable, their answers to the
// asks, and PauseAI's emails to them.
import type { APIRequestContext } from "@playwright/test";
import { runSql } from "@/scripts/fresh-database.mjs";

/** The letter to the PM's ask, by its title in the asks table. */
export const PM_LETTER = "Frontier AI letter to the Prime Minister";

/** The jobs that bring the fixture politicians in: each body's import. */
const POLITICIAN_JOBS = ["import-parliament", "import-scottish-parliament", "import-senedd", "import-ni-assembly"];

/**
 * Brings the fixture politicians into the flow's database through the
 * nightly imports' own routes, from the bodies' fixture lists
 * (lib/server/fixtures/politician-lists.ts), which refresh the test MPs too.
 * First it adds two who've left, whom no list has: Rita Retired and Gordon
 * Gone, from before the imports. Then it gives each who was in Airtable
 * their record there and what they had from it: a salutation, markers and
 * notes.
 */
export async function importPoliticians(request: APIRequestContext, base: string, database: string) {
  runSql(
    database,
    `WITH former (name, salutation, status, constituency, country) AS (VALUES
       ('Rita Retired', 'Ms Retired', 'retired', 'Old Seat', 'wales'),
       ('Gordon Gone', 'Mr Gone', 'left_office', 'Former Seat', 'england')),
     added AS (
       INSERT INTO notable_people (kind, name, salutation, email, status)
       SELECT 'politician', f.name, f.salutation,
         CASE WHEN f.name = 'Gordon Gone' THEN 'gordon.gone.mp@parliament.uk' END, f.status
       FROM former f WHERE NOT EXISTS (SELECT 1 FROM notable_people n WHERE n.name = f.name)
       RETURNING id, name)
     INSERT INTO politicians (id, house, constituency, party, country)
     SELECT a.id, 'commons', f.constituency, 'Independent', f.country FROM added a JOIN former f USING (name)`,
  );
  for (const job of POLITICIAN_JOBS) {
    const res = await request.post(`${base}/api/cron/${job}`, {
      headers: { Authorization: "Bearer fixture-cron-secret" },
    });
    if (!res.ok()) throw new Error(`${job} on ${base} failed: ${res.status()} ${await res.text()}`);
  }
  runSql(
    database,
    `UPDATE notable_people n
     SET airtable_id = v.record, salutation = v.salutation, important_target = v.important,
       personal_connection = v.connection, salutation_to_check = n.salutation_to_check AND n.salutation = v.salutation
     FROM (VALUES
       ('recDummy', 'Ms Dora Dummy', 'Ms Dummy', false, false),
       ('recPlaceholder', 'Polly Placeholder', 'Ms Placeholder', true, false),
       ('recSeedling', 'Lord Seedling of Example', 'Lord Seedling', false, false),
       ('recMorag', 'Morag Example', 'Ms Example', false, true),
       ('recRetired', 'Rita Retired', 'Ms Retired', false, false),
       ('recGone', 'Gordon Gone', 'Mr Gone', false, false),
       ('recMo', 'Mo Example', 'Mx Example', false, false)) AS v (record, name, salutation, important, connection)
     WHERE n.name = v.name AND n.airtable_id IS NULL`,
  );
  // Polly's notes from Airtable, as a note in her history.
  runSql(
    database,
    `INSERT INTO notes (notable_person_id, body, written_by, created_at)
     SELECT id, 'Met at the example fair.', 'Airtable', now() FROM notable_people
     WHERE airtable_id = 'recPlaceholder' AND NOT EXISTS (SELECT 1 FROM notes WHERE written_by = 'Airtable')`,
  );
}

/**
 * Records, as staff would on their pages, the fixture politicians' answers
 * to the asks: Polly signed ControlAI's statement and declined the Edinburgh
 * conference, Morag is going to it, Lord Seedling signed the DeepMind letter
 * and Rita Retired the Frontier AI letter. Run after importPoliticians, which
 * adds them. An answer they already have stays.
 */
export function recordAnswers(database: string) {
  runSql(
    database,
    `INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, updated_by)
     SELECT n.id, a.slug, a.kind, v.status, 'staff@pauseai.uk'
     FROM (VALUES ('recPlaceholder', 'controlai-statement', 'signed'),
                  ('recPlaceholder', 'edinburgh-conference-2026', 'declined'),
                  ('recMorag', 'edinburgh-conference-2026', 'going'),
                  ('recSeedling', 'deepmind-letter', 'signed'),
                  ('recRetired', 'frontier-ai-letter', 'signed')) AS v (record, ask, status)
     JOIN notable_people n ON n.airtable_id = v.record
     JOIN asks a ON a.slug = v.ask
     ON CONFLICT DO NOTHING`,
  );
}

/**
 * PauseAI's emails to politicians, as they were copied from Airtable's Emails
 * table: one of each mailing, by its tick box, or the DeepMind letter's by
 * when it went, to the politicians the sync copied. Needs the politicians.
 */
const PAUSEAI_EMAILS = [
  { airtableId: "recEmailDeepMind", politician: "recPlaceholder", at: "2025-07-09T11:00:00Z", personalised: true },
  { airtableId: "recEmailCsrb", politician: "recDummy", at: "2026-06-10T09:00:00Z", field: "CSRB Iqbal Amendment" },
  {
    airtableId: "recEmailEdinburghPolly",
    politician: "recPlaceholder",
    at: "2026-10-01T10:00:00Z",
    field: "Edinburgh Conference Nov 26 Invitation",
    personalised: true,
  },
  {
    airtableId: "recEmailEdinburghMorag",
    politician: "recMorag",
    at: "2026-10-01T10:05:00Z",
    field: "Edinburgh Conference Nov 26 Invitation",
  },
  {
    airtableId: "recEmailBenLake",
    politician: "recDummy",
    at: "2026-10-15T08:30:00Z",
    field: "Ben Lake October 2026 Debate",
  },
];

/** Adds PauseAI's emails to politicians (PAUSEAI_EMAILS) to the flow's database. */
export function addPauseaiEmails(database: string) {
  for (const { airtableId, politician, at, field, personalised = false } of PAUSEAI_EMAILS) {
    const [id] = runSql(
      database,
      `INSERT INTO letters (kind, notable_person_id, status, created_at, sent_at)
       SELECT 'pauseai', id, 'sent', '${at}', '${at}' FROM notable_people WHERE airtable_id = '${politician}' RETURNING id`,
    );
    const mailing = field ? `airtable_field = '${field}'` : `airtable_sent_between @> '${at}'::timestamptz`;
    runSql(
      database,
      `INSERT INTO letters_from_pauseai (id, mailing_id, airtable_id, personalised)
       SELECT ${id}, id, '${airtableId}', ${personalised} FROM mailings WHERE ${mailing}`,
    );
  }
}
