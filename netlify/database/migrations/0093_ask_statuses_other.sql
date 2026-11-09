-- Each kind of ask has three answers: a letter signed, other or declined; an
-- event going, other or declined. What an "other" answer was is its note.
INSERT INTO ask_kind_statuses (kind, status) VALUES
  ('letter', 'other'),
  ('event', 'other');

-- Every other event answer becomes "other", its note what it meant, as
-- airtableNote (lib/asks.ts) words it, before any note it had. The audit log's record of setting
-- each answer says the same, so the history reads as the answers do.
UPDATE ask_statuses s
SET status = 'other', note = concat_ws(E'\n', w.words, nullif(s.note, ''))
FROM (VALUES
  ('tentative', 'Tentatively said yes'),
  ('meeting_staff', 'Meeting a member of their staff instead'),
  ('tentative_staff', 'Tentatively agreed to a meeting with a member of their staff'),
  ('declined_surgery', 'Declined, but offered a surgery appointment instead'),
  ('passed_on', 'Passed the request on')
) AS w (status, words)
WHERE s.ask_kind = 'event' AND s.status = w.status;

UPDATE audit_log l
SET details = l.details || jsonb_build_object(
  'status', 'other',
  'note', concat_ws(E'\n', w.words, nullif(l.details ->> 'note', ''))
)
FROM (VALUES
  ('tentative', 'Tentatively said yes'),
  ('meeting_staff', 'Meeting a member of their staff instead'),
  ('tentative_staff', 'Tentatively agreed to a meeting with a member of their staff'),
  ('declined_surgery', 'Declined, but offered a surgery appointment instead'),
  ('passed_on', 'Passed the request on')
) AS w (status, words)
WHERE l.action = 'set status' AND l.details ->> 'status' = w.status;

DELETE FROM ask_kind_statuses
WHERE status NOT IN ('signed', 'going', 'other', 'declined');
