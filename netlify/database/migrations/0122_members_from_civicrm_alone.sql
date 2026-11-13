-- The members come from CiviCRM alone, which returns every member in
-- Airtable we may hold, so what the Airtable members import copied goes:
-- the supporters it alone gave us (members CiviCRM leaves out on purpose),
-- then the members, with their links and the IDs of those erased, and the
-- import's runs, which the import log's jobs no longer include. The tables
-- and views stay for the code still running during the deploy, whose
-- members import, if it runs then, can't log its run; a later migration
-- drops them.
CREATE TEMP TABLE linked_to_members AS
SELECT DISTINCT supporter_id FROM supporter_links WHERE airtable_member_id IS NOT NULL;

DELETE FROM supporters s
WHERE s.id IN (SELECT supporter_id FROM linked_to_members)
  AND NOT EXISTS (SELECT 1 FROM supporter_links k WHERE k.supporter_id = s.id AND k.airtable_member_id IS NULL);
DELETE FROM airtable_members;
DELETE FROM airtable_members_erased;
DELETE FROM import_runs WHERE job = 'import-members';
DELETE FROM job_presses WHERE job = 'import-members';
ALTER TABLE import_runs DROP CONSTRAINT import_runs_job_check;
ALTER TABLE import_runs ADD CONSTRAINT import_runs_job_check
  CHECK (job IN ('sync-politicians', 'check-mps', 'import-controlai', 'import-luma', 'read-gmail', 'send-mailings',
    'tidy-logs', 'import-civicrm'));

-- The first seen of the supporters who were members in Airtable, and the
-- list, as their records now say.
UPDATE supporters s SET first_seen_at = f.first_seen_at FROM supporter_first_seen f
WHERE f.supporter_id = s.id AND s.id IN (SELECT supporter_id FROM linked_to_members)
  AND s.first_seen_at IS DISTINCT FROM f.first_seen_at;
DROP TABLE linked_to_members;
REFRESH MATERIALIZED VIEW supporters_list;
