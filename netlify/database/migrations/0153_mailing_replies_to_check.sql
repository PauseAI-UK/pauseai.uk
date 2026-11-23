-- A politician's reply to a mailing's letter that staff marked as needing
-- nothing, who and when; it and the replies before it are no longer to
-- check (lib/mailings/replies.server.ts).
ALTER TABLE letter_replies
  ADD COLUMN dealt_by text CHECK (dealt_by = lower(dealt_by)),
  ADD COLUMN dealt_at timestamptz,
  ADD CONSTRAINT letter_replies_dealt CHECK ((dealt_by IS NULL) = (dealt_at IS NULL)),
  ADD CONSTRAINT letter_replies_dealt_theirs CHECK (dealt_by IS NULL OR NOT from_us);

-- Staff's answer to a reply to a mailing's letter, sent by Gmail from the
-- mailbox the reply came to, in its thread. `draft_id` is the page's own,
-- so pressing Send twice sends it once. It's recorded as sending before it
-- goes; once sent, the message is kept on the letter (`kept_id`).
CREATE TABLE letter_answers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reply_id bigint NOT NULL REFERENCES letter_replies (id) ON DELETE CASCADE,
  draft_id uuid NOT NULL UNIQUE,
  sent_by text NOT NULL CHECK (sent_by = lower(sent_by)),
  created_at timestamptz NOT NULL DEFAULT now(),
  kept_id bigint UNIQUE REFERENCES letter_replies (id) ON DELETE SET NULL
);
CREATE INDEX letter_answers_reply ON letter_answers (reply_id);

-- When staff were emailed about a reply to a text still waiting for them,
-- once a reply.
ALTER TABLE broadcast_replies ADD COLUMN alerted_at timestamptz;

ALTER TABLE email_sends DROP CONSTRAINT email_sends_purpose_check;
ALTER TABLE email_sends ADD CONSTRAINT email_sends_purpose_check CHECK (purpose IN (
  'letter', 'forwarded-reply', 'staff-login', 'staff-alert', 'mailing', 'mailing-test', 'letter-copy', 'relay',
  'supporter-notice', 'office-notice', 'staff-report', 'broadcast', 'preferences-link', 'bulk-notice',
  'broadcast-answer', 'mailing-answer'));
