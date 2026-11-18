-- A reply to a text that isn't words alone: what kind of WhatsApp message it
-- was, by WhatsApp's name for it ('image', 'location', 'reaction'), or
-- 'voice' for a voice note; with whatever words it came with in body, such
-- as a photo's caption or a reaction's emoji. A reaction is to one of our
-- messages, by WhatsApp's ID for it, and can be taken back.
ALTER TABLE broadcast_replies
  ADD COLUMN kind text,
  ADD COLUMN reaction_to text,
  ADD COLUMN removed_at timestamptz;
ALTER TABLE broadcast_replies
  ADD CONSTRAINT broadcast_replies_reaction
    CHECK (kind IS NOT DISTINCT FROM 'reaction' OR num_nonnulls(reaction_to, removed_at) = 0);

-- A reply to a text has its words, its kind, or both: a voice note has no
-- words. A reply to an email has neither, as its message is kept whole.
ALTER TABLE broadcast_replies
  DROP CONSTRAINT broadcast_replies_whatsapp,
  ADD CONSTRAINT broadcast_replies_whatsapp
    CHECK ((provider_message_id IS NULL) = (num_nonnulls(body, kind) = 0));

-- Those kept so far said their kind in their words, and nothing else of them
-- was kept: a reaction's emoji, a photo's caption.
UPDATE broadcast_replies
SET kind = substring(body FROM '^\[A (.+) message, which only the WhatsApp app shows\]$'), body = NULL
WHERE blob_key IS NULL AND body ~ '^\[A .+ message, which only the WhatsApp app shows\]$';

-- The reaction someone took back, or put another in place of: theirs to that message, not yet removed.
CREATE INDEX broadcast_replies_reaction_to ON broadcast_replies (reaction_to) WHERE reaction_to IS NOT NULL;
