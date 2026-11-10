-- A reply kept from Postmark's inbound webhook has no Gmail IDs: its account
-- is the letter's own address.
ALTER TABLE letter_replies ALTER COLUMN gmail_message_id DROP NOT NULL;
ALTER TABLE letter_replies ALTER COLUMN gmail_thread_id DROP NOT NULL;
ALTER TABLE letter_replies ADD CONSTRAINT letter_replies_gmail_ids
  CHECK ((gmail_message_id IS NULL) = (gmail_thread_id IS NULL));

-- A Gmail thread is kept in one place. One-off threads in a letter's thread
-- move onto the letter, whole, by the rule claimOneOffs uses
-- (lib/server/letter-replies.ts): a message in a Gmail thread of the letter's,
-- in the mailbox that has it, or answering a message the letter has or an
-- email it went as, or a copy of a message it has. A one-off thread in more
-- than one letter's goes to the first letter's.
CREATE TEMPORARY TABLE claimed_threads AS
SELECT m.thread_id, min(l.letter_id) AS letter_id
FROM one_off_messages m
JOIN (
  SELECT r.letter_id, r.account, r.gmail_thread_id, r.rfc_message_id, NULL::text AS postmark_id
  FROM letter_replies r
  UNION ALL
  SELECT e.letter_id, e.sender, e.gmail_thread_id, e.rfc_message_id,
    CASE WHEN e.backend = 'postmark' THEN e.message_id || '@mtasv.net' END
  FROM email_sends e WHERE e.letter_id IS NOT NULL
) l ON (l.account = m.account AND l.gmail_thread_id = m.gmail_thread_id)
  OR l.rfc_message_id = ANY (m.in_reply_to)
  OR l.rfc_message_id = m.rfc_message_id
  OR l.postmark_id = ANY (m.in_reply_to)
GROUP BY m.thread_id;

CREATE TEMPORARY TABLE claimed_messages AS
SELECT m.*, c.letter_id,
  EXISTS (
    SELECT 1 FROM letters_from_supporters s
      LEFT JOIN form_entries f ON f.id = s.entry_id LEFT JOIN proxies p ON p.id = s.proxy_id
    WHERE s.id = c.letter_id AND m.from_address IN (lower(f.email), p.supporter_email)
  ) AS from_supporter,
  -- As isMachineReply (lib/email-parsing/subjects.ts) knows one by its subject.
  m.subject ~* '^\s*(automatic reply|auto[- ]?reply|auto[- ]?response|out of (the )?office)\y' AS auto,
  EXISTS (
    SELECT 1 FROM letter_replies r
    WHERE r.letter_id = c.letter_id AND r.rfc_message_id = m.rfc_message_id
  ) AS kept_already
FROM one_off_messages m JOIN claimed_threads c ON c.thread_id = m.thread_id;

INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, from_address,
  from_name, subject, at, from_us, blob_key, size, from_supporter)
SELECT letter_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, from_address,
  from_name, subject, at, from_us, blob_key, size, from_supporter
FROM claimed_messages WHERE NOT kept_already
ORDER BY at, id
ON CONFLICT (account, gmail_message_id) DO NOTHING;

-- Moving a message adds nothing to the letter's history, which says what
-- arrived when it arrived, but for an automatic reply's note, which marks it
-- as one on the letter's page, as noteAutoReply's does.
INSERT INTO letter_events (letter_id, at, status, details)
SELECT letter_id, at, 'auto_reply',
  jsonb_strip_nulls(jsonb_build_object(
    'from', from_address,
    'to', nullif(to_line, ''),
    'cc', nullif(cc_line, ''),
    'handling', jsonb_build_array(jsonb_build_object('outcome', 'not_forwarded', 'reason', 'gmail')),
    'gmailMessageId', gmail_message_id
  ))
FROM claimed_messages c
WHERE auto AND NOT kept_already
  AND EXISTS (SELECT 1 FROM letter_replies r WHERE r.account = c.account AND r.gmail_message_id = c.gmail_message_id
    AND r.letter_id = c.letter_id);

DELETE FROM one_off_messages WHERE id IN (SELECT id FROM claimed_messages);
DELETE FROM one_off_threads t
WHERE t.id IN (SELECT thread_id FROM claimed_threads)
  AND NOT EXISTS (SELECT 1 FROM one_off_messages m WHERE m.thread_id = t.id);

DROP TABLE claimed_messages;
DROP TABLE claimed_threads;
