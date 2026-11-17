-- Every phone number is in international format: +, the country code, then
-- the number, digits alone, at most fifteen (isInternational() in
-- lib/phone.ts). The `phone` domain is that rule, written once. Each column
-- that holds a number, or a number on some rows, is checked by casting it to
-- the domain, so the database refuses any other from any code; a new column
-- for numbers is declared `phone` (tests/checks/phone-columns.test.ts).
-- Nothing reads a number as typed any more, so phone_number() goes, and
-- everything that matched through it compares the column itself.

CREATE DOMAIN phone AS text CHECK (VALUE ~ '^\+[1-9][0-9]{6,14}$');

ALTER TABLE form_entries ADD CONSTRAINT form_entries_phone_check CHECK (phone::phone IS NOT DISTINCT FROM phone);
ALTER TABLE luma_guests ADD CONSTRAINT luma_guests_phone_check CHECK (phone::phone IS NOT DISTINCT FROM phone);
ALTER TABLE civicrm_contacts ADD CONSTRAINT civicrm_contacts_phone_check CHECK (phone::phone IS NOT DISTINCT FROM phone);
ALTER TABLE civicrm_updates ADD CONSTRAINT civicrm_updates_phone_check CHECK (phone::phone IS NOT DISTINCT FROM phone);
ALTER TABLE whatsapp_unreachable ADD CONSTRAINT whatsapp_unreachable_number_check
  CHECK (number::phone IS NOT DISTINCT FROM number);
-- A text's or a call's opt-out, or choice, is of a number.
ALTER TABLE opt_outs ADD CONSTRAINT opt_outs_number_check
  CHECK (way = 'email' OR address::phone IS NOT DISTINCT FROM address);
ALTER TABLE preference_choices ADD CONSTRAINT preference_choices_number_check
  CHECK (way = 'email' OR address::phone IS NOT DISTINCT FROM address);
ALTER TABLE supporter_links ADD CONSTRAINT supporter_links_number_check
  CHECK (matched_by <> 'phone' OR matched_value::phone IS NOT DISTINCT FROM matched_value);
-- A reply by WhatsApp is from a number.
ALTER TABLE broadcast_replies ADD CONSTRAINT broadcast_replies_number_check
  CHECK (provider_message_id IS NULL OR from_address::phone IS NOT DISTINCT FROM from_address);

CREATE OR REPLACE FUNCTION public.contact_permission(for_topic text, for_way text, for_address text)
 RETURNS TABLE(send text, reason text, at timestamp with time zone, source text)
 LANGUAGE sql
 STABLE
AS $function$
WITH
  -- The CiviCRM contacts of the address, or who gave the number.
  civi AS (
    SELECT c.* FROM civicrm_contacts c WHERE for_way = 'email' AND c.email = for_address
    UNION
    SELECT c.* FROM civicrm_contacts c WHERE for_way <> 'email' AND c.phone = for_address
  ),
  -- The contacts who gave the number, for a volunteering call or text, each
  -- with whether they wanted to volunteer, and when they joined.
  callers AS (
    SELECT coalesce(c.intent IN ('volunteer', 'lead') OR (c.intent IS NULL AND c.joined_date < '2026-06-30'), false)
        AS volunteer,
      civicrm_joined_at(c.joined_date, c.first_seen_at) AS at, 'civicrm' AS source
    FROM civi c
    WHERE for_way IN ('call', 'text') AND for_topic = 'volunteering' AND c.gone_at IS NULL
      AND c.phone = for_address
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
        OR (for_way = 'text' AND f.phone = for_address AND f.form IN ('march-2026-11', 'paper-signup')))
    UNION ALL
    -- In our WhatsApp community, unless they've opted out since, or before.
    SELECT 'yes', 'joined-whatsapp', min(f.created_at), 'whatsapp-community'
    FROM form_entries f
    WHERE for_topic = 'newsletter' AND for_way = 'text' AND f.form = 'whatsapp-community'
      AND f.phone = for_address
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
            AND l.user_id IN (SELECT g.user_id FROM luma_guests g WHERE g.phone = for_address)
          ORDER BY o.id IS NULL DESC, coalesce(o.unsubscribed_at, l.contact_since) DESC
          LIMIT 1) a
    WHERE for_way = 'text' AND for_topic = 'events'
    UNION ALL
    -- A number for text updates on a day still to end.
    SELECT 'yes', 'gave-number', f.created_at, f.form
    FROM form_entries f JOIN day_texts d ON d.form = f.form
    WHERE for_way = 'text' AND for_topic = 'events' AND f.phone = for_address AND now() < d.ends_at
    UNION ALL
    -- A contact who chose to volunteer gave the number.
    SELECT 'yes', 'volunteered', c.at, c.source FROM callers c WHERE c.volunteer
  ),
  nothing AS (
    SELECT 'declined' AS reason, f.created_at AS at, f.form AS source
    FROM form_entries f
    WHERE for_topic = 'newsletter' AND NOT f.contact_consent
      AND ((for_way = 'email' AND lower(trim(f.email)) = for_address)
        OR (for_way = 'text' AND f.phone = for_address AND f.form IN ('march-2026-11', 'paper-signup')))
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
      AND c.phone = for_address
    UNION ALL
    SELECT 'not-following', NULL, 'luma'
    FROM luma_people l
    WHERE for_way = 'email' AND for_topic = 'events' AND l.email = for_address
    UNION ALL
    SELECT 'not-following', NULL, 'luma'
    FROM luma_guests g
    WHERE for_way = 'text' AND for_topic = 'events' AND g.phone = for_address
    UNION ALL
    SELECT 'ended', d.ends_at, f.form
    FROM form_entries f JOIN day_texts d ON d.form = f.form
    WHERE for_way = 'text' AND for_topic = 'events' AND f.phone = for_address AND now() >= d.ends_at
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
$function$

;

CREATE OR REPLACE FUNCTION public.merge_supporters_by_phone(only_for bigint[] DEFAULT NULL::bigint[])
 RETURNS SETOF bigint
 LANGUAGE plpgsql
 ROWS 10
AS $function$
DECLARE
  numbers text[];
  pair record;
  merged boolean;
BEGIN
  IF only_for IS NOT NULL THEN
    numbers := (SELECT array_agg(DISTINCT c.phone) FROM supporter_contact c
                WHERE c.supporter_id = ANY(only_for) AND c.phone IS NOT NULL);
    IF numbers IS NULL THEN
      RETURN;
    END IF;
  END IF;
  LOOP
    merged := false;
    FOR pair IN
      WITH given AS (
        SELECT k.supporter_id, g.phone AS phone, false AS whatsapp FROM luma_guests g
          JOIN supporter_links k ON k.luma_user_id = g.user_id
        UNION SELECT k.supporter_id, f.phone, f.form = 'whatsapp-community' FROM form_entries f
          JOIN supporter_links k ON k.form_entry_id = f.id
        UNION SELECT k.supporter_id, c.phone, false FROM civicrm_contacts c
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
$function$

;

CREATE OR REPLACE VIEW public.phone_permissions AS
 SELECT t.topic,
    t.way,
    t.address,
    d.send,
    d.reason,
    d.at,
    d.source
   FROM ( SELECT 'newsletter'::text AS topic,
            'text'::text AS way,
            form_entries.phone AS address
           FROM form_entries
          WHERE (form_entries.form = ANY (ARRAY['march-2026-11'::text, 'paper-signup'::text, 'whatsapp-community'::text])) AND form_entries.phone IS NOT NULL
        UNION
         SELECT 'events'::text AS text,
            'text'::text AS text,
            luma_guests.phone AS phone_number
           FROM luma_guests
          WHERE luma_guests.phone IS NOT NULL
        UNION
         SELECT 'events'::text AS text,
            'text'::text AS text,
            form_entries.phone AS phone_number
           FROM form_entries
          WHERE (form_entries.form IN ( SELECT day_texts.form
                   FROM day_texts)) AND form_entries.phone IS NOT NULL
        UNION
         SELECT 'volunteering'::text AS text,
            w.way,
            civicrm_contacts.phone AS phone_number
           FROM civicrm_contacts,
            ( VALUES ('call'::text), ('text'::text)) w(way)
          WHERE civicrm_contacts.phone IS NOT NULL
        UNION
         SELECT opt_outs.list,
            opt_outs.way,
            opt_outs.address
           FROM opt_outs
          WHERE opt_outs.way <> 'email'::text AND opt_outs.list <> 'all'::text AND opt_outs.resubscribed_at IS NULL
        UNION
         SELECT t_1.topic,
            o.way,
            o.address
           FROM opt_outs o
             JOIN ( VALUES ('newsletter'::text,'text'::text), ('events'::text,'text'::text), ('volunteering'::text,'text'::text), ('volunteering'::text,'call'::text)) t_1(topic, way) ON t_1.way = o.way
          WHERE o.list = 'all'::text AND o.way <> 'email'::text AND o.resubscribed_at IS NULL
        UNION
         SELECT preference_choices.topic,
            preference_choices.way,
            preference_choices.address
           FROM preference_choices
          WHERE preference_choices.way <> 'email'::text) t
     CROSS JOIN LATERAL contact_permission(t.topic, t.way, t.address) d(send, reason, at, source);

CREATE OR REPLACE VIEW public.supporters_summary AS
 WITH ident AS (
         SELECT supporter_identity.supporter_id,
            (array_agg(supporter_identity.name ORDER BY (supporter_identity.source = 'whatsapp-community'::text), supporter_identity.seen_at DESC NULLS LAST, supporter_identity.name) FILTER (WHERE supporter_identity.name <> ''::text))[1] AS name,
            array_agg(DISTINCT supporter_identity.email ORDER BY supporter_identity.email) FILTER (WHERE supporter_identity.email IS NOT NULL) AS emails,
            array_agg(DISTINCT supporter_identity.source ORDER BY supporter_identity.source) AS sources
           FROM supporter_identity
          GROUP BY supporter_identity.supporter_id
        ), act AS (
         SELECT supporter_activity.supporter_id,
            bool_or(supporter_activity.kind = 'luma-contact'::text) AS luma_contact,
            max(supporter_activity.at) AS last_active_at,
            count(DISTINCT supporter_activity.href) FILTER (WHERE supporter_activity.kind = 'luma-registered'::text AND supporter_activity.detail <> 'declined'::text OR supporter_activity.kind = 'luma-hosted'::text)::integer AS events,
            count(*) FILTER (WHERE supporter_activity.kind = 'letter'::text)::integer AS letters
           FROM supporter_activity
          GROUP BY supporter_activity.supporter_id
        ), contact AS (
         SELECT supporter_contact.supporter_id,
            (array_agg(supporter_contact.phone ORDER BY supporter_contact.at DESC, supporter_contact.phone) FILTER (WHERE supporter_contact.phone IS NOT NULL))[1] AS phone,
            (array_agg(supporter_contact.postcode ORDER BY supporter_contact.at DESC, supporter_contact.postcode) FILTER (WHERE supporter_contact.postcode IS NOT NULL))[1] AS postcode
           FROM supporter_contact
          GROUP BY supporter_contact.supporter_id
        ), mem AS (
         SELECT DISTINCT k.supporter_id
           FROM supporter_links k
             JOIN civicrm_contacts c ON c.contact_id = k.civicrm_contact_id
          WHERE c.gone_at IS NULL
        ), ph AS (
         SELECT n.supporter_id,
            array_agg(n.number ORDER BY n.at DESC, n.number) AS phones
           FROM ( SELECT c.supporter_id,
                    c.phone AS number,
                    max(c.at) AS at
                   FROM supporter_contact c
                  WHERE c.phone IS NOT NULL
                  GROUP BY c.supporter_id, (c.phone)) n
          GROUP BY n.supporter_id
        )
 SELECT s.id,
    ident.name,
    ident.emails,
    contact.phone,
    contact.postcode,
    ident.sources,
    COALESCE(act.luma_contact, false) AND NOT (EXISTS ( SELECT 1
           FROM opt_outs o
          WHERE o.list = 'events'::text AND o.way = 'email'::text AND o.resubscribed_at IS NULL AND (o.address = ANY (ident.emails)))) AS luma_contact,
    s.first_seen_at,
    act.last_active_at,
    COALESCE(act.events, 0) AS events,
    COALESCE(act.letters, 0) AS letters,
    mem.supporter_id IS NOT NULL AS member,
    COALESCE(act.luma_contact, false) AS luma_follows,
    COALESCE(ph.phones, '{}'::text[]) AS phones
   FROM supporters s
     LEFT JOIN ident ON ident.supporter_id = s.id
     LEFT JOIN act ON act.supporter_id = s.id
     LEFT JOIN contact ON contact.supporter_id = s.id
     LEFT JOIN mem ON mem.supporter_id = s.id
     LEFT JOIN ph ON ph.supporter_id = s.id;

-- A number is hashed as it's kept; one in any other form is refused.
CREATE OR REPLACE FUNCTION public.whatsapp_number_hash(number text) RETURNS text
  LANGUAGE sql IMMUTABLE
  AS $$ SELECT encode(sha256(convert_to(number::phone, 'UTF8')), 'hex') $$;

DROP INDEX civicrm_contacts_phone;
DROP INDEX form_entries_phone;
DROP INDEX luma_guests_phone;
CREATE INDEX civicrm_contacts_phone ON civicrm_contacts (phone);
CREATE INDEX form_entries_phone ON form_entries (phone);
CREATE INDEX luma_guests_phone ON luma_guests (phone);

DROP FUNCTION phone_number(text);
