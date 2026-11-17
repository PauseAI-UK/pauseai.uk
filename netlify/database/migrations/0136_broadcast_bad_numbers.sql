-- A text's copy whose number isn't in international format is skipped for
-- that: CiviCRM's check refuses such a number, and WhatsApp can't take one.
ALTER TABLE broadcast_messages DROP CONSTRAINT broadcast_messages_skip_reason_check;
ALTER TABLE broadcast_messages ADD CONSTRAINT broadcast_messages_skip_reason_check
  CHECK (skip_reason IN ('blocked', 'unsubscribed', 'no-permission', 'not-on-whatsapp', 'suppressed', 'bad-number'));

-- What CiviCRM's check last said, as it failed, while a broadcast waits for it.
ALTER TABLE mailings ADD COLUMN wait_said text;
ALTER TABLE mailings ADD CONSTRAINT mailings_wait_said CHECK (wait_said IS NULL OR wait_reason = 'civicrm');
