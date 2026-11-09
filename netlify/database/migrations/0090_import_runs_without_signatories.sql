-- The import log's jobs are those the code runs (IMPORT_JOBS in lib/import-runs.ts).
ALTER TABLE import_runs DROP CONSTRAINT import_runs_job_check;
ALTER TABLE import_runs ADD CONSTRAINT import_runs_job_check
  CHECK (job IN ('sync-politicians', 'check-mps', 'import-controlai', 'import-luma', 'import-members',
    'sync-emails', 'import-web-form-letters', 'import-go-to-parliament', 'read-gmail', 'import-old-letters',
    'send-mailings', 'tidy-logs'));
