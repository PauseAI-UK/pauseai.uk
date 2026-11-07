-- The old letters import marked a letter replied to from its first message
-- not from us, which could be the supporter's own or an automatic reply.
-- Letters with no real reply from their office aren't replied to. Their
-- events stay, and a letter with a real reply keeps its date.
UPDATE letters l SET replied_at = NULL
WHERE l.replied_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM letter_replies r
    WHERE r.letter_id = l.id AND r.at = l.replied_at AND (
      r.from_supporter OR EXISTS (
        SELECT 1 FROM letter_events e
        WHERE e.letter_id = r.letter_id AND e.status = 'auto_reply' AND e.details->>'gmailMessageId' = r.gmail_message_id
      )
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM letter_replies r
    WHERE r.letter_id = l.id AND NOT r.from_us AND NOT r.from_supporter AND NOT EXISTS (
      SELECT 1 FROM letter_events e
      WHERE e.letter_id = r.letter_id AND e.status = 'auto_reply' AND e.details->>'gmailMessageId' = r.gmail_message_id
    )
  );
