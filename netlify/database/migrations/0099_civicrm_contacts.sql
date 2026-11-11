-- Global's CRM, CiviCRM, as one of our sources: every UK chapter contact
-- its chapter contacts API returns, as it told us (lib/server/civicrm-import.ts).
-- Matched to a supporter by address and to a member by Airtable ID, or to
-- neither. No name, number or postal address: the API gives none.
--
-- CiviCRM gives no dates, so each `_since` is when we saw the value change,
-- and one equal to `first_seen_at` is as it was when we first saw the
-- contact, so from then or before. `gone_at` is when a complete pull
-- stopped returning it, which means they left the UK chapter, often by
-- saying no to sharing with us; it's cleared if a pull returns them again.
CREATE TABLE civicrm_contacts (
  contact_id bigint PRIMARY KEY,
  airtable_id text,
  email text NOT NULL CHECK (email = lower(email)),
  on_hold boolean NOT NULL,
  on_hold_since timestamptz NOT NULL,
  no_bulk_email boolean NOT NULL,
  no_bulk_email_since timestamptz NOT NULL,
  do_not_email boolean NOT NULL,
  do_not_email_since timestamptz NOT NULL,
  do_not_phone boolean NOT NULL,
  do_not_phone_since timestamptz NOT NULL,
  do_not_sms boolean NOT NULL,
  do_not_sms_since timestamptz NOT NULL,
  newsletter text NOT NULL CHECK (newsletter IN ('subscribed', 'unsubscribed', 'not_opted_in', 'not_on_list')),
  newsletter_since timestamptz NOT NULL,
  volunteer_updates text NOT NULL
    CHECK (volunteer_updates IN ('subscribed', 'unsubscribed', 'not_opted_in', 'not_on_list')),
  volunteer_updates_since timestamptz NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  gone_at timestamptz
);
CREATE INDEX civicrm_contacts_email ON civicrm_contacts (email);
CREATE INDEX civicrm_contacts_airtable_id ON civicrm_contacts (airtable_id);

-- The contacts of supporters who were erased, which the import skips, so
-- they never come back.
CREATE TABLE civicrm_erased (
  contact_id bigint PRIMARY KEY,
  erased_at timestamptz NOT NULL DEFAULT now()
);

-- A hold in CiviCRM (its emails to the address bounced) blocks the address
-- here too, as a problem of its own kind, which staff can lift with a note.
ALTER TABLE email_problems DROP CONSTRAINT email_problems_kind_check;
ALTER TABLE email_problems ADD CONSTRAINT email_problems_kind_check
  CHECK (kind IN ('hard', 'soft', 'complaint', 'hold'));

-- The import's runs.
ALTER TABLE import_runs DROP CONSTRAINT import_runs_job_check;
ALTER TABLE import_runs ADD CONSTRAINT import_runs_job_check
  CHECK (job IN ('sync-politicians', 'check-mps', 'import-controlai', 'import-luma', 'import-members',
    'sync-emails', 'import-web-form-letters', 'read-gmail', 'import-old-letters', 'send-mailings', 'tidy-logs',
    'import-civicrm'));
