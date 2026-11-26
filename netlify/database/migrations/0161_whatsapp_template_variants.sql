-- A WhatsApp template as staff name and pick it, with one or two variants,
-- and a WhatsApp broadcast's words kept only there.

-- What WhatsApp has is a variant: its words, the kind of header it has and
-- its buttons, as WhatsApp approves them. The table of them is named for
-- that, with its constraints, indexes and sequence.
ALTER TABLE whatsapp_templates RENAME TO whatsapp_template_variants;

DO $$
DECLARE
  one record;
BEGIN
  FOR one IN
    SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'whatsapp_template_variants' AND c.conname LIKE 'whatsapp\_templates\_%'
  LOOP
    EXECUTE format('ALTER TABLE whatsapp_template_variants RENAME CONSTRAINT %I TO %I',
      one.conname, 'whatsapp_template_variants' || substr(one.conname, length('whatsapp_templates') + 1));
  END LOOP;
  FOR one IN
    SELECT relname, relkind FROM pg_class WHERE relname LIKE 'whatsapp\_templates\_%' AND relkind IN ('i', 'S')
  LOOP
    EXECUTE format('ALTER %s %I RENAME TO %I', CASE one.relkind WHEN 'i' THEN 'INDEX' ELSE 'SEQUENCE' END,
      one.relname, 'whatsapp_template_variants' || substr(one.relname, length('whatsapp_templates') + 1));
  END LOOP;
END $$;

-- A variant not yet sent to WhatsApp is a draft: words being written, which
-- have no name there. Every other variant keeps the name it went by.
ALTER TABLE whatsapp_template_variants
  ALTER COLUMN name DROP NOT NULL,
  DROP CONSTRAINT whatsapp_template_variants_status_check,
  ADD CONSTRAINT whatsapp_template_variants_status_check
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'paused', 'disabled', 'deleted')),
  ADD CONSTRAINT whatsapp_template_variants_named CHECK (status = 'draft' OR name IS NOT NULL);

-- A template: its name, and its variants. One variant goes to everyone; or,
-- with a condition, the conditional variant goes to those who meet it and the
-- default one to everyone else. The two may be the same variant, where only
-- what their headers show differs. A variant may be in more than one
-- template, as a template made from an approved one's words keeps the
-- variants it hasn't changed.
CREATE TABLE whatsapp_templates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  condition text,
  default_variant_id bigint NOT NULL REFERENCES whatsapp_template_variants (id),
  conditional_variant_id bigint REFERENCES whatsapp_template_variants (id),
  created_by text CHECK (created_by = lower(created_by)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_templates_conditional CHECK ((condition IS NULL) = (conditional_variant_id IS NULL))
);

CREATE INDEX whatsapp_templates_default_variant ON whatsapp_templates (default_variant_id);
CREATE INDEX whatsapp_templates_conditional_variant ON whatsapp_templates (conditional_variant_id)
  WHERE conditional_variant_id IS NOT NULL;

-- What each variant's header shows in one broadcast: a place, or a picture.
-- Not the template's, as each send gives it.
CREATE TABLE broadcast_headers (
  mailing_id bigint NOT NULL REFERENCES mailings (id) ON DELETE CASCADE,
  variant text NOT NULL CHECK (variant IN ('default', 'conditional')),
  place jsonb,
  picture_id uuid REFERENCES text_pictures (id) ON DELETE SET NULL,
  PRIMARY KEY (mailing_id, variant)
);

-- A broadcast's template was a variant; it's now a template. The variant is
-- kept beside it while the templates are made.
ALTER TABLE mailings DROP CONSTRAINT mailings_template_id_fkey;
ALTER TABLE mailings RENAME COLUMN template_id TO variant_id;
ALTER TABLE mailings ADD COLUMN template_id bigint REFERENCES whatsapp_templates (id);

DO $$
DECLARE
  one record;
  made bigint;
BEGIN
  -- Words written on a broadcast and not yet sent to WhatsApp become draft
  -- variants: its own, where it has words or a second version, and its
  -- second version's.
  FOR one IN
    SELECT m.id, m.body, m.header, m.buttons, m.created_by FROM mailings m
    WHERE m.channel = 'text' AND m.variant_id IS NULL
      AND (jsonb_array_length(m.body -> 'content') > 0
        OR EXISTS (SELECT 1 FROM broadcast_versions v WHERE v.mailing_id = m.id))
  LOOP
    INSERT INTO whatsapp_template_variants (body, status, created_by, header, buttons)
    VALUES (one.body, 'draft', one.created_by, one.header, one.buttons) RETURNING id INTO made;
    UPDATE mailings SET variant_id = made WHERE id = one.id;
  END LOOP;
  FOR one IN
    SELECT v.mailing_id, v.body, v.header, v.buttons, m.created_by
    FROM broadcast_versions v JOIN mailings m ON m.id = v.mailing_id WHERE v.template_id IS NULL
  LOOP
    INSERT INTO whatsapp_template_variants (body, status, created_by, header, buttons)
    VALUES (one.body, 'draft', one.created_by, one.header, one.buttons) RETURNING id INTO made;
    UPDATE broadcast_versions SET template_id = made WHERE mailing_id = one.mailing_id;
  END LOOP;

  -- A template for each set of variants a broadcast has: one variant, or
  -- two and the condition. One variant's is named as the variant is; two
  -- variants' as the newest broadcast with them is titled.
  FOR one IN
    SELECT DISTINCT ON (m.variant_id, v.template_id, v.condition)
      m.variant_id AS own, v.template_id AS theirs, v.condition, m.title, t.name AS variant_name,
      t.created_by, t.created_at
    FROM mailings m JOIN whatsapp_template_variants t ON t.id = m.variant_id
      LEFT JOIN broadcast_versions v ON v.mailing_id = m.id
    ORDER BY m.variant_id, v.template_id, v.condition, m.id DESC
  LOOP
    INSERT INTO whatsapp_templates (name, condition, default_variant_id, conditional_variant_id, created_by, created_at)
    VALUES (
      CASE WHEN one.theirs IS NULL THEN coalesce(one.variant_name, one.title)
        ELSE coalesce(nullif(one.title, ''), one.variant_name, '') END,
      one.condition, one.own, one.theirs, one.created_by, one.created_at
    ) RETURNING id INTO made;
    UPDATE mailings m SET template_id = made
    WHERE m.variant_id = one.own
      AND (SELECT v.template_id FROM broadcast_versions v WHERE v.mailing_id = m.id) IS NOT DISTINCT FROM one.theirs
      AND (SELECT v.condition FROM broadcast_versions v WHERE v.mailing_id = m.id) IS NOT DISTINCT FROM one.condition;
  END LOOP;
END $$;

-- A template for each variant no broadcast has had, such as one approved
-- and not yet used.
INSERT INTO whatsapp_templates (name, default_variant_id, created_by, created_at)
SELECT t.name, t.id, t.created_by, t.created_at FROM whatsapp_template_variants t
WHERE NOT EXISTS (
  SELECT 1 FROM whatsapp_templates s WHERE s.default_variant_id = t.id OR s.conditional_variant_id = t.id
)
ORDER BY t.id;

INSERT INTO broadcast_headers (mailing_id, variant, place, picture_id)
SELECT id, 'default', place, picture_id FROM mailings WHERE place IS NOT NULL OR picture_id IS NOT NULL;

INSERT INTO broadcast_headers (mailing_id, variant, place, picture_id)
SELECT mailing_id, 'conditional', place, picture_id FROM broadcast_versions
WHERE place IS NOT NULL OR picture_id IS NOT NULL;

-- A broadcast keeps no words, header kind or buttons of its own for WhatsApp,
-- nor a second version: they're its template's variants.
DROP TABLE broadcast_versions;

ALTER TABLE mailings
  DROP COLUMN variant_id,
  DROP COLUMN header,
  DROP COLUMN place,
  DROP COLUMN picture_id,
  DROP COLUMN buttons;

ALTER TABLE mailings ADD CONSTRAINT mailings_template_for_texts CHECK (template_id IS NULL OR channel = 'text');

CREATE INDEX mailings_template ON mailings (template_id) WHERE template_id IS NOT NULL;
