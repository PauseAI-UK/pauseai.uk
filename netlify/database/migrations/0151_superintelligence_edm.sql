-- EDM 1133, which MPs sign. Nobody we know of asked them, so it names no
-- asker. Its import (import-edm) sets its answers from Parliament's list of
-- signers.
INSERT INTO asks (slug, title, kind, date, url, asked_by) VALUES
  ('superintelligence-edm', 'Early day motion for a global pause on superintelligent AI', 'letter', '2026-11-10',
    'https://edm.parliament.uk/early-day-motion/66900', '{}');

ALTER TABLE import_runs DROP CONSTRAINT import_runs_job_check;
ALTER TABLE import_runs ADD CONSTRAINT import_runs_job_check
  CHECK (job IN ('import-parliament', 'import-scottish-parliament', 'import-senedd',
    'import-ni-assembly', 'import-controlai', 'import-controlai-statement', 'import-edm', 'import-luma',
    'read-gmail', 'send-mailings', 'tidy-logs', 'import-civicrm'));
