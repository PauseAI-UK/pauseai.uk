-- Each kind of ask has three answers: a letter signed, other or declined; an
-- event going, other or declined. What an "other" answer was is its note.
INSERT INTO ask_kind_statuses (kind, status) VALUES
  ('letter', 'other'),
  ('event', 'other');

-- Every other event answer becomes "other", its note the words Airtable
-- uses for it, before any note it had. The audit log's record of setting
-- each answer says the same, so the history reads as the answers do.
UPDATE ask_statuses s
SET status = 'other', note = concat_ws(E'\n', w.words, nullif(s.note, ''))
FROM (VALUES
  ('tentative', 'Tentative yes'),
  ('meeting_staff', 'Meeting with staff'),
  ('tentative_staff', 'Tentative meeting with staff'),
  ('declined_surgery', 'Declined but surgery appointment'),
  ('passed_on', 'Passed on request')
) AS w (status, words)
WHERE s.ask_kind = 'event' AND s.status = w.status;

UPDATE audit_log l
SET details = l.details || jsonb_build_object(
  'status', 'other',
  'note', concat_ws(E'\n', w.words, nullif(l.details ->> 'note', ''))
)
FROM (VALUES
  ('tentative', 'Tentative yes'),
  ('meeting_staff', 'Meeting with staff'),
  ('tentative_staff', 'Tentative meeting with staff'),
  ('declined_surgery', 'Declined but surgery appointment'),
  ('passed_on', 'Passed on request')
) AS w (status, words)
WHERE l.action = 'set status' AND l.details ->> 'status' = w.status;

DELETE FROM ask_kind_statuses
WHERE status NOT IN ('signed', 'going', 'other', 'declined');
