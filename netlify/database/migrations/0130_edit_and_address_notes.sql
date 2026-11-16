-- A staff member changing a politician's salutation, or adding an address
-- that links emails to them, says why, as for their email: the audit log
-- refuses such an entry by staff (logged by their email) without a note. An
-- import's, logged by its job, needs none, nor does a staff member's change
-- of a mark. NOT VALID, so entries logged before this stay as they were;
-- every new entry is checked.
ALTER TABLE audit_log DROP CONSTRAINT audit_log_email_edit_note;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_edit_note
  CHECK (
    NOT (
      (action = 'edit politician' AND (details->'changed' ? 'email' OR details->'changed' ? 'salutation'))
      OR action = 'add politician address'
    )
    OR actor NOT LIKE '%@%'
    OR btrim(coalesce(details->>'note', '')) <> ''
  ) NOT VALID;
