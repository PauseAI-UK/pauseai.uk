-- A letter, or a supporter's copy, that a run took to send and never
-- marked sent may have gone, or not: after a while it's uncertain, for a
-- person to check, as sending it again could send it twice. When a run
-- took it says which have been left a while, so one going now isn't caught.
ALTER TABLE letters ADD COLUMN taken_at timestamptz;
ALTER TABLE letters_from_supporters ADD COLUMN copy_taken_at timestamptz;

ALTER TABLE letters DROP CONSTRAINT letters_status_check;
ALTER TABLE letters ADD CONSTRAINT letters_status_check CHECK (
  status IN ('sending', 'sent', 'not_sent', 'bounced', 'spam_complaint', 'uncertain')
  OR (kind = 'pauseai' AND status IN ('scheduled', 'cancelled', 'skipped'))
  OR (kind = 'supporter' AND status = 'queued'));

ALTER TABLE letters_from_supporters DROP CONSTRAINT letters_from_supporters_copy_state_check;
ALTER TABLE letters_from_supporters ADD CONSTRAINT letters_from_supporters_copy_state_check
  CHECK (copy_state IN ('queued', 'sending', 'sent', 'held', 'uncertain'));

-- Those sending already, from a mailing or the letters inbox, were taken
-- by a run no later than now.
UPDATE letters l SET taken_at = now() WHERE l.status = 'sending' AND (l.kind = 'pauseai'
  OR EXISTS (SELECT 1 FROM letters_from_supporters s WHERE s.id = l.id AND s.proxy_id IS NOT NULL));
UPDATE letters_from_supporters SET copy_taken_at = now() WHERE copy_state = 'sending';
