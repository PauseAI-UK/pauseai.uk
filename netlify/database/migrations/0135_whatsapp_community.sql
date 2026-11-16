-- The members of our WhatsApp community, from a CSV of each group's profile
-- names and numbers that staff upload beside paper sign-ups. Each is a form
-- entry with no email, under an upload that says which group, and where, if
-- it's a local one. docs/domain-concepts.md, "Form entries".

ALTER TABLE form_entries DROP CONSTRAINT form_entries_form_check;
ALTER TABLE form_entries ADD CONSTRAINT form_entries_form_check
  CHECK (form IN ('email-your-mp', 'web-form', 'march-2026-11', 'paper-signup', 'whatsapp-community'));
-- A WhatsApp member is known by their number alone.
ALTER TABLE form_entries ALTER COLUMN email DROP NOT NULL;
ALTER TABLE form_entries ADD CONSTRAINT form_entries_email_check
  CHECK (email IS NOT NULL OR (form = 'whatsapp-community' AND phone IS NOT NULL));

-- What an upload was: paper sign-up forms, or a WhatsApp group, whose name is
-- the note, with the town of a local group.
ALTER TABLE signup_uploads
  ADD COLUMN kind text NOT NULL DEFAULT 'paper' CHECK (kind IN ('paper', 'whatsapp')),
  ADD COLUMN town text CHECK (btrim(town) <> '');

-- A WhatsApp entry's supporter is matched by its number.
ALTER TABLE supporter_links DROP CONSTRAINT supporter_links_matched_by_check;
ALTER TABLE supporter_links ADD CONSTRAINT supporter_links_matched_by_check CHECK (matched_by IN ('email', 'phone'));

-- Every number of an erased supporter, hashed (whatsapp_number_hash()), so
-- that a later WhatsApp upload holds it back rather than add them again.
CREATE TABLE whatsapp_erased (
  number_hash text PRIMARY KEY
);

CREATE FUNCTION whatsapp_number_hash(number text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
SELECT encode(sha256(convert_to(phone_number(number), 'UTF8')), 'hex')
$$;

-- Joining a WhatsApp group is a row of history of its own, with the group's
-- name, linking to its upload.
CREATE OR REPLACE VIEW supporter_activity_form AS
 SELECT s.entry_id AS source_id,
    l.created_at AS at,
    'letter'::text AS kind,
    s.campaign AS title,
    p.name AS detail,
    ('/staff/politicians/'::text || p.id) AS href,
    l.status
   FROM ((letters_from_supporters s
     JOIN letters l ON ((l.id = s.id)))
     JOIN notable_people p ON ((p.id = l.notable_person_id)))
UNION ALL
 SELECT s.entry_id AS source_id,
    l.replied_at AS at,
    'letter-replied'::text AS kind,
    s.campaign AS title,
    p.name AS detail,
    ('/staff/politicians/'::text || p.id) AS href,
    NULL::text AS status
   FROM ((letters_from_supporters s
     JOIN letters l ON ((l.id = s.id)))
     JOIN notable_people p ON ((p.id = l.notable_person_id)))
  WHERE (l.replied_at IS NOT NULL)
UNION ALL
 SELECT f.id AS source_id,
    f.created_at AS at,
    CASE WHEN f.form = 'whatsapp-community' THEN 'whatsapp-joined' ELSE 'form-entry' END AS kind,
    f.form AS title,
    COALESCE(u.note, f.utm_source) AS detail,
    ('/staff/supporters/import/previous/'::text || u.id) AS href,
    g.status
   FROM (((form_entries f
     LEFT JOIN form_entry_luma g ON ((g.entry_id = f.id)))
     LEFT JOIN signup_upload_entries e ON ((e.entry_id = f.id)))
     LEFT JOIN signup_uploads u ON ((u.id = e.upload_id)))
  WHERE (NOT (EXISTS ( SELECT 1
           FROM letters_from_supporters s
          WHERE (s.entry_id = f.id))));

-- Two supporters with one number are one person when it's a UK mobile, or
-- when either gave it in a WhatsApp entry, as a WhatsApp account is a phone one
-- person carries, wherever its number is from. Landlines and other numbers
-- abroad aren't matched, as households and offices share them.
CREATE OR REPLACE FUNCTION merge_supporters_by_phone(only_for bigint[] DEFAULT NULL) RETURNS SETOF bigint
LANGUAGE plpgsql ROWS 10 AS $_$
DECLARE
  numbers text[];
  pair record;
  merged boolean;
BEGIN
  IF only_for IS NOT NULL THEN
    numbers := (SELECT array_agg(DISTINCT phone_number(c.phone)) FROM supporter_contact c
                WHERE c.supporter_id = ANY(only_for) AND phone_number(c.phone) IS NOT NULL);
    IF numbers IS NULL THEN
      RETURN;
    END IF;
  END IF;
  LOOP
    merged := false;
    FOR pair IN
      WITH given AS (
        SELECT k.supporter_id, phone_number(g.phone) AS phone, false AS whatsapp FROM luma_guests g
          JOIN supporter_links k ON k.luma_user_id = g.user_id
        UNION SELECT k.supporter_id, phone_number(f.phone), f.form = 'whatsapp-community' FROM form_entries f
          JOIN supporter_links k ON k.form_entry_id = f.id
        UNION SELECT k.supporter_id, phone_number(c.phone), false FROM civicrm_contacts c
          JOIN supporter_links k ON k.civicrm_contact_id = c.contact_id
      ),
      held AS (
        SELECT g.supporter_id, g.phone, bool_or(g.whatsapp) AS whatsapp FROM given g
        WHERE g.phone IS NOT NULL AND (numbers IS NULL OR g.phone = ANY(numbers))
        GROUP BY g.supporter_id, g.phone
      )
      SELECT a.supporter_id AS from_id, min(b.supporter_id) AS into_id
      FROM held a JOIN held b ON b.phone = a.phone AND b.supporter_id < a.supporter_id
      WHERE a.phone LIKE '+447%' OR a.whatsapp OR b.whatsapp
      GROUP BY a.supporter_id ORDER BY a.supporter_id DESC
    LOOP
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

-- Whether we may contact an address or number about a topic by a way, and
-- why, as 0121 has it, with a WhatsApp member's number a yes to the newsletter
-- by text: they agreed to it with an admin before joining. That yes is older
-- than any opt-out, whenever it was uploaded, so a stop in force always wins.
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
    -- In our WhatsApp community, unless they've opted out since, or before.
    SELECT 'yes', 'joined-whatsapp', min(f.created_at), 'whatsapp-community'
    FROM form_entries f
    WHERE for_topic = 'newsletter' AND for_way = 'text' AND f.form = 'whatsapp-community'
      AND phone_number(f.phone) = for_address
      AND NOT EXISTS (SELECT 1 FROM opt_outs o WHERE o.way = 'text' AND o.address = for_address
        AND o.list = 'newsletter' AND o.resubscribed_at IS NULL)
    HAVING count(*) > 0
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

-- The numbers with an answer, as 0121 has them, with a WhatsApp member's.
CREATE OR REPLACE VIEW phone_permissions AS
SELECT t.topic, t.way, t.address, d.send, d.reason, d.at, d.source
FROM (
  SELECT 'newsletter' AS topic, 'text' AS way, phone_number(phone) AS address FROM form_entries
    WHERE form IN ('march-2026-11', 'paper-signup', 'whatsapp-community') AND phone_number(phone) IS NOT NULL
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

-- Where a supporter is: a local WhatsApp group's town comes last, after an
-- event, as people join a group near them, not always where they live.
CREATE OR REPLACE VIEW supporter_place AS
 WITH candidates AS (
         SELECT c.supporter_id,
            1 AS rank,
            c.at,
            p.latitude,
            p.longitude,
            p.place,
            p.country,
            'postcode'::text AS basis,
            c.postcode AS given
           FROM (supporter_contact c
             JOIN postcode_places p ON ((p.postcode = upper(replace(c.postcode, ' '::text, ''::text)))))
          WHERE (p.latitude IS NOT NULL)
        UNION ALL
         SELECT c.supporter_id,
            2,
            c.at,
            n.latitude,
            n.longitude,
            n.place,
            n.country,
            'city'::text,
            c.city
           FROM (supporter_contact c
             JOIN named_places n ON ((n.name = lower(TRIM(BOTH FROM c.city)))))
          WHERE ((c.source <> 'luma'::text) AND (n.latitude IS NOT NULL))
        UNION ALL
         SELECT k.supporter_id,
            3,
            g.registered_at,
            e.latitude,
            e.longitude,
            COALESCE(n.place, e.city) AS "coalesce",
            n.country,
            'event'::text,
            e.name
           FROM (((luma_guests g
             JOIN supporter_links k ON ((k.luma_user_id = g.user_id)))
             JOIN luma_events e ON ((e.id = g.event_id)))
             LEFT JOIN named_places n ON ((n.name = lower(TRIM(BOTH FROM e.city)))))
          WHERE ((e.latitude IS NOT NULL) AND (g.approval_status <> 'declined'::text) AND (NOT (e.tags && ARRAY['Big events'::text, 'Online'::text])))
        UNION ALL
         SELECT k.supporter_id,
            4,
            f.created_at,
            n.latitude,
            n.longitude,
            n.place,
            n.country,
            'group'::text,
            u.note
           FROM ((((form_entries f
             JOIN supporter_links k ON ((k.form_entry_id = f.id)))
             JOIN signup_upload_entries e ON ((e.entry_id = f.id)))
             JOIN signup_uploads u ON ((u.id = e.upload_id)))
             JOIN named_places n ON ((n.name = lower(TRIM(BOTH FROM u.town)))))
          WHERE (n.latitude IS NOT NULL)
        )
 SELECT DISTINCT ON (supporter_id) supporter_id,
    latitude,
    longitude,
    place,
    country,
    basis,
    given,
    at
   FROM candidates
  ORDER BY supporter_id, rank, at DESC;

-- The list, rebuilt so a supporter known by their number alone has no newest
-- email, rather than a WhatsApp entry's NULL.
DROP VIEW supporters_listed;
DROP FUNCTION supporters_added();
DROP MATERIALIZED VIEW supporters_list;

-- A supporter's summary, as before, but for their name, which is a WhatsApp
-- profile name only when nothing else gives one, and their emails, which
-- leave out a WhatsApp entry's none.
CREATE OR REPLACE VIEW supporters_summary AS
 WITH ident AS (
         SELECT supporter_identity.supporter_id,
            (array_agg(supporter_identity.name ORDER BY (supporter_identity.source = 'whatsapp-community'::text), supporter_identity.seen_at DESC NULLS LAST, supporter_identity.name) FILTER (WHERE (supporter_identity.name <> ''::text)))[1] AS name,
            array_agg(DISTINCT supporter_identity.email ORDER BY supporter_identity.email) FILTER (WHERE (supporter_identity.email IS NOT NULL)) AS emails,
            array_agg(DISTINCT supporter_identity.source ORDER BY supporter_identity.source) AS sources
           FROM supporter_identity
          GROUP BY supporter_identity.supporter_id
        ), act AS (
         SELECT supporter_activity.supporter_id,
            bool_or((supporter_activity.kind = 'luma-contact'::text)) AS luma_contact,
            max(supporter_activity.at) AS last_active_at,
            (count(DISTINCT supporter_activity.href) FILTER (WHERE (((supporter_activity.kind = 'luma-registered'::text) AND (supporter_activity.detail <> 'declined'::text)) OR (supporter_activity.kind = 'luma-hosted'::text))))::integer AS events,
            (count(*) FILTER (WHERE (supporter_activity.kind = 'letter'::text)))::integer AS letters
           FROM supporter_activity
          GROUP BY supporter_activity.supporter_id
        ), contact AS (
         SELECT supporter_contact.supporter_id,
            (array_agg(supporter_contact.phone ORDER BY supporter_contact.at DESC, supporter_contact.phone) FILTER (WHERE (supporter_contact.phone IS NOT NULL)))[1] AS phone,
            (array_agg(supporter_contact.postcode ORDER BY supporter_contact.at DESC, supporter_contact.postcode) FILTER (WHERE (supporter_contact.postcode IS NOT NULL)))[1] AS postcode
           FROM supporter_contact
          GROUP BY supporter_contact.supporter_id
        ), mem AS (
         SELECT DISTINCT k.supporter_id
           FROM (supporter_links k
             JOIN civicrm_contacts c ON ((c.contact_id = k.civicrm_contact_id)))
          WHERE (c.gone_at IS NULL)
        ), ph AS (
         SELECT n.supporter_id,
            array_agg(n.number ORDER BY n.at DESC, n.number) AS phones
           FROM ( SELECT c.supporter_id,
                    phone_number(c.phone) AS number,
                    max(c.at) AS at
                   FROM supporter_contact c
                  WHERE (phone_number(c.phone) IS NOT NULL)
                  GROUP BY c.supporter_id, (phone_number(c.phone))) n
          GROUP BY n.supporter_id
        )
 SELECT s.id,
    ident.name,
    ident.emails,
    contact.phone,
    contact.postcode,
    ident.sources,
    (COALESCE(act.luma_contact, false) AND (NOT (EXISTS ( SELECT 1
           FROM opt_outs o
          WHERE ((o.list = 'events'::text) AND (o.way = 'email'::text) AND (o.resubscribed_at IS NULL) AND (o.address = ANY (ident.emails))))))) AS luma_contact,
    s.first_seen_at,
    act.last_active_at,
    COALESCE(act.events, 0) AS events,
    COALESCE(act.letters, 0) AS letters,
    (mem.supporter_id IS NOT NULL) AS member,
    COALESCE(act.luma_contact, false) AS luma_follows,
    COALESCE(ph.phones, '{}'::text[]) AS phones
   FROM (((((supporters s
     LEFT JOIN ident ON ((ident.supporter_id = s.id)))
     LEFT JOIN act ON ((act.supporter_id = s.id)))
     LEFT JOIN contact ON ((contact.supporter_id = s.id)))
     LEFT JOIN mem ON ((mem.supporter_id = s.id)))
     LEFT JOIN ph ON ((ph.supporter_id = s.id)));

CREATE MATERIALIZED VIEW supporters_list AS
 SELECT s.id,
    s.name,
    s.emails,
    newest.email,
    s.phone,
    s.postcode,
    s.sources,
    s.luma_follows,
    s.first_seen_at,
    s.last_active_at,
    s.events,
    s.letters,
    s.member,
    sp.place,
    sp.basis,
    sp.given,
    sp.country,
    sp.latitude,
    sp.longitude,
    s.phones
   FROM ((supporters_summary s
     LEFT JOIN supporter_place sp ON ((sp.supporter_id = s.id)))
     LEFT JOIN ( SELECT DISTINCT ON (i.supporter_id) i.supporter_id,
            i.email
           FROM supporter_identity i
          WHERE i.email IS NOT NULL
          ORDER BY i.supporter_id, i.seen_at DESC NULLS LAST, i.email) newest ON ((newest.supporter_id = s.id)));

CREATE UNIQUE INDEX supporters_list_id ON supporters_list (id);
CREATE INDEX supporters_list_active ON supporters_list (last_active_at DESC NULLS LAST, id DESC);

CREATE FUNCTION supporters_added() RETURNS SETOF supporters_list
LANGUAGE plpgsql STABLE ROWS 10 AS $$
DECLARE
  newest_kept bigint := (SELECT coalesce(max(l.id), 0) FROM supporters_list l);
  added bigint;
BEGIN
  FOR added IN SELECT n.id FROM supporters n WHERE n.id > newest_kept ORDER BY n.id LOOP
    RETURN QUERY
    SELECT s.id, s.name, s.emails,
      (SELECT i.email FROM supporter_identity i WHERE i.supporter_id = s.id AND i.email IS NOT NULL
       ORDER BY i.seen_at DESC NULLS LAST, i.email LIMIT 1),
      s.phone, s.postcode, s.sources, s.luma_follows, s.first_seen_at, s.last_active_at, s.events, s.letters, s.member,
      sp.place, sp.basis, sp.given, sp.country, sp.latitude, sp.longitude, s.phones
    FROM supporters_summary s LEFT JOIN supporter_place sp ON sp.supporter_id = s.id
    WHERE s.id = added;
  END LOOP;
END
$$;

CREATE VIEW supporters_listed AS
SELECT * FROM supporters_list
UNION ALL
SELECT * FROM supporters_added();
