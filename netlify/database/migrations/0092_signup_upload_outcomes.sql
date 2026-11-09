-- What an import did for each person, as it did it, for the import's own page:
-- whether it made their form entry or found it there, how they were already a
-- supporter, and what came of the event: already going, or what Luma said
-- when they were registered (NULL: nothing, with no event or no yes).
ALTER TABLE signup_upload_entries
  ADD COLUMN new_entry boolean NOT NULL DEFAULT true,
  ADD COLUMN known text CHECK (known IN ('email', 'mobile')),
  ADD COLUMN luma text CHECK (luma IN ('going', 'added', 'skipped', 'failed', 'not-configured'));

ALTER TABLE signup_upload_entries ALTER COLUMN new_entry DROP DEFAULT;
