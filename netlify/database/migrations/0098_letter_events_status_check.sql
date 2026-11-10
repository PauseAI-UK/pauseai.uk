-- The events a letter's history may hold (RECORDED_LETTER_EVENTS in
-- lib/letter-status.ts): those the code writes, and 'sending', which
-- nothing writes any more but older mailings' letters still have.
ALTER TABLE letter_events ADD CONSTRAINT letter_events_status_check CHECK (status IN (
  'queued', 'sent', 'uncertain', 'failed', 'skipped', 'bounced', 'spam_complaint',
  'copy_sent', 'copy_held', 'copy_uncertain', 'copy_delayed', 'copy_bounced',
  'replied', 'auto_reply',
  'not_relayed', 'relay_queued', 'relay_held', 'relayed', 'relay_uncertain', 'relay_delayed', 'relay_bounced',
  'notice', 'office_told',
  'sending'
));
