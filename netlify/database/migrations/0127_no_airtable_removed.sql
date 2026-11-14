-- Nothing marks a politician as gone from Airtable any more: the sync that
-- did is deleted, and a politician who leaves their body is marked as left.
-- None is marked now, so the column, its check and deleting such a
-- politician go.
ALTER TABLE notable_people DROP CONSTRAINT notable_people_check;
ALTER TABLE notable_people DROP COLUMN airtable_removed_at;
