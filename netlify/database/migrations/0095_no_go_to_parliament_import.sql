-- The Go to Parliament import is gone: its runs, a press of its button,
-- and the audit log's entries for running it go with it. The answers it
-- set stay, for staff to change.
DELETE FROM import_runs WHERE job = 'import-go-to-parliament';
DELETE FROM job_presses WHERE job = 'import-go-to-parliament';
DELETE FROM audit_log WHERE action = 'import Go to Parliament';

ALTER TABLE import_runs DROP CONSTRAINT import_runs_job_check;
ALTER TABLE import_runs ADD CONSTRAINT import_runs_job_check
  CHECK (job IN ('sync-politicians', 'check-mps', 'import-controlai', 'import-luma', 'import-members',
    'sync-emails', 'import-web-form-letters', 'read-gmail', 'import-old-letters', 'send-mailings', 'tidy-logs'));
