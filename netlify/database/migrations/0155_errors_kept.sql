-- An error kept as more than its words: the words, and when it was an
-- outside service failing, which service, what kind of failure and its
-- status (keptError in lib/server/problems.server.ts), so what reads one
-- can tell a rate limit from an outage without reading the words. Each
-- column stands beside the one that held the words alone, which the rows
-- from before still have.

-- Why a run failed. A failed run has one or the other.
ALTER TABLE import_runs
  ADD COLUMN failure jsonb,
  DROP CONSTRAINT import_runs_check,
  ADD CONSTRAINT import_runs_failed CHECK ((status = 'failed') = (error IS NOT NULL OR failure IS NOT NULL));

-- Why the last read of an event's guests failed, and of its hosts.
ALTER TABLE luma_events ADD COLUMN guests_failure jsonb, ADD COLUMN hosts_failure jsonb;

-- How CiviCRM's check failed, when a broadcast had to wait for it.
ALTER TABLE mailings
  ADD COLUMN wait_failure jsonb,
  ADD CONSTRAINT mailings_wait_failure CHECK (wait_failure IS NULL OR wait_reason = 'civicrm');
