-- Each politician's notes from Airtable become a note in their history,
-- written by Airtable and dated today, when Airtable is switched off. Then
-- the column they were copied into goes.
INSERT INTO notes (notable_person_id, body, written_by, created_at)
SELECT id, btrim(notes), 'Airtable', now() FROM notable_people WHERE btrim(notes) <> '';
ALTER TABLE notable_people DROP COLUMN notes;
