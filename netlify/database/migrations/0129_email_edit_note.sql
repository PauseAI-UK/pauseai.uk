-- A staff member changing a politician's email says why: the audit log
-- refuses an "edit politician" entry by staff (logged by their email) that
-- changes the email without a note. An import's, logged by its job, needs
-- none. NOT VALID, so edits logged before this stay as they were; every new
-- entry is checked.
ALTER TABLE audit_log ADD CONSTRAINT audit_log_email_edit_note
  CHECK (
    action <> 'edit politician'
    OR NOT details->'changed' ? 'email'
    OR actor NOT LIKE '%@%'
    OR btrim(coalesce(details->>'note', '')) <> ''
  ) NOT VALID;
