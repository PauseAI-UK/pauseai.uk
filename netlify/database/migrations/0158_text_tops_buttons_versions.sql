-- A text's top, reply buttons and second version. A template's top is the
-- kind it has, approved with it: a place (a location header), whose map is
-- given each time it's sent. Its reply buttons are their words, in order.
ALTER TABLE whatsapp_templates
  ADD COLUMN header text CHECK (header IN ('location')),
  ADD COLUMN buttons jsonb NOT NULL DEFAULT '[]';

-- A text's own top and buttons as it's written, and its place: the name,
-- address and point its map shows, which can change once it's approved.
ALTER TABLE mailings
  ADD COLUMN header text CHECK (header IN ('location')),
  ADD COLUMN place jsonb,
  ADD COLUMN buttons jsonb NOT NULL DEFAULT '[]';

-- A text's second version, for those who meet its condition: a whole text
-- of its own, words, top, place and buttons, on a template of its own. The
-- mailing's are the version for everyone else.
CREATE TABLE broadcast_versions (
  mailing_id bigint PRIMARY KEY REFERENCES mailings (id) ON DELETE CASCADE,
  condition text NOT NULL,
  body jsonb NOT NULL,
  template_id bigint REFERENCES whatsapp_templates (id) ON DELETE SET NULL,
  header text CHECK (header IN ('location')),
  place jsonb,
  buttons jsonb NOT NULL DEFAULT '[]'
);

CREATE INDEX broadcast_versions_template ON broadcast_versions (template_id) WHERE template_id IS NOT NULL;
