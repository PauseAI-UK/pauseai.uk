-- The members come from CiviCRM alone, and Airtable's members, empty since
-- 0122_members_from_civicrm_alone.sql, go: the tables, the links' column,
-- the views of them, and every place the views and functions read them.
-- Each view and function is otherwise as the migration named before it
-- has it.

-- As 0105_members_from_civicrm.sql has them.
CREATE OR REPLACE VIEW supporter_identity AS
  SELECT k.supporter_id, 'luma' AS source, s.email, s.name, s.seen_at
  FROM supporter_source_luma s JOIN supporter_links k ON k.luma_user_id = s.source_id
  UNION ALL
  SELECT k.supporter_id, f.form, s.email, s.name, s.seen_at
  FROM supporter_source_form s JOIN supporter_links k ON k.form_entry_id = s.source_id
    JOIN form_entries f ON f.id = s.source_id
  UNION ALL
  SELECT k.supporter_id, 'civicrm', s.email, s.name, s.seen_at
  FROM supporter_source_civicrm s JOIN supporter_links k ON k.civicrm_contact_id = s.source_id;

CREATE OR REPLACE VIEW supporter_contact AS
  SELECT k.supporter_id, 'luma' AS source, c.at, c.phone, c.postcode, c.latitude, c.longitude, c.city
  FROM supporter_contact_luma c JOIN supporter_links k ON k.luma_user_id = c.source_id
  UNION ALL
  SELECT k.supporter_id, f.form, c.at, c.phone, c.postcode, c.latitude, c.longitude, c.city
  FROM supporter_contact_form c JOIN supporter_links k ON k.form_entry_id = c.source_id
    JOIN form_entries f ON f.id = c.source_id
  UNION ALL
  SELECT k.supporter_id, 'civicrm', c.at, c.phone, c.postcode, c.latitude, c.longitude, c.city
  FROM supporter_contact_civicrm c JOIN supporter_links k ON k.civicrm_contact_id = c.source_id;

CREATE OR REPLACE VIEW supporter_activity AS
  SELECT k.supporter_id, 'luma' AS source, p.contact_since AS at, 'luma-contact' AS kind, NULL::text AS title,
    NULL::text AS detail, NULL::text AS href, NULL::text AS status
  FROM luma_people p JOIN supporter_links k ON k.luma_user_id = p.user_id
  WHERE p.contact_since IS NOT NULL
  UNION ALL
  SELECT k.supporter_id, 'luma', g.registered_at, 'luma-registered', e.name, g.approval_status,
    'https://luma.com/' || e.url, NULL
  FROM luma_guests g JOIN luma_events e ON e.id = g.event_id JOIN supporter_links k ON k.luma_user_id = g.user_id
  WHERE g.removed_at IS NULL
  UNION ALL
  SELECT k.supporter_id, f.form, a.at, a.kind, a.title, a.detail, a.href, a.status
  FROM supporter_activity_form a JOIN supporter_links k ON k.form_entry_id = a.source_id
    JOIN form_entries f ON f.id = a.source_id
  UNION ALL
  SELECT k.supporter_id, o.source, o.unsubscribed_at, 'opted-out', o.list, o.address, NULL, NULL
  FROM opt_outs o JOIN (SELECT DISTINCT supporter_id, matched_value FROM supporter_links) k
    ON k.matched_value = o.address
  UNION ALL
  SELECT k.supporter_id, o.source, o.resubscribed_at, 'resubscribed', o.list, o.address, NULL, NULL
  FROM opt_outs o JOIN (SELECT DISTINCT supporter_id, matched_value FROM supporter_links) k
    ON k.matched_value = o.address
  WHERE o.resubscribed_at IS NOT NULL
  UNION ALL
  SELECT k.supporter_id, 'luma', coalesce(h.added_at, e.created_at, e.first_seen_at), 'luma-hosted', e.name, NULL,
    'https://luma.com/' || e.url, NULL
  FROM luma_event_hosts h JOIN luma_events e ON e.id = h.event_id JOIN supporter_links k ON k.luma_user_id = h.user_id
  UNION ALL
  SELECT k.supporter_id, 'civicrm', a.at, a.kind, a.title, a.detail, a.href, a.status
  FROM supporter_activity_civicrm a JOIN supporter_links k ON k.civicrm_contact_id = a.source_id
  -- A contact gone while another of theirs is returned, as when CiviCRM
  -- merges two, hasn't left.
  WHERE a.kind <> 'member-left' OR NOT EXISTS (
    SELECT 1 FROM supporter_links o JOIN civicrm_contacts c ON c.contact_id = o.civicrm_contact_id
    WHERE o.supporter_id = k.supporter_id AND c.gone_at IS NULL);

CREATE OR REPLACE VIEW supporters_summary AS
  WITH ident AS (
    SELECT supporter_id,
      (array_agg(name ORDER BY seen_at DESC NULLS LAST, name) FILTER (WHERE name <> ''))[1] AS name,
      array_agg(DISTINCT email ORDER BY email) AS emails,
      array_agg(DISTINCT source ORDER BY source) AS sources
    FROM supporter_identity
    GROUP BY supporter_id
  ), act AS (
    SELECT supporter_id,
      bool_or(kind = 'luma-contact') AS luma_contact,
      max(at) AS last_active_at,
      (count(DISTINCT href) FILTER (WHERE (kind = 'luma-registered' AND detail <> 'declined') OR kind = 'luma-hosted'))::int
        AS events,
      (count(*) FILTER (WHERE kind = 'letter'))::int AS letters
    FROM supporter_activity
    GROUP BY supporter_id
  ), contact AS (
    SELECT supporter_id,
      (array_agg(phone ORDER BY at DESC, phone) FILTER (WHERE phone IS NOT NULL))[1] AS phone,
      (array_agg(postcode ORDER BY at DESC, postcode) FILTER (WHERE postcode IS NOT NULL))[1] AS postcode
    FROM supporter_contact
    GROUP BY supporter_id
  ), mem AS (
    -- Once each, though they have more than one contact.
    SELECT DISTINCT k.supporter_id
    FROM supporter_links k JOIN civicrm_contacts c ON c.contact_id = k.civicrm_contact_id
    WHERE c.gone_at IS NULL
  ), ph AS (
    SELECT n.supporter_id, array_agg(n.number ORDER BY n.at DESC, n.number) AS phones
    FROM (SELECT c.supporter_id, phone_number(c.phone) AS number, max(c.at) AS at
          FROM supporter_contact c
          WHERE phone_number(c.phone) IS NOT NULL
          GROUP BY c.supporter_id, phone_number(c.phone)) n
    GROUP BY n.supporter_id
  )
  SELECT s.id, ident.name, ident.emails, contact.phone, contact.postcode, ident.sources,
    coalesce(act.luma_contact, false) AND NOT EXISTS (
      SELECT 1 FROM opt_outs o
      WHERE o.list = 'events' AND o.way = 'email' AND o.resubscribed_at IS NULL AND o.address = ANY (ident.emails)
    ) AS luma_contact,
    s.first_seen_at, act.last_active_at, coalesce(act.events, 0) AS events, coalesce(act.letters, 0) AS letters,
    mem.supporter_id IS NOT NULL AS member,
    coalesce(act.luma_contact, false) AS luma_follows,
    coalesce(ph.phones, '{}') AS phones
  FROM supporters s
    LEFT JOIN ident ON ident.supporter_id = s.id
    LEFT JOIN act ON act.supporter_id = s.id
    LEFT JOIN contact ON contact.supporter_id = s.id
    LEFT JOIN mem ON mem.supporter_id = s.id
    LEFT JOIN ph ON ph.supporter_id = s.id;

CREATE OR REPLACE FUNCTION merge_supporters_by_phone(only_for bigint[] DEFAULT NULL) RETURNS SETOF bigint
LANGUAGE plpgsql ROWS 10 AS $_$
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
      UNION SELECT k.supporter_id, phone_number(c.phone) FROM civicrm_contacts c
        JOIN supporter_links k ON k.civicrm_contact_id = c.contact_id WHERE phone_number(c.phone) %1$s)
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

-- As 0112_email_to_supporters.sql has it.
CREATE OR REPLACE VIEW email_permissions AS
SELECT t.topic, t.address, d.send, d.reason, d.at, d.source
FROM (
  SELECT 'newsletter' AS topic, lower(trim(email)) AS address FROM form_entries
  UNION SELECT 'newsletter', email FROM civicrm_contacts WHERE newsletter <> 'not_on_list'
  UNION SELECT 'events', email FROM luma_people
  UNION SELECT 'volunteering', email FROM civicrm_contacts WHERE volunteer_updates <> 'not_on_list'
  UNION SELECT list, address FROM opt_outs
    WHERE way = 'email' AND resubscribed_at IS NULL AND list IN ('newsletter', 'events', 'volunteering')
  UNION SELECT topic, address FROM preference_choices WHERE way = 'email' AND topic <> 'bulk'
) t
CROSS JOIN LATERAL contact_permission(t.topic, 'email', t.address) d;

-- As 0121_stop_all_texts_and_calls.sql has them.
CREATE OR REPLACE VIEW phone_permissions AS
SELECT t.topic, t.way, t.address, d.send, d.reason, d.at, d.source
FROM (
  SELECT 'newsletter' AS topic, 'text' AS way, phone_number(phone) AS address FROM form_entries
    WHERE form IN ('march-2026-11', 'paper-signup') AND phone_number(phone) IS NOT NULL
  UNION SELECT 'events', 'text', phone_number(phone) FROM luma_guests WHERE phone_number(phone) IS NOT NULL
  UNION SELECT 'events', 'text', phone_number(phone) FROM form_entries
    WHERE form IN (SELECT form FROM day_texts) AND phone_number(phone) IS NOT NULL
  UNION SELECT 'volunteering', w.way, phone_number(phone) FROM civicrm_contacts, (VALUES ('call'), ('text')) w (way)
    WHERE phone_number(phone) IS NOT NULL
  UNION SELECT list, way, address FROM opt_outs WHERE way <> 'email' AND list <> 'all' AND resubscribed_at IS NULL
  -- A stop of every text or call, for each topic that goes by that way (TOPIC_WAYS, lib/contact-permissions.ts).
  UNION SELECT t.topic, o.way, o.address FROM opt_outs o
    JOIN (VALUES ('newsletter', 'text'), ('events', 'text'), ('volunteering', 'text'), ('volunteering', 'call')) t (topic, way)
      ON t.way = o.way
    WHERE o.list = 'all' AND o.way <> 'email' AND o.resubscribed_at IS NULL
  UNION SELECT topic, way, address FROM preference_choices WHERE way <> 'email'
) t
CROSS JOIN LATERAL contact_permission(t.topic, t.way, t.address) d;

CREATE OR REPLACE FUNCTION contact_permission(for_topic text, for_way text, for_address text)
RETURNS TABLE (send text, reason text, at timestamptz, source text)
LANGUAGE sql STABLE AS $$
WITH
  -- The CiviCRM contacts of the address, or who gave the number.
  civi AS (
    SELECT c.* FROM civicrm_contacts c WHERE for_way = 'email' AND c.email = for_address
    UNION
    SELECT c.* FROM civicrm_contacts c WHERE for_way <> 'email' AND phone_number(c.phone) = for_address
  ),
  -- The contacts who gave the number, for a volunteering call or text, each
  -- with whether they wanted to volunteer, and when they joined.
  callers AS (
    SELECT coalesce(c.intent IN ('volunteer', 'lead') OR (c.intent IS NULL AND c.joined_date < '2026-06-30'), false)
        AS volunteer,
      civicrm_joined_at(c.joined_date, c.first_seen_at) AS at, 'civicrm' AS source
    FROM civi c
    WHERE for_way IN ('call', 'text') AND for_topic = 'volunteering' AND c.gone_at IS NULL
      AND phone_number(c.phone) = for_address
  ),
  -- The latest lift of "No bulk emails" on the email settings page that
  -- CiviCRM hasn't refused.
  lifted AS (
    SELECT max(p.chosen_at) AS at FROM preference_choices p
    WHERE for_way = 'email' AND p.address = for_address AND p.topic = 'bulk' AND p.refused_at IS NULL
  ),
  stops AS (
    SELECT 1 AS rank, 'blocked' AS reason, p.at, p.kind AS source
    FROM email_blocks b JOIN email_problems p ON p.id = b.problem_id
    WHERE for_way = 'email' AND b.address = for_address
    UNION ALL
    SELECT 2, 'do-not-email', min(c.do_not_email_since), 'civicrm' FROM civi c
    WHERE for_way = 'email' AND c.do_not_email HAVING count(*) > 0
    UNION ALL
    SELECT 2, 'do-not-email', o.unsubscribed_at, o.source FROM opt_outs o
    WHERE for_way = 'email' AND o.address = for_address AND o.list = 'all' AND o.resubscribed_at IS NULL
    UNION ALL
    SELECT 3, 'no-bulk-email', min(c.no_bulk_email_since), 'civicrm' FROM civi c
    WHERE for_way = 'email' AND c.no_bulk_email
      AND c.no_bulk_email_since > coalesce((SELECT l.at FROM lifted l), '-infinity')
    HAVING count(*) > 0
    UNION ALL
    SELECT 3, 'no-bulk-email', o.unsubscribed_at, o.source FROM opt_outs o
    WHERE for_way = 'email' AND o.address = for_address AND o.list = 'bulk' AND o.resubscribed_at IS NULL
    UNION ALL
    SELECT 2, 'do-not-sms', min(c.do_not_sms_since), 'civicrm' FROM civi c
    WHERE for_way = 'text' AND c.do_not_sms HAVING count(*) > 0
    UNION ALL
    SELECT 2, 'do-not-phone', min(c.do_not_phone_since), 'civicrm' FROM civi c
    WHERE for_way = 'call' AND c.do_not_phone HAVING count(*) > 0
    UNION ALL
    -- Every text, or every call, to the number stopped: by Stop everything, or WhatsApp.
    SELECT 2, 'unsubscribed', o.unsubscribed_at, o.source FROM opt_outs o
    WHERE for_way <> 'email' AND o.way = for_way AND o.address = for_address AND o.list = 'all'
      AND o.resubscribed_at IS NULL
  ),
  said AS (
    -- An opt-out in force.
    SELECT 'no' AS send, 'unsubscribed' AS reason, o.unsubscribed_at AS at, o.source
    FROM opt_outs o
    WHERE o.way = for_way AND o.address = for_address AND o.list = for_topic AND o.resubscribed_at IS NULL
    UNION ALL
    -- A ticked box on one of our forms, or a paper sign-up.
    SELECT 'yes', CASE WHEN f.form = 'paper-signup' THEN 'signed-up' ELSE 'asked' END, f.created_at, f.form
    FROM form_entries f
    WHERE for_topic = 'newsletter' AND f.contact_consent
      AND ((for_way = 'email' AND lower(trim(f.email)) = for_address)
        OR (for_way = 'text' AND phone_number(f.phone) = for_address AND f.form IN ('march-2026-11', 'paper-signup')))
    UNION ALL
    -- A box ticked on the email settings page.
    SELECT 'yes', 'chose', p.chosen_at, 'preferences'
    FROM preference_choices p
    WHERE p.address = for_address AND p.way = for_way AND p.topic = for_topic
    UNION ALL
    -- On a CiviCRM list, while a pull returns the contact.
    SELECT 'yes', 'subscribed', c.since, 'civicrm'
    FROM (SELECT min(CASE WHEN for_topic = 'newsletter' THEN c.newsletter_since ELSE c.volunteer_updates_since END) AS since
          FROM civi c
          WHERE c.gone_at IS NULL AND CASE WHEN for_topic = 'newsletter' THEN c.newsletter ELSE c.volunteer_updates END = 'subscribed') c
    WHERE for_way = 'email' AND for_topic IN ('newsletter', 'volunteering') AND c.since IS NOT NULL
    UNION ALL
    -- Following the Luma calendar.
    SELECT 'yes', 'following', f.since, 'luma'
    FROM (SELECT min(l.contact_since) AS since FROM luma_people l WHERE l.email = for_address) f
    WHERE for_way = 'email' AND for_topic = 'events' AND f.since IS NOT NULL
    UNION ALL
    -- A number given at a Luma registration has the answer of the account
    -- that gave it: of several, one that says yes, else the newest.
    SELECT a.send, a.reason, a.at, 'luma'
    FROM (SELECT
            CASE WHEN o.id IS NULL THEN 'yes' ELSE 'no' END AS send,
            CASE WHEN o.id IS NULL THEN 'following' ELSE 'unsubscribed' END AS reason,
            coalesce(o.unsubscribed_at, l.contact_since) AS at
          FROM luma_people l
            LEFT JOIN opt_outs o ON o.way = 'email' AND o.list = 'events' AND o.address = l.email
              AND o.resubscribed_at IS NULL
          WHERE l.contact_since IS NOT NULL
            AND l.user_id IN (SELECT g.user_id FROM luma_guests g WHERE phone_number(g.phone) = for_address)
          ORDER BY o.id IS NULL DESC, coalesce(o.unsubscribed_at, l.contact_since) DESC
          LIMIT 1) a
    WHERE for_way = 'text' AND for_topic = 'events'
    UNION ALL
    -- A number for text updates on a day still to end.
    SELECT 'yes', 'gave-number', f.created_at, f.form
    FROM form_entries f JOIN day_texts d ON d.form = f.form
    WHERE for_way = 'text' AND for_topic = 'events' AND phone_number(f.phone) = for_address AND now() < d.ends_at
    UNION ALL
    -- A contact who chose to volunteer gave the number.
    SELECT 'yes', 'volunteered', c.at, c.source FROM callers c WHERE c.volunteer
  ),
  nothing AS (
    SELECT 'declined' AS reason, f.created_at AS at, f.form AS source
    FROM form_entries f
    WHERE for_topic = 'newsletter' AND NOT f.contact_consent
      AND ((for_way = 'email' AND lower(trim(f.email)) = for_address)
        OR (for_way = 'text' AND phone_number(f.phone) = for_address AND f.form IN ('march-2026-11', 'paper-signup')))
    UNION ALL
    SELECT 'not-volunteer', c.at, c.source FROM callers c WHERE NOT c.volunteer
    UNION ALL
    SELECT 'not-opted-in', c.newsletter_since, 'civicrm'
    FROM civi c
    WHERE for_way = 'email' AND for_topic = 'newsletter' AND c.gone_at IS NULL AND c.newsletter = 'not_opted_in'
    UNION ALL
    SELECT 'left', c.gone_at, 'civicrm'
    FROM civi c
    WHERE for_way = 'email' AND for_topic IN ('newsletter', 'volunteering') AND c.gone_at IS NOT NULL
      AND CASE WHEN for_topic = 'newsletter' THEN c.newsletter ELSE c.volunteer_updates END <> 'not_on_list'
    UNION ALL
    SELECT 'left', c.gone_at, 'civicrm'
    FROM civi c
    WHERE for_way IN ('call', 'text') AND for_topic = 'volunteering' AND c.gone_at IS NOT NULL
      AND phone_number(c.phone) = for_address
    UNION ALL
    SELECT 'not-following', NULL, 'luma'
    FROM luma_people l
    WHERE for_way = 'email' AND for_topic = 'events' AND l.email = for_address
    UNION ALL
    SELECT 'not-following', NULL, 'luma'
    FROM luma_guests g
    WHERE for_way = 'text' AND for_topic = 'events' AND phone_number(g.phone) = for_address
    UNION ALL
    SELECT 'ended', d.ends_at, f.form
    FROM form_entries f JOIN day_texts d ON d.form = f.form
    WHERE for_way = 'text' AND for_topic = 'events' AND phone_number(f.phone) = for_address AND now() >= d.ends_at
  )
SELECT r.send, r.reason, r.at, r.source FROM (
  (SELECT 1 AS tier, s.rank, 'no' AS send, s.reason, s.at, s.source FROM stops s ORDER BY s.rank, s.at LIMIT 1)
  UNION ALL
  (SELECT 2, 0, s.send, s.reason, s.at, s.source FROM said s ORDER BY s.at DESC, s.send = 'no' DESC LIMIT 1)
  UNION ALL
  (SELECT 3, 0, 'no', n.reason, n.at, n.source FROM nothing n ORDER BY n.at DESC NULLS LAST LIMIT 1)
) r
ORDER BY r.tier, r.rank
LIMIT 1
$$;

DROP VIEW supporter_source_airtable, supporter_contact_airtable, supporter_activity_airtable;
ALTER TABLE supporter_links DROP CONSTRAINT supporter_links_check;
ALTER TABLE supporter_links DROP COLUMN airtable_member_id;
ALTER TABLE supporter_links ADD CONSTRAINT supporter_links_check
  CHECK (num_nonnulls(luma_user_id, form_entry_id, civicrm_contact_id) = 1);
DROP TABLE airtable_members, airtable_members_erased;
