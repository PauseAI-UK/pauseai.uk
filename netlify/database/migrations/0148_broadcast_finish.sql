-- When a broadcast to supporters stops if it hasn't all gone: this many
-- minutes after its time, at most seven days; none for the seven days. Kept
-- from its time, so moving its time moves its finish.
ALTER TABLE mailings
  ADD COLUMN finish_minutes integer,
  ADD CONSTRAINT mailings_finish_minutes
    CHECK (finish_minutes IS NULL OR (audience = 'supporters' AND finish_minutes BETWEEN 1 AND 7 * 24 * 60));

-- A text scheduled before WhatsApp has approved its words waits for it past its time ('approval'), and stops at its
-- finish if they never are.
ALTER TABLE mailings
  DROP CONSTRAINT mailings_wait_reason_check,
  ADD CONSTRAINT mailings_wait_reason_check
    CHECK (wait_reason = ANY (ARRAY['civicrm', 'pull', 'limit', 'template', 'late', 'failing', 'approval']));
