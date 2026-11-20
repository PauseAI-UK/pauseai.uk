-- An answer to a reply that a staff member wrote in the mailbox's Gmail rather
-- than on the site: read from the mailbox, its words kept as an answer's are,
-- sent by the mailbox. Gmail's ID for it is kept once.
ALTER TABLE broadcast_answers ADD COLUMN from_gmail boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX broadcast_answers_gmail_message ON broadcast_answers (gmail_message_id)
  WHERE gmail_message_id IS NOT NULL;

-- A reaction to a reply to a text: its emoji in place of words, on the reply
-- it answers; taken back, or put another in place of, at removed_at.
ALTER TABLE broadcast_answers
  ALTER COLUMN body DROP NOT NULL,
  ADD COLUMN emoji text,
  ADD COLUMN removed_at timestamptz;
ALTER TABLE broadcast_answers
  ADD CONSTRAINT broadcast_answers_words_or_emoji CHECK ((emoji IS NULL) = (body IS NOT NULL)),
  ADD CONSTRAINT broadcast_answers_removed_reaction CHECK (removed_at IS NULL OR emoji IS NOT NULL);
