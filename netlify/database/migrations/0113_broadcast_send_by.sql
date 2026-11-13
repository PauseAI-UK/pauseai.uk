-- What sends an email to supporters: hello@'s connected Gmail, which sends
-- up to a day's limit and carries on the next day, or Postmark's broadcast
-- stream. Nothing reads it for a text, or for a mailing to politicians,
-- which goes from the Gmail it names (sent_from). One that hasn't all gone
-- three days after its time stops, as one waiting for CiviCRM does: for
-- that, its reason is 'limit'.
ALTER TABLE mailings
  ADD COLUMN send_by text NOT NULL DEFAULT 'gmail' CHECK (send_by IN ('gmail', 'postmark')),
  DROP CONSTRAINT mailings_wait_reason_check,
  ADD CONSTRAINT mailings_wait_reason_check CHECK (wait_reason IN ('civicrm', 'pull', 'limit'));
