-- A template's footer, as it went to WhatsApp for approval: the grey line
-- under its words saying how to stop ("Reply STOP to stop event texts").
-- Kept, so every page shows what people got, whatever the footer's words
-- are later. None for a template made in WhatsApp Manager, whose footer we
-- don't know.
ALTER TABLE whatsapp_templates ADD COLUMN footer text;
