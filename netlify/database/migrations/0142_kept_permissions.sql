-- Every address's and number's consents, worked out ahead by the rules in
-- contact_permission(), so that pages counting thousands of them (the
-- supporters list's Consent filter, permissionsFor(), who a broadcast goes
-- to) read rows rather than work each one out. docs/domain-concepts.md,
-- "Whether we'd contact someone".
--
-- A row is contact_permissions' row for the address, kept up to date by the
-- triggers below on every table the rules read: a change works out again
-- every consent of each address or number it touches, in the same
-- statement, so the kept answers are never behind what's committed. Sending
-- doesn't read them: it asks contact_permission() afresh for each copy.
CREATE TABLE kept_permissions (
  channel text NOT NULL CHECK (channel IN ('email', 'phone')),
  address text NOT NULL,
  topic text NOT NULL,
  way text NOT NULL,
  send text,
  reason text,
  at timestamptz,
  source text,
  -- When time alone can change this answer: the next end of a day whose
  -- texts the number was given for (day_texts). Null for every other answer,
  -- which only a write changes.
  until timestamptz,
  PRIMARY KEY (channel, address, topic, way)
);
CREATE INDEX kept_permissions_until ON kept_permissions (until) WHERE until IS NOT NULL;

-- An address or number whose consents a transaction is working out again,
-- for as long as it does: its row is added, then deleted, by
-- keep_permissions(), and a second transaction adding the same row waits
-- till the first ends. Empty outside a transaction. Row locks, unlike
-- advisory ones, have no limit on how many a transaction holds, so an import
-- changing every contact at once can take them.
CREATE TABLE kept_permissions_locks (
  channel text NOT NULL,
  address text NOT NULL,
  PRIMARY KEY (channel, address)
);

-- Works out again every consent of these addresses (lower case and trimmed,
-- as the views have them) and numbers. Each is locked till the transaction
-- ends, in order, before its answers are read: a statement in this function
-- sees what's committed when it starts, so two transactions changing the same
-- address keep the answer of the second, worked out after the first
-- committed.
CREATE FUNCTION keep_permissions(emails text[], phones text[]) RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  emails := ARRAY(SELECT DISTINCT lower(trim(e)) FROM unnest(emails) e WHERE e IS NOT NULL);
  phones := ARRAY(SELECT DISTINCT p FROM unnest(phones) p WHERE p IS NOT NULL);
  IF cardinality(emails) = 0 AND cardinality(phones) = 0 THEN
    RETURN;
  END IF;
  INSERT INTO kept_permissions_locks (channel, address)
  SELECT * FROM (SELECT 'email', e FROM unnest(emails) e UNION ALL SELECT 'phone', p FROM unnest(phones) p) k
  ORDER BY 1, 2
  ON CONFLICT DO NOTHING;
  DELETE FROM kept_permissions k
  WHERE (k.channel = 'email' AND k.address = ANY(emails)) OR (k.channel = 'phone' AND k.address = ANY(phones));
  INSERT INTO kept_permissions (channel, address, topic, way, send, reason, at, source, until)
  SELECT p.channel, p.address, p.topic, p.way, p.send, p.reason, p.at, p.source,
    CASE WHEN p.channel = 'phone' AND p.topic = 'events' AND p.way = 'text' THEN
      (SELECT min(d.ends_at) FROM form_entries f JOIN day_texts d ON d.form = f.form
       WHERE f.phone = p.address AND d.ends_at > now())
    END
  FROM contact_permissions p
  WHERE (p.channel = 'email' AND p.address = ANY(emails)) OR (p.channel = 'phone' AND p.address = ANY(phones));
  DELETE FROM kept_permissions_locks k
  WHERE (k.channel = 'email' AND k.address = ANY(emails)) OR (k.channel = 'phone' AND k.address = ANY(phones));
END
$$;

-- After a statement on one of the tables the rules read: works out again the
-- consents of the addresses and numbers its rows, before and after
-- (`changed`), touch: those they name, and those the rules reach through
-- them. A number given at a Luma registration has the answer of the
-- account's email (luma_people, and its opt-outs of events); a day's texts
-- cover the numbers given on its form.
CREATE FUNCTION keep_permissions_after() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  changed text := CASE TG_OP
    WHEN 'INSERT' THEN 'SELECT * FROM new_rows'
    WHEN 'DELETE' THEN 'SELECT * FROM old_rows'
    ELSE 'SELECT * FROM new_rows UNION ALL SELECT * FROM old_rows'
  END;
  touched text := CASE TG_TABLE_NAME
    WHEN 'opt_outs' THEN
      $q$SELECT CASE WHEN o.way = 'email' THEN 'email' ELSE 'phone' END, o.address FROM changed o
         UNION ALL
         SELECT 'phone', g.phone FROM changed o
           JOIN luma_people l ON l.email = o.address JOIN luma_guests g ON g.user_id = l.user_id
         WHERE o.way = 'email'$q$
    WHEN 'preference_choices' THEN
      $q$SELECT CASE WHEN c.way = 'email' THEN 'email' ELSE 'phone' END, c.address FROM changed c$q$
    WHEN 'form_entries' THEN
      $q$SELECT 'email', f.email FROM changed f UNION ALL SELECT 'phone', f.phone FROM changed f$q$
    WHEN 'civicrm_contacts' THEN
      $q$SELECT 'email', c.email FROM changed c UNION ALL SELECT 'phone', c.phone FROM changed c$q$
    WHEN 'luma_people' THEN
      $q$SELECT 'email', l.email FROM changed l
         UNION ALL
         SELECT 'phone', g.phone FROM changed l JOIN luma_guests g ON g.user_id = l.user_id$q$
    WHEN 'luma_guests' THEN
      $q$SELECT 'phone', g.phone FROM changed g$q$
    WHEN 'day_texts' THEN
      $q$SELECT 'phone', f.phone FROM changed d JOIN form_entries f ON f.form = d.form$q$
    WHEN 'email_blocks' THEN
      $q$SELECT 'email', b.address FROM changed b$q$
    WHEN 'email_problems' THEN
      $q$SELECT 'email', b.address FROM changed p JOIN email_blocks b ON b.problem_id = p.id$q$
  END;
  emails text[];
  phones text[];
BEGIN
  EXECUTE format(
    'WITH changed AS (%s)
     SELECT array_agg(a.address) FILTER (WHERE a.channel = ''email''), array_agg(a.address) FILTER (WHERE a.channel = ''phone'')
     FROM (%s) a (channel, address)',
    changed, touched
  ) INTO emails, phones;
  PERFORM keep_permissions(emails, phones);
  RETURN NULL;
END
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['opt_outs', 'preference_choices', 'form_entries', 'civicrm_contacts', 'luma_people',
    'luma_guests', 'day_texts', 'email_blocks', 'email_problems']
  LOOP
    EXECUTE format('CREATE TRIGGER keep_permissions_insert AFTER INSERT ON %I REFERENCING NEW TABLE AS new_rows
      FOR EACH STATEMENT EXECUTE FUNCTION keep_permissions_after()', t);
    EXECUTE format('CREATE TRIGGER keep_permissions_update AFTER UPDATE ON %I REFERENCING OLD TABLE AS old_rows
      NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION keep_permissions_after()', t);
    EXECUTE format('CREATE TRIGGER keep_permissions_delete AFTER DELETE ON %I REFERENCING OLD TABLE AS old_rows
      FOR EACH STATEMENT EXECUTE FUNCTION keep_permissions_after()', t);
  END LOOP;
END
$$;

-- The kept answers as of now: each as kept, but one whose `until` has
-- passed, which contact_permission() works out afresh.
CREATE VIEW contact_permissions_kept AS
SELECT k.topic, k.way, k.channel, k.address, k.send, k.reason, k.at, k.source
FROM kept_permissions k
WHERE k.until IS NULL OR now() < k.until
UNION ALL
SELECT k.topic, k.way, k.channel, k.address, d.send, d.reason, d.at, d.source
FROM kept_permissions k CROSS JOIN LATERAL contact_permission(k.topic, k.way, k.address) d
WHERE k.until <= now();

SELECT keep_permissions(
  ARRAY(SELECT address FROM contact_permissions WHERE channel = 'email'),
  ARRAY(SELECT address FROM contact_permissions WHERE channel = 'phone')
);
