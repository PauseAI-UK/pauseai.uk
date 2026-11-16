-- A staff member changing a politician's salutation says why, as for their
-- email: the audit log refuses an "edit politician" entry by staff (logged
-- by their email) that changes either without a note. An import's, logged
-- by its job, needs none, nor does a staff member's change of a mark. NOT
-- VALID, so edits logged before this stay as they were; every new entry is
-- checked.
ALTER TABLE audit_log DROP CONSTRAINT audit_log_email_edit_note;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_edit_note
  CHECK (
    action <> 'edit politician'
    OR NOT (details->'changed' ? 'email' OR details->'changed' ? 'salutation')
    OR actor NOT LIKE '%@%'
    OR btrim(coalesce(details->>'note', '')) <> ''
  ) NOT VALID;
