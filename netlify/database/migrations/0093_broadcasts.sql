-- What the staff pages for broadcasts need. A broadcast is an email or text
-- to many supporters, each person's copy of it a message.

-- The tables of messages to supporters, named as the pages name them, with
-- their constraints, indexes and sequences.
ALTER TABLE messages_to_supporters RENAME TO broadcast_messages;
ALTER TABLE message_events RENAME TO broadcast_message_events;

DO $$
DECLARE
  renames text[] := ARRAY[
    ['messages_to_supporters', 'broadcast_messages'],
    ['message_events', 'broadcast_message_events']
  ];
  pair text[];
  one record;
BEGIN
  FOREACH pair SLICE 1 IN ARRAY renames LOOP
    FOR one IN
      SELECT c.conname, t.relname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = pair[2] AND c.conname LIKE pair[1] || '\_%'
    LOOP
      EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
        one.relname, one.conname, pair[2] || substr(one.conname, length(pair[1]) + 1));
    END LOOP;
    FOR one IN
      SELECT relname, relkind FROM pg_class WHERE relname LIKE pair[1] || '\_%' AND relkind IN ('i', 'S')
    LOOP
      EXECUTE format('ALTER %s %I RENAME TO %I', CASE one.relkind WHEN 'i' THEN 'INDEX' ELSE 'SEQUENCE' END,
        one.relname, pair[2] || substr(one.relname, length(pair[1]) + 1));
    END LOOP;
  END LOOP;
END $$;

-- A text's words, as WhatsApp approves them: one made on the site, by
-- whoever sent it for approval, or with no one named, in WhatsApp Manager.
-- New words wait for approval; once approved a template is never edited;
-- rejected, it says why in plain words.
CREATE TABLE whatsapp_templates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (name <> ''),
  body jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by text CHECK (created_by = lower(created_by)),
  approved_at timestamptz,
  rejected_at timestamptz,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'approved') = (approved_at IS NOT NULL)),
  CHECK ((status = 'rejected') = (rejected_at IS NOT NULL)),
  CHECK ((status = 'rejected') = (rejected_reason IS NOT NULL))
);

-- The template a text goes on. A draft with none is on new words, or none yet.
ALTER TABLE mailings ADD COLUMN template_id bigint REFERENCES whatsapp_templates (id) ON DELETE SET NULL;
ALTER TABLE mailings ADD CONSTRAINT mailings_template_for_texts CHECK (template_id IS NULL OR channel = 'text');
CREATE INDEX mailings_template ON mailings (template_id) WHERE template_id IS NOT NULL;

-- A message never sent, as its broadcast was stopped first; and one skipped
-- as its number isn't on WhatsApp.
ALTER TABLE broadcast_messages DROP CONSTRAINT broadcast_messages_status_check;
ALTER TABLE broadcast_messages ADD CONSTRAINT broadcast_messages_status_check
  CHECK (status IN ('scheduled', 'sent', 'delivered', 'failed', 'skipped', 'cancelled'));
ALTER TABLE broadcast_messages DROP CONSTRAINT broadcast_messages_skip_reason_check;
ALTER TABLE broadcast_messages ADD CONSTRAINT broadcast_messages_skip_reason_check
  CHECK (skip_reason IN ('blocked', 'unsubscribed', 'no-permission', 'not-on-whatsapp'));
-- A supporter's page lists the broadcasts they were sent.
CREATE INDEX broadcast_messages_supporter ON broadcast_messages (supporter_id);

-- A text's read receipt.
ALTER TABLE broadcast_message_events DROP CONSTRAINT broadcast_message_events_kind_check;
ALTER TABLE broadcast_message_events ADD CONSTRAINT broadcast_message_events_kind_check
  CHECK (kind IN ('sent', 'delivered', 'read', 'failed', 'bounced', 'opted-out', 'replied'));

-- Merging supporters by phone moves their messages, by the table's new name.
CREATE OR REPLACE FUNCTION merge_supporters_by_phone(only_for bigint[] DEFAULT NULL::bigint[]) RETURNS SETOF bigint
    LANGUAGE plpgsql ROWS 10
    AS $_$
DECLARE
  numbers text[];
  pairs text;
  pair record;
  merged boolean;
BEGIN
  IF only_for IS NOT NULL THEN
    numbers := (SELECT array_agg(DISTINCT phone_number(c.phone)) FROM supporter_contact c
                WHERE c.supporter_id = ANY(only_for) AND phone_number(c.phone) LIKE '+447%');
    IF numbers IS NULL THEN
      RETURN;
    END IF;
  END IF;
  pairs := format(
    $sql$WITH numbers AS (
      SELECT k.supporter_id, phone_number(g.phone) AS phone FROM luma_guests g
        JOIN supporter_links k ON k.luma_user_id = g.user_id WHERE phone_number(g.phone) %1$s
      UNION SELECT k.supporter_id, phone_number(f.phone) FROM form_entries f
        JOIN supporter_links k ON k.form_entry_id = f.id WHERE phone_number(f.phone) %1$s
      UNION SELECT k.supporter_id, phone_number(m.phone) FROM members m
        JOIN supporter_links k ON k.member_id = m.id WHERE phone_number(m.phone) %1$s)
    SELECT a.supporter_id AS from_id, min(b.supporter_id) AS into_id
    FROM numbers a JOIN numbers b ON b.phone = a.phone AND b.supporter_id < a.supporter_id
    GROUP BY a.supporter_id ORDER BY a.supporter_id DESC$sql$,
    CASE WHEN numbers IS NULL THEN $sql$LIKE '+447%'$sql$ ELSE '= ANY($1)' END
  );
  LOOP
    merged := false;
    FOR pair IN EXECUTE pairs USING numbers LOOP
      UPDATE supporter_links SET supporter_id = pair.into_id WHERE supporter_id = pair.from_id;
      UPDATE broadcast_messages m SET supporter_id = NULL, address = NULL, merge_values = NULL
      WHERE m.supporter_id = pair.from_id
        AND EXISTS (SELECT 1 FROM broadcast_messages o WHERE o.supporter_id = pair.into_id AND o.mailing_id = m.mailing_id);
      UPDATE broadcast_messages SET supporter_id = pair.into_id WHERE supporter_id = pair.from_id;
      UPDATE notes SET supporter_id = pair.into_id WHERE supporter_id = pair.from_id;
      UPDATE supporter_merges SET into_id = pair.into_id WHERE into_id = pair.from_id;
      INSERT INTO supporter_merges (from_id, into_id) VALUES (pair.from_id, pair.into_id);
      DELETE FROM supporters WHERE id = pair.from_id;
      merged := true;
      RETURN NEXT pair.into_id;
    END LOOP;
    EXIT WHEN NOT merged;
  END LOOP;
END
$_$;
