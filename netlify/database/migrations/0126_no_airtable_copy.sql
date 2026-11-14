-- The copy from Airtable is gone: nobody edits Airtable any more, and the
-- site already has every salutation, marker and note it held. Its runs go
-- with it.
DELETE FROM import_runs WHERE job = 'sync-politicians';
DELETE FROM job_presses WHERE job = 'sync-politicians';
ALTER TABLE import_runs DROP CONSTRAINT import_runs_job_check;
ALTER TABLE import_runs ADD CONSTRAINT import_runs_job_check
  CHECK (job IN ('import-parliament', 'import-scottish-parliament', 'import-senedd',
    'import-ni-assembly', 'import-controlai', 'import-controlai-statement', 'import-luma',
    'read-gmail', 'send-mailings', 'tidy-logs', 'import-civicrm'));
