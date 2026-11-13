-- How many tries at a broadcast's copies have failed one after another: a
-- copy that goes starts the count again. Enough in a row stops it.
ALTER TABLE mailings ADD COLUMN failed_in_a_row int NOT NULL DEFAULT 0 CHECK (failed_in_a_row >= 0);

-- Two more ways a broadcast stops by itself: its days ran out while it
-- waited for CiviCRM ('late'), and its copies kept failing ('failing').
ALTER TABLE mailings
  DROP CONSTRAINT mailings_wait_reason_check,
  ADD CONSTRAINT mailings_wait_reason_check
    CHECK (wait_reason IN ('civicrm', 'pull', 'limit', 'template', 'late', 'failing'));
