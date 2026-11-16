-- WhatsApp's receipts for our replies to texts (broadcast_answers) are kept
-- beside those for the copies: each event is a copy's or one of our replies'.
ALTER TABLE broadcast_message_events ADD COLUMN answer_id bigint REFERENCES broadcast_answers (id) ON DELETE CASCADE;
ALTER TABLE broadcast_message_events ALTER COLUMN message_id DROP NOT NULL;
ALTER TABLE broadcast_message_events ADD CONSTRAINT broadcast_message_events_copy_or_answer
  CHECK (num_nonnulls(message_id, answer_id) = 1);
CREATE INDEX broadcast_message_events_answer ON broadcast_message_events (answer_id, at);
