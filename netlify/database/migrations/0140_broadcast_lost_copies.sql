-- A broadcast stops by itself when Postmark took its copies and said no more
-- of them: no delivery, bounce or anything else ('lost').
ALTER TABLE mailings
  DROP CONSTRAINT mailings_wait_reason_check,
  ADD CONSTRAINT mailings_wait_reason_check
    CHECK (wait_reason IN ('civicrm', 'pull', 'limit', 'template', 'late', 'failing', 'lost'));

-- A soft bounce in a copy's history: Postmark is trying it again, so it
-- isn't lost, though nothing has arrived yet.
ALTER TABLE broadcast_message_events
  DROP CONSTRAINT broadcast_message_events_kind_check,
  ADD CONSTRAINT broadcast_message_events_kind_check
    CHECK (kind IN ('sent', 'delivered', 'read', 'failed', 'bounced', 'soft-bounced', 'opted-out', 'replied'));
