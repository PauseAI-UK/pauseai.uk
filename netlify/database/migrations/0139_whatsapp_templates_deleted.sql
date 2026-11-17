-- A template staff deleted, which no broadcast ever used: gone from WhatsApp,
-- and from the templates to choose, but kept here, with who deleted it and
-- when, as everything else about a template is.

ALTER TABLE whatsapp_templates DROP CONSTRAINT whatsapp_templates_status_check;
ALTER TABLE whatsapp_templates ADD CONSTRAINT whatsapp_templates_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'paused', 'disabled', 'deleted'));

ALTER TABLE whatsapp_templates
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by text CHECK (deleted_by = lower(deleted_by));
ALTER TABLE whatsapp_templates ADD CONSTRAINT whatsapp_templates_deleted
  CHECK ((status = 'deleted') = (deleted_at IS NOT NULL AND deleted_by IS NOT NULL));
