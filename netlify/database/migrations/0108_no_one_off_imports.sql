-- The import of old letters, the copy of PauseAI's emails from Airtable and the
-- import of pauseai.info's web form letters are gone: their runs, any press of
-- them, and the old letters import's record of the mail it read. What they
-- copied stays.
DELETE FROM import_runs WHERE job IN ('import-old-letters', 'sync-emails', 'import-web-form-letters');
DELETE FROM job_presses WHERE job IN ('import-old-letters', 'sync-emails', 'import-web-form-letters');

ALTER TABLE import_runs DROP CONSTRAINT import_runs_job_check;
ALTER TABLE import_runs ADD CONSTRAINT import_runs_job_check
  CHECK (job IN ('sync-politicians', 'check-mps', 'import-controlai', 'import-luma', 'import-members',
    'read-gmail', 'send-mailings', 'tidy-logs', 'import-civicrm'));

DROP TABLE old_letters_mail;
