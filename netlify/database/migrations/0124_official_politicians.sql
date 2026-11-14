-- Politicians come from their bodies' own lists (lib/server/politician-import.ts).
--
-- Each keeps the ID their body gives them. The Commons and the Lords share
-- Parliament's IDs, so someone who moves from one House to the other stays one
-- politician. Test politicians and those in no body's list ('other') have none.
ALTER TABLE politicians ADD COLUMN official_id integer;
ALTER TABLE politicians ADD CONSTRAINT politicians_official_id
  CHECK (official_id IS NULL OR (house <> 'other' AND NOT is_test));
CREATE UNIQUE INDEX politicians_official_id_key
  ON politicians ((CASE WHEN house IN ('commons', 'lords') THEN 'parliament' ELSE house END), official_id)
  WHERE official_id IS NOT NULL;

-- A salutation made from the name alone, as the politician's gender wasn't
-- known: shown to staff to check, and made again once it is.
ALTER TABLE notable_people ADD COLUMN salutation_to_check boolean NOT NULL DEFAULT false;

-- The House of Lords' shared inbox, which forwards to the Lord a message
-- names. It's no one's own address: as anyone's email it would take
-- mailings that Lords disregard, and as an address of theirs it would link
-- one thread to every Lord who lists it (SHARED_INBOXES in lib/one-off.ts,
-- which the code checks first).
DELETE FROM politician_addresses WHERE address = 'contactholmember@parliament.uk';
UPDATE notable_people SET email = NULL WHERE lower(email) = 'contactholmember@parliament.uk';
ALTER TABLE notable_people ADD CONSTRAINT notable_people_not_shared_inbox
  CHECK (lower(email) <> 'contactholmember@parliament.uk');
ALTER TABLE politician_addresses ADD CONSTRAINT politician_addresses_not_shared_inbox
  CHECK (address <> 'contactholmember@parliament.uk');

-- ControlAI's statement, which politicians back on its page, is imported
-- nightly, as its letter to the Prime Minister is: the answers copied from
-- Airtable become the import's, so it takes off anyone the page no longer
-- links to.
UPDATE ask_statuses SET updated_by = 'controlai' WHERE ask = 'controlai-statement' AND updated_by = 'airtable';

-- The copy from Airtable no longer adds or changes politicians' details, only
-- what no body lists, so a sync held to apply them all is discarded.
UPDATE import_runs SET status = 'discarded', decided_by = 'migration', decided_at = now()
WHERE job = 'sync-politicians' AND status = 'held';

-- The check against Parliament is now Parliament's import, and each other
-- body has one; ControlAI's statement has its own.
DELETE FROM import_runs WHERE job = 'check-mps';
DELETE FROM job_presses WHERE job = 'check-mps';
ALTER TABLE import_runs DROP CONSTRAINT import_runs_job_check;
ALTER TABLE import_runs ADD CONSTRAINT import_runs_job_check
  CHECK (job IN ('sync-politicians', 'import-parliament', 'import-scottish-parliament', 'import-senedd',
    'import-ni-assembly', 'import-controlai', 'import-controlai-statement', 'import-luma',
    'read-gmail', 'send-mailings', 'tidy-logs', 'import-civicrm'));
