-- The consents: three topics that say what we'd send, the UK newsletter
-- (which includes events), events only, and volunteering, each asked by a
-- way, email, text or call. They replace the topics named for where a yes
-- came from (luma-calendar, pauseai-updates, site-forms, volunteering by
-- phone and march-day), and CiviCRM is one of their sources.

-- An opt-out is from a topic by one way. Luma's calendar emails are events
-- by email, and pauseai-updates was the newsletter. Every opt-out so far is
-- by email. CiviCRM tells us of an unsubscribe from its lists.
ALTER TABLE opt_outs DROP CONSTRAINT opt_outs_list_check;
ALTER TABLE opt_outs DROP CONSTRAINT opt_outs_channel_check;
ALTER TABLE opt_outs DROP CONSTRAINT opt_outs_source_check;
UPDATE opt_outs SET list = CASE list WHEN 'luma-calendar' THEN 'events' ELSE 'newsletter' END;
UPDATE opt_outs SET channel = 'text' WHERE channel = 'phone';
ALTER TABLE opt_outs RENAME COLUMN channel TO way;
ALTER TABLE opt_outs ADD CONSTRAINT opt_outs_list_check CHECK (list IN ('newsletter', 'events', 'volunteering'));
ALTER TABLE opt_outs ADD CONSTRAINT opt_outs_way_check CHECK (way IN ('email', 'text', 'call'));
ALTER TABLE opt_outs ADD CONSTRAINT opt_outs_source_check
  CHECK (source IN ('luma-webhook', 'luma-contacts', 'civicrm'));

-- A broadcast's Consent is a topic, by its channel's way.
ALTER TABLE mailings DROP CONSTRAINT mailings_topic_check;
UPDATE mailings SET topic = CASE topic
  WHEN 'luma-calendar' THEN 'events' WHEN 'march-day' THEN 'events'
  WHEN 'volunteering' THEN 'volunteering' ELSE 'newsletter' END
WHERE topic IS NOT NULL;
ALTER TABLE mailings ADD CONSTRAINT mailings_topic_check CHECK (topic IN ('newsletter', 'events', 'volunteering'));

-- A Consent filter's value, "<channel>:<topic>[:<answer or reason>]",
-- possibly marked "!" to leave it out, as the same consent's
-- "<way>:<topic>[:<answer>]". There's no "unsure" any more, so it's yes,
-- and a reason becomes the answer it gave.
CREATE FUNCTION pg_temp.consent_value(old text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
SELECT CASE WHEN p[2] IS NULL THEN old ELSE
  m.mark
  || CASE WHEN p[1] = 'email' THEN 'email' ELSE 'text' END || ':'
  || CASE p[2] WHEN 'luma-calendar' THEN 'events' WHEN 'march-day' THEN 'events'
       WHEN 'volunteering' THEN 'volunteering' ELSE 'newsletter' END
  || CASE WHEN p[3] IS NULL THEN ''
       WHEN p[3] IN ('yes', 'unsure', 'asked', 'joined', 'following', 'volunteered', 'gave-number') THEN ':yes'
       ELSE ':no' END
  END
FROM (SELECT CASE WHEN old LIKE '!%' THEN '!' ELSE '' END AS mark) m,
  LATERAL (SELECT string_to_array(substr(old, length(m.mark) + 1), ':') AS p) s
$$;

CREATE FUNCTION pg_temp.consent_param(params jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
SELECT CASE
  WHEN params ? 'contact' AND jsonb_typeof(params -> 'contact') = 'string'
    THEN jsonb_set(params, '{contact}', to_jsonb(pg_temp.consent_value(params ->> 'contact')))
  WHEN params ? 'contact' AND jsonb_typeof(params -> 'contact') = 'array'
    THEN jsonb_set(params, '{contact}',
      (SELECT jsonb_agg(pg_temp.consent_value(v)) FROM jsonb_array_elements_text(params -> 'contact') v))
  ELSE params END
$$;

UPDATE saved_filters SET params = pg_temp.consent_param(params) WHERE params ? 'contact';
UPDATE mailings SET filter = pg_temp.consent_param(filter) WHERE filter ? 'contact';

DROP VIEW contact_unsubscribes;
DROP VIEW contact_permissions;
DROP VIEW email_permissions;
DROP VIEW phone_permissions;
DROP FUNCTION phone_usable(text);
DROP FUNCTION contact_permission(text, text, text);

-- Whether a supporter follows the Luma calendar now: an opt-out of its
-- emails, events by email, says they don't.
CREATE OR REPLACE VIEW supporters_summary AS
 WITH ident AS (
         SELECT supporter_identity.supporter_id,
            (array_agg(supporter_identity.name ORDER BY supporter_identity.seen_at DESC NULLS LAST, supporter_identity.name) FILTER (WHERE (supporter_identity.name <> ''::text)))[1] AS name,
            array_agg(DISTINCT supporter_identity.email ORDER BY supporter_identity.email) AS emails,
            array_agg(DISTINCT supporter_identity.source ORDER BY supporter_identity.source) AS sources
           FROM public.supporter_identity
          GROUP BY supporter_identity.supporter_id
        ), act AS (
         SELECT supporter_activity.supporter_id,
            bool_or((supporter_activity.kind = 'luma-contact'::text)) AS luma_contact,
            max(supporter_activity.at) AS last_active_at,
            (count(DISTINCT supporter_activity.href) FILTER (WHERE (((supporter_activity.kind = 'luma-registered'::text) AND (supporter_activity.detail <> 'declined'::text)) OR (supporter_activity.kind = 'luma-hosted'::text))))::integer AS events,
            (count(*) FILTER (WHERE (supporter_activity.kind = 'letter'::text)))::integer AS letters
           FROM public.supporter_activity
          GROUP BY supporter_activity.supporter_id
        ), contact AS (
         SELECT supporter_contact.supporter_id,
            (array_agg(supporter_contact.phone ORDER BY supporter_contact.at DESC, supporter_contact.phone) FILTER (WHERE (supporter_contact.phone IS NOT NULL)))[1] AS phone,
            (array_agg(supporter_contact.postcode ORDER BY supporter_contact.at DESC, supporter_contact.postcode) FILTER (WHERE (supporter_contact.postcode IS NOT NULL)))[1] AS postcode
           FROM public.supporter_contact
          GROUP BY supporter_contact.supporter_id
        ), mem AS (
         SELECT DISTINCT k.supporter_id
           FROM (public.supporter_links k
             JOIN public.members m ON ((m.id = k.member_id)))
          WHERE (m.removed_at IS NULL)
        ), ph AS (
         SELECT n.supporter_id,
            array_agg(n.number ORDER BY n.at DESC, n.number) AS phones
           FROM ( SELECT c.supporter_id,
                    public.phone_number(c.phone) AS number,
                    max(c.at) AS at
                   FROM public.supporter_contact c
                  WHERE (public.phone_number(c.phone) IS NOT NULL)
                  GROUP BY c.supporter_id, (public.phone_number(c.phone))) n
          GROUP BY n.supporter_id
        )
 SELECT s.id,
    ident.name,
    ident.emails,
    contact.phone,
    contact.postcode,
    ident.sources,
    (COALESCE(act.luma_contact, false) AND (NOT (EXISTS ( SELECT 1
           FROM public.opt_outs o
          WHERE ((o.list = 'events'::text) AND (o.way = 'email'::text) AND (o.resubscribed_at IS NULL) AND (o.address = ANY (ident.emails))))))) AS luma_contact,
    s.first_seen_at,
    act.last_active_at,
    COALESCE(act.events, 0) AS events,
    COALESCE(act.letters, 0) AS letters,
    (mem.supporter_id IS NOT NULL) AS member,
    COALESCE(act.luma_contact, false) AS luma_follows,
    COALESCE(ph.phones, '{}'::text[]) AS phones
   FROM (((((public.supporters s
     LEFT JOIN ident ON ((ident.supporter_id = s.id)))
     LEFT JOIN act ON ((act.supporter_id = s.id)))
     LEFT JOIN contact ON ((contact.supporter_id = s.id)))
     LEFT JOIN mem ON ((mem.supporter_id = s.id)))
     LEFT JOIN ph ON ((ph.supporter_id = s.id)));

-- Whether we may contact an address, or a number, about a topic by a way,
-- and why. `send` is yes or no; `reason` says why:
--
-- First, whatever stops every topic by that way, newest kind first:
--
-- - blocked: an email to it bounced hard, was marked as spam, or CiviCRM
--   has it on hold (email_blocks), so nothing goes to it;
-- - do-not-email, no-bulk-email: CiviCRM's "Do not email" or "No bulk
--   emails", on any contact with the address, returned or not, as a flag
--   only ever stops;
-- - do-not-sms, do-not-phone: CiviCRM's "Do not SMS" (which is WhatsApp
--   too) for texts, "Do not phone" for calls, on the contact of a member
--   who gave the number.
--
-- Then the latest thing the person said about the topic by that way: a stop
-- or a yes, a stop winning a tie.
--
-- - unsubscribed: an opt-out in force (opt_outs), from Luma's calendar
--   emails, or a CiviCRM list;
-- - asked: they ticked a box asking for it: on one of our forms, for the
--   newsletter by email, and by text on the march's, which says "by email
--   and phone", and a paper sign-up, where giving a number is joining by
--   text too; or "Keep me informed" on joining, for a member CiviCRM has
--   never returned, from 30 June 2026, when it became a free choice;
-- - signed-up: they gave their address on a paper sign-up form, which is
--   joining the list;
-- - subscribed: on the CiviCRM list, `newsletter` or `volunteer_updates`
--   by email, of a contact a pull still returns;
-- - following: they follow the Luma calendar, for events by email; or a
--   Luma account that follows it gave the number at a registration, for
--   events by text;
-- - gave-number: a number given on a form for text updates on its day,
--   until the day ends (day_texts), for events by text;
-- - volunteered: a member who chose to volunteer gave the number, or one
--   with no intent from before 30 June 2026, the Tally form that didn't ask,
--   for volunteering by text and call.
--
-- Last, if the person said nothing that counts, why not, the newest:
--
-- - declined: a box left unticked;
-- - not-volunteer: a member gave the number when joining, but didn't
--   choose to volunteer;
-- - not-opted-in: CiviCRM's list says they never gave chapter email
--   consent, or a member it has never returned joined before "Keep me
--   informed" was a free choice;
-- - not-following: registered on Luma but never followed the calendar;
-- - left: a member CiviCRM stopped returning, or Airtable stopped sharing;
-- - ended: a number for text updates on a day that's over.
--
-- `at` is since when, and `source` which source told us: a form, `member`,
-- `luma`, `civicrm`, or an email problem's or an opt-out's source. A topic
-- the address has had nothing to do with has no row.
CREATE FUNCTION contact_permission(for_topic text, for_way text, for_address text)
RETURNS TABLE (send text, reason text, at timestamptz, source text)
LANGUAGE sql STABLE AS $$
WITH
  -- The CiviCRM contacts of the address, or of the members who gave the number.
  civi AS (
    SELECT c.* FROM civicrm_contacts c WHERE for_way = 'email' AND c.email = for_address
    UNION ALL
    SELECT c.* FROM civicrm_contacts c
    WHERE for_way <> 'email' AND c.airtable_id IN (SELECT m.id FROM members m WHERE phone_number(m.phone) = for_address)
  ),
  -- Members whose records may still be used: shared by Airtable, and
  -- returned by CiviCRM's latest pull, or never returned at all.
  members_kept AS (
    SELECT m.*, NOT EXISTS (SELECT 1 FROM civicrm_contacts c WHERE c.airtable_id = m.id OR c.email = m.email)
      AS never_returned
    FROM members m
    WHERE m.removed_at IS NULL
      AND (EXISTS (SELECT 1 FROM civicrm_contacts c WHERE c.airtable_id = m.id AND c.gone_at IS NULL)
        OR NOT EXISTS (SELECT 1 FROM civicrm_contacts c WHERE c.airtable_id = m.id))
  ),
  stops AS (
    SELECT 1 AS rank, 'blocked' AS reason, p.at, p.kind AS source
    FROM email_blocks b JOIN email_problems p ON p.id = b.problem_id
    WHERE for_way = 'email' AND b.address = for_address
    UNION ALL
    SELECT 2, 'do-not-email', min(c.do_not_email_since), 'civicrm' FROM civi c
    WHERE for_way = 'email' AND c.do_not_email HAVING count(*) > 0
    UNION ALL
    SELECT 3, 'no-bulk-email', min(c.no_bulk_email_since), 'civicrm' FROM civi c
    WHERE for_way = 'email' AND c.no_bulk_email HAVING count(*) > 0
    UNION ALL
    SELECT 2, 'do-not-sms', min(c.do_not_sms_since), 'civicrm' FROM civi c
    WHERE for_way = 'text' AND c.do_not_sms HAVING count(*) > 0
    UNION ALL
    SELECT 2, 'do-not-phone', min(c.do_not_phone_since), 'civicrm' FROM civi c
    WHERE for_way = 'call' AND c.do_not_phone HAVING count(*) > 0
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
    -- On a CiviCRM list, while a pull returns the contact.
    SELECT 'yes', 'subscribed', c.since, 'civicrm'
    FROM (SELECT min(CASE WHEN for_topic = 'newsletter' THEN c.newsletter_since ELSE c.volunteer_updates_since END) AS since
          FROM civi c
          WHERE c.gone_at IS NULL AND CASE WHEN for_topic = 'newsletter' THEN c.newsletter ELSE c.volunteer_updates END = 'subscribed') c
    WHERE for_way = 'email' AND for_topic IN ('newsletter', 'volunteering') AND c.since IS NOT NULL
    UNION ALL
    -- "Keep me informed", for a member CiviCRM has never returned, ticked
    -- once it was a free choice.
    SELECT 'yes', 'asked', m.created_at, 'member'
    FROM members_kept m
    WHERE for_way = 'email' AND for_topic = 'newsletter' AND m.email = for_address AND m.keep_informed
      AND m.never_returned AND m.created_at >= '2026-06-30T00:00:00Z'
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
    -- A member who chose to volunteer gave the number.
    SELECT 'yes', 'volunteered', m.created_at, 'member'
    FROM members_kept m
    WHERE for_way IN ('text', 'call') AND for_topic = 'volunteering' AND phone_number(m.phone) = for_address
      AND (m.intent = 'Volunteer' OR (m.intent IS NULL AND m.created_at < '2026-06-30T00:00:00Z'))
  ),
  nothing AS (
    SELECT 'declined' AS reason, f.created_at AS at, f.form AS source
    FROM form_entries f
    WHERE for_topic = 'newsletter' AND NOT f.contact_consent
      AND ((for_way = 'email' AND lower(trim(f.email)) = for_address)
        OR (for_way = 'text' AND phone_number(f.phone) = for_address AND f.form IN ('march-2026-11', 'paper-signup')))
    UNION ALL
    SELECT CASE WHEN m.created_at < '2026-06-30T00:00:00Z' THEN 'not-opted-in' ELSE 'declined' END, m.created_at,
      'member'
    FROM members_kept m
    WHERE for_way = 'email' AND for_topic = 'newsletter' AND m.email = for_address AND m.never_returned
      AND (NOT m.keep_informed OR m.created_at < '2026-06-30T00:00:00Z')
    UNION ALL
    SELECT 'not-volunteer', m.created_at, 'member'
    FROM members_kept m
    WHERE for_way IN ('text', 'call') AND for_topic = 'volunteering' AND phone_number(m.phone) = for_address
      AND NOT (m.intent = 'Volunteer' OR (m.intent IS NULL AND m.created_at < '2026-06-30T00:00:00Z'))
    UNION ALL
    SELECT 'not-opted-in', c.newsletter_since, 'civicrm'
    FROM civi c
    WHERE for_way = 'email' AND for_topic = 'newsletter' AND c.gone_at IS NULL AND c.newsletter = 'not_opted_in'
    UNION ALL
    SELECT 'left', coalesce(m.removed_at, c.gone_at), CASE WHEN m.removed_at IS NULL THEN 'civicrm' ELSE 'member' END
    FROM members m
      LEFT JOIN (SELECT c.airtable_id, max(c.gone_at) AS gone_at FROM civicrm_contacts c GROUP BY c.airtable_id
                 HAVING bool_and(c.gone_at IS NOT NULL)) c ON c.airtable_id = m.id
    WHERE (m.removed_at IS NOT NULL OR c.gone_at IS NOT NULL)
      AND ((for_way = 'email' AND for_topic = 'newsletter' AND m.email = for_address)
        OR (for_way IN ('text', 'call') AND for_topic = 'volunteering' AND phone_number(m.phone) = for_address))
    UNION ALL
    SELECT 'left', c.gone_at, 'civicrm'
    FROM civi c
    WHERE for_way = 'email' AND for_topic IN ('newsletter', 'volunteering') AND c.gone_at IS NOT NULL
      AND CASE WHEN for_topic = 'newsletter' THEN c.newsletter ELSE c.volunteer_updates END <> 'not_on_list'
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
  (SELECT 1 AS tier, s.rank, 'no' AS send, s.reason, s.at, s.source FROM stops s ORDER BY s.rank LIMIT 1)
  UNION ALL
  (SELECT 2, 0, s.send, s.reason, s.at, s.source FROM said s ORDER BY s.at DESC, s.send = 'no' DESC LIMIT 1)
  UNION ALL
  (SELECT 3, 0, 'no', n.reason, n.at, n.source FROM nothing n ORDER BY n.at DESC NULLS LAST LIMIT 1)
) r
ORDER BY r.tier, r.rank
LIMIT 1
$$;

-- Every email address with an answer about a topic: one that's had to do
-- with it. contact_permission() says what.
CREATE VIEW email_permissions AS
SELECT t.topic, t.address, d.send, d.reason, d.at, d.source
FROM (
  SELECT 'newsletter' AS topic, lower(trim(email)) AS address FROM form_entries
  UNION SELECT 'newsletter', email FROM members
  UNION SELECT 'newsletter', email FROM civicrm_contacts WHERE newsletter <> 'not_on_list'
  UNION SELECT 'events', email FROM luma_people
  UNION SELECT 'volunteering', email FROM civicrm_contacts WHERE volunteer_updates <> 'not_on_list'
  UNION SELECT list, address FROM opt_outs WHERE way = 'email' AND resubscribed_at IS NULL
) t
CROSS JOIN LATERAL contact_permission(t.topic, 'email', t.address) d;

-- Every number with an answer about a topic, by text or by call.
CREATE VIEW phone_permissions AS
SELECT t.topic, t.way, t.address, d.send, d.reason, d.at, d.source
FROM (
  SELECT 'newsletter' AS topic, 'text' AS way, phone_number(phone) AS address FROM form_entries
  WHERE form IN ('march-2026-11', 'paper-signup') AND phone_number(phone) IS NOT NULL
  UNION SELECT 'events', 'text', phone_number(phone) FROM luma_guests WHERE phone_number(phone) IS NOT NULL
  UNION SELECT 'events', 'text', phone_number(phone) FROM form_entries
  WHERE form IN (SELECT form FROM day_texts) AND phone_number(phone) IS NOT NULL
  UNION SELECT 'volunteering', w.way, phone_number(m.phone) FROM members m CROSS JOIN (VALUES ('text'), ('call')) w (way)
  WHERE phone_number(m.phone) IS NOT NULL
  UNION SELECT list, way, address FROM opt_outs WHERE way <> 'email' AND resubscribed_at IS NULL
) t
CROSS JOIN LATERAL contact_permission(t.topic, t.way, t.address) d;

-- Both, each answer with its way and the channel of its address.
CREATE VIEW contact_permissions AS
SELECT topic, 'email' AS way, 'email' AS channel, address, send, reason, at, source FROM email_permissions
UNION ALL
SELECT topic, way, 'phone', address, send, reason, at, source FROM phone_permissions;

-- Every opt-out that's the answer for its address now: a stop no block
-- overrides and nothing newer has undone.
CREATE VIEW contact_unsubscribes AS
SELECT o.way, o.list AS topic, o.address, d.send, d.reason, d.at, d.source
FROM opt_outs o
CROSS JOIN LATERAL contact_permission(o.list, o.way, o.address) d
WHERE o.resubscribed_at IS NULL AND d.reason = 'unsubscribed';

-- Whether any topic lets us text or call a number.
CREATE FUNCTION phone_usable(number text) RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT EXISTS (
  SELECT 1 FROM unnest(ARRAY['newsletter', 'events', 'volunteering']) t (topic)
    CROSS JOIN unnest(ARRAY['text', 'call']) w (way)
    CROSS JOIN LATERAL contact_permission(t.topic, w.way, number) d
  WHERE d.send = 'yes')
$$;
