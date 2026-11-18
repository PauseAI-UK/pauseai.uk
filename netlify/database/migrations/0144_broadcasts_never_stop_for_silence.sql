-- A broadcast never stops for copies Postmark has said nothing of: they
-- show as delayed until its sending days run out. One that stopped for them
-- with nothing left to send is sent; one that also left copies unsent is
-- cancelled, as staff would have.
UPDATE mailings m SET state = 'sent', gave_up = false, wait_reason = NULL, waiting_since = NULL, updated_at = now()
WHERE m.wait_reason = 'lost'
  AND NOT EXISTS (SELECT 1 FROM broadcast_messages c WHERE c.mailing_id = m.id AND c.status = 'cancelled');
UPDATE mailings SET gave_up = false, wait_reason = NULL, waiting_since = NULL, updated_at = now()
WHERE wait_reason = 'lost';

ALTER TABLE mailings
  DROP CONSTRAINT mailings_wait_reason_check,
  ADD CONSTRAINT mailings_wait_reason_check
    CHECK (wait_reason = ANY (ARRAY['civicrm', 'pull', 'limit', 'template', 'late', 'failing']));
