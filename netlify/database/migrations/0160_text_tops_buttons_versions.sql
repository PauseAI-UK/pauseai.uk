-- A text's top, buttons and second version.

-- A picture a text shows at its top, uploaded by staff: kept here, and
-- served from the site at an address no one can guess, which WhatsApp
-- fetches each time a text with it is sent.
CREATE TABLE text_pictures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content bytea NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A template's top is the kind it has, approved with it: a place (a
-- location header) or a picture (an image header), each given each time
-- it's sent. Its buttons are each one's words, and a link button's address,
-- in order.
ALTER TABLE whatsapp_templates
  ADD COLUMN header text CHECK (header IN ('location', 'image')),
  ADD COLUMN buttons jsonb NOT NULL DEFAULT '[]';

-- A text's own top and buttons as it's written, and what its top shows: a
-- place, its name, address and point; or a picture. Both can change once
-- it's approved.
ALTER TABLE mailings
  ADD COLUMN header text CHECK (header IN ('location', 'image')),
  ADD COLUMN place jsonb,
  ADD COLUMN picture_id uuid REFERENCES text_pictures (id) ON DELETE SET NULL,
  ADD COLUMN buttons jsonb NOT NULL DEFAULT '[]';

-- A text's second version, for those who meet its condition: a whole text
-- of its own, words, top, place, picture and buttons, on a template of its
-- own. The mailing's are the version for everyone else.
CREATE TABLE broadcast_versions (
  mailing_id bigint PRIMARY KEY REFERENCES mailings (id) ON DELETE CASCADE,
  condition text NOT NULL,
  body jsonb NOT NULL,
  template_id bigint REFERENCES whatsapp_templates (id) ON DELETE SET NULL,
  header text CHECK (header IN ('location', 'image')),
  place jsonb,
  picture_id uuid REFERENCES text_pictures (id) ON DELETE SET NULL,
  buttons jsonb NOT NULL DEFAULT '[]'
);

CREATE INDEX broadcast_versions_template ON broadcast_versions (template_id) WHERE template_id IS NOT NULL;
