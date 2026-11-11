-- A member is a UK chapter contact that CiviCRM's latest complete pull
-- returns, and CiviCRM gives each one's name, city, postcode, joined date,
-- intent and number. Stichting PauseAI's Airtable is one more source, read
-- for the members CiviCRM has never returned, and its tables and views are
-- named for it. Where both have a value, CiviCRM's counts.

-- Airtable's members, named for where they come from.
ALTER TABLE members RENAME TO airtable_members;
ALTER TABLE airtable_members RENAME CONSTRAINT members_pkey TO airtable_members_pkey;
ALTER TABLE airtable_members RENAME CONSTRAINT members_email_check TO airtable_members_email_check;
ALTER INDEX members_email RENAME TO airtable_members_email;
ALTER INDEX members_phone RENAME TO airtable_members_phone;
ALTER TABLE members_erased RENAME TO airtable_members_erased;
ALTER TABLE airtable_members_erased RENAME CONSTRAINT members_erased_pkey TO airtable_members_erased_pkey;
ALTER TABLE supporter_links RENAME COLUMN member_id TO airtable_member_id;
ALTER TABLE supporter_links RENAME CONSTRAINT supporter_links_member_id_key TO supporter_links_airtable_member_id_key;
ALTER TABLE supporter_links RENAME CONSTRAINT supporter_links_member_id_fkey TO supporter_links_airtable_member_id_fkey;
ALTER VIEW supporter_source_member RENAME TO supporter_source_airtable;
ALTER VIEW supporter_contact_member RENAME TO supporter_contact_airtable;
ALTER VIEW supporter_activity_member RENAME TO supporter_activity_airtable;

-- A contact's member details, as CiviCRM gives them, each null when it has
-- none. `joined_date` is a day. `intent` is what they said on a join form
-- they wanted to do, the last one recorded: `none` when it asked and they
-- picked nothing, as the current form, which doesn't ask, records too.
-- `phone` is their primary number, which Global shares for calls only.
ALTER TABLE civicrm_contacts
  ADD COLUMN first_name text,
  ADD COLUMN last_name text,
  ADD COLUMN city text,
  ADD COLUMN postal_code text,
  ADD COLUMN joined_date date,
  ADD COLUMN intent text CHECK (intent IN ('act_now', 'volunteer', 'lead', 'none', 'keep_informed')),
  ADD COLUMN phone text;
CREATE INDEX civicrm_contacts_phone ON civicrm_contacts (phone_number(phone));

-- When a contact joined PauseAI: the start of its joined day, or when a
-- pull first returned it, for one with no day.
CREATE FUNCTION civicrm_joined_at(joined date, first_seen timestamptz) RETURNS timestamptz
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(joined::timestamp AT TIME ZONE 'UTC', first_seen)
$$;

-- A contact gives a name and contact details while a pull returns it: one
-- that's gone is no longer shared with us, and Global asks that its
-- details aren't used from then on.
CREATE OR REPLACE VIEW supporter_source_civicrm AS
  SELECT c.contact_id AS source_id, c.email,
    CASE WHEN c.gone_at IS NULL THEN concat_ws(' ', nullif(btrim(c.first_name), ''), nullif(btrim(c.last_name), ''))
      ELSE '' END AS name,
    civicrm_joined_at(c.joined_date, c.first_seen_at) AS seen_at
  FROM civicrm_contacts c;

CREATE VIEW supporter_contact_civicrm AS
  SELECT c.contact_id AS source_id, civicrm_joined_at(c.joined_date, c.first_seen_at) AS at, c.phone, c.postal_code AS postcode,
    NULL::double precision AS latitude, NULL::double precision AS longitude, c.city
  FROM civicrm_contacts c WHERE c.gone_at IS NULL;

-- Joining PauseAI, with what they said they wanted to do, while a pull
-- returns them; once none does, that they're no longer a member here.
-- Global doesn't say why: most often they said no to sharing with
-- PauseAI UK, but they may have left the UK, been deleted, or been merged
-- into another contact.
CREATE OR REPLACE VIEW supporter_activity_civicrm AS
  SELECT c.contact_id AS source_id, civicrm_joined_at(c.joined_date, c.first_seen_at) AS at, 'member-joined' AS kind, c.intent AS title,
    NULL::text AS detail, NULL::text AS href, NULL::text AS status
  FROM civicrm_contacts c WHERE c.gone_at IS NULL
  UNION ALL
  SELECT c.contact_id, c.gone_at, 'member-left', NULL, NULL, NULL, NULL
  FROM civicrm_contacts c WHERE c.gone_at IS NOT NULL;

-- A member in Airtable gives a name, contact details and when they joined
-- only if CiviCRM has never returned them, so CiviCRM's count for everyone
-- it has. Its address still links them to their supporter.
CREATE OR REPLACE VIEW supporter_source_airtable AS
  SELECT m.id AS source_id, m.email,
    CASE WHEN EXISTS (SELECT 1 FROM civicrm_contacts c WHERE c.airtable_id = m.id OR c.email = m.email) THEN ''
      ELSE m.name END AS name,
    m.joined_at AS seen_at
  FROM airtable_members m;

CREATE OR REPLACE VIEW supporter_contact_airtable AS
  SELECT m.id AS source_id, m.created_at AS at, m.phone, m.postcode,
    NULL::double precision AS latitude, NULL::double precision AS longitude, m.city
  FROM airtable_members m
  WHERE NOT EXISTS (SELECT 1 FROM civicrm_contacts c WHERE c.airtable_id = m.id OR c.email = m.email);

CREATE OR REPLACE VIEW supporter_activity_airtable AS
  SELECT m.id AS source_id, m.joined_at AS at, 'member-joined' AS kind, m.intent AS title, NULL::text AS detail,
    'https://airtable.com/appWPTGqZmUcs3NWu/tblL1icZBhTV1gQ9o/' || m.id AS href, NULL::text AS status
  FROM airtable_members m
  WHERE NOT EXISTS (SELECT 1 FROM civicrm_contacts c WHERE c.airtable_id = m.id OR c.email = m.email);

-- Nothing shows the page someone joined on, as CiviCRM doesn't give it.
ALTER TABLE airtable_members DROP COLUMN source_page;

CREATE OR REPLACE VIEW supporter_identity AS
  SELECT k.supporter_id, 'luma' AS source, s.email, s.name, s.seen_at
  FROM supporter_source_luma s JOIN supporter_links k ON k.luma_user_id = s.source_id
  UNION ALL
  SELECT k.supporter_id, f.form, s.email, s.name, s.seen_at
  FROM supporter_source_form s JOIN supporter_links k ON k.form_entry_id = s.source_id
    JOIN form_entries f ON f.id = s.source_id
  UNION ALL
  SELECT k.supporter_id, 'airtable', s.email, s.name, s.seen_at
  FROM supporter_source_airtable s JOIN supporter_links k ON k.airtable_member_id = s.source_id
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
  SELECT k.supporter_id, 'airtable', c.at, c.phone, c.postcode, c.latitude, c.longitude, c.city
  FROM supporter_contact_airtable c JOIN supporter_links k ON k.airtable_member_id = c.source_id
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
  SELECT k.supporter_id, 'airtable', a.at, a.kind, a.title, a.detail, a.href, a.status
  FROM supporter_activity_airtable a JOIN supporter_links k ON k.airtable_member_id = a.source_id
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

-- A member: a CiviCRM contact a pull returns, or a member in Airtable whom
-- CiviCRM has never returned. Otherwise as 0093_broadcasts.sql has it.
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
    SELECT k.supporter_id
    FROM supporter_links k JOIN civicrm_contacts c ON c.contact_id = k.civicrm_contact_id
    WHERE c.gone_at IS NULL
    UNION
    SELECT k.supporter_id
    FROM supporter_links k JOIN airtable_members m ON m.id = k.airtable_member_id
    WHERE m.removed_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM civicrm_contacts c WHERE c.airtable_id = m.id OR c.email = m.email)
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

-- contact_permission() as 0100_consents.sql and 0101_consents_by_address.sql
-- have it, where each reason is explained, reading Airtable's members by
-- their new name, and CiviCRM's numbers. Volunteering by phone is by call
-- only: Global shares numbers for calls, as no join form has asked to text
-- them. The yes for a call is a number a contact or a member gave with an
-- intent to volunteer or to lead, or none, before the form asked in June
-- 2026, from CiviCRM, or from Airtable for a member CiviCRM has never
-- returned.
CREATE OR REPLACE FUNCTION contact_permission(for_topic text, for_way text, for_address text)
RETURNS TABLE (send text, reason text, at timestamptz, source text)
LANGUAGE sql STABLE AS $$
WITH
  -- The members in Airtable with the address, or who gave the number.
  theirs AS (
    SELECT m.* FROM airtable_members m WHERE for_way = 'email' AND m.email = for_address
    UNION ALL
    SELECT m.* FROM airtable_members m WHERE for_way <> 'email' AND phone_number(m.phone) = for_address
  ),
  -- The CiviCRM contacts of the address, or who gave the number, or of the
  -- members who gave it.
  civi AS (
    SELECT c.* FROM civicrm_contacts c WHERE for_way = 'email' AND c.email = for_address
    UNION
    SELECT c.* FROM civicrm_contacts c WHERE for_way <> 'email' AND phone_number(c.phone) = for_address
    UNION
    SELECT c.* FROM civicrm_contacts c WHERE for_way <> 'email' AND c.airtable_id IN (SELECT id FROM theirs)
  ),
  -- Each of those members: whether CiviCRM has ever returned them, and when
  -- every contact of theirs went, if all have.
  their_members AS (
    SELECT m.*,
      NOT EXISTS (SELECT 1 FROM civicrm_contacts c WHERE c.airtable_id = m.id OR c.email = m.email) AS never_returned,
      (SELECT max(c.gone_at) FROM civicrm_contacts c WHERE c.airtable_id = m.id
       HAVING bool_and(c.gone_at IS NOT NULL)) AS gone_at
    FROM theirs m
  ),
  -- Those whose records may still be used: shared by Airtable, and returned
  -- by CiviCRM's latest pull, or never returned at all.
  members_kept AS (
    SELECT m.* FROM their_members m WHERE m.removed_at IS NULL AND m.gone_at IS NULL
  ),
  -- The contacts and members who gave the number for a volunteering call,
  -- each with whether they wanted to volunteer, and when they joined.
  callers AS (
    SELECT coalesce(c.intent IN ('volunteer', 'lead') OR (c.intent IS NULL AND c.joined_date < '2026-06-30'), false)
        AS volunteer,
      civicrm_joined_at(c.joined_date, c.first_seen_at) AS at, 'civicrm' AS source
    FROM civi c
    WHERE for_way = 'call' AND for_topic = 'volunteering' AND c.gone_at IS NULL
      AND phone_number(c.phone) = for_address
    UNION ALL
    SELECT coalesce(m.intent IN ('Volunteer', 'Lead') OR (m.intent IS NULL AND m.created_at < '2026-06-30T00:00:00Z'),
        false),
      m.created_at, 'airtable'
    FROM members_kept m
    WHERE for_way = 'call' AND for_topic = 'volunteering' AND m.never_returned
      AND phone_number(m.phone) = for_address
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
    SELECT 'yes', 'asked', m.created_at, 'airtable'
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
    -- A contact or member who chose to volunteer gave the number.
    SELECT 'yes', 'volunteered', c.at, c.source FROM callers c WHERE c.volunteer
  ),
  nothing AS (
    SELECT 'declined' AS reason, f.created_at AS at, f.form AS source
    FROM form_entries f
    WHERE for_topic = 'newsletter' AND NOT f.contact_consent
      AND ((for_way = 'email' AND lower(trim(f.email)) = for_address)
        OR (for_way = 'text' AND phone_number(f.phone) = for_address AND f.form IN ('march-2026-11', 'paper-signup')))
    UNION ALL
    SELECT CASE WHEN m.created_at < '2026-06-30T00:00:00Z' THEN 'not-opted-in' ELSE 'declined' END, m.created_at,
      'airtable'
    FROM members_kept m
    WHERE for_way = 'email' AND for_topic = 'newsletter' AND m.email = for_address AND m.never_returned
      AND (NOT m.keep_informed OR m.created_at < '2026-06-30T00:00:00Z')
    UNION ALL
    SELECT 'not-volunteer', c.at, c.source FROM callers c WHERE NOT c.volunteer
    UNION ALL
    SELECT 'not-opted-in', c.newsletter_since, 'civicrm'
    FROM civi c
    WHERE for_way = 'email' AND for_topic = 'newsletter' AND c.gone_at IS NULL AND c.newsletter = 'not_opted_in'
    UNION ALL
    SELECT 'left', coalesce(m.removed_at, m.gone_at), CASE WHEN m.removed_at IS NULL THEN 'civicrm' ELSE 'airtable' END
    FROM their_members m
    WHERE (m.removed_at IS NOT NULL OR m.gone_at IS NOT NULL)
      AND ((for_way = 'email' AND for_topic = 'newsletter' AND m.email = for_address)
        OR (for_way = 'call' AND for_topic = 'volunteering' AND phone_number(m.phone) = for_address))
    UNION ALL
    SELECT 'left', c.gone_at, 'civicrm'
    FROM civi c
    WHERE for_way = 'email' AND for_topic IN ('newsletter', 'volunteering') AND c.gone_at IS NOT NULL
      AND CASE WHEN for_topic = 'newsletter' THEN c.newsletter ELSE c.volunteer_updates END <> 'not_on_list'
    UNION ALL
    SELECT 'left', c.gone_at, 'civicrm'
    FROM civi c
    WHERE for_way = 'call' AND for_topic = 'volunteering' AND c.gone_at IS NOT NULL
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
  (SELECT 1 AS tier, s.rank, 'no' AS send, s.reason, s.at, s.source FROM stops s ORDER BY s.rank LIMIT 1)
  UNION ALL
  (SELECT 2, 0, s.send, s.reason, s.at, s.source FROM said s ORDER BY s.at DESC, s.send = 'no' DESC LIMIT 1)
  UNION ALL
  (SELECT 3, 0, 'no', n.reason, n.at, n.source FROM nothing n ORDER BY n.at DESC NULLS LAST LIMIT 1)
) r
ORDER BY r.tier, r.rank
LIMIT 1
$$;

-- The numbers asked about for volunteering: by call only, each number a
-- member gave in Airtable or a contact in CiviCRM. Otherwise as
-- 0100_consents.sql has it.
CREATE OR REPLACE VIEW phone_permissions AS
  SELECT t.topic, t.way, t.address, d.send, d.reason, d.at, d.source
  FROM (
    SELECT 'newsletter' AS topic, 'text' AS way, phone_number(phone) AS address
    FROM form_entries WHERE form IN ('march-2026-11', 'paper-signup') AND phone_number(phone) IS NOT NULL
    UNION
    SELECT 'events', 'text', phone_number(phone) FROM luma_guests WHERE phone_number(phone) IS NOT NULL
    UNION
    SELECT 'events', 'text', phone_number(phone) FROM form_entries
    WHERE form IN (SELECT form FROM day_texts) AND phone_number(phone) IS NOT NULL
    UNION
    SELECT 'volunteering', 'call', phone_number(phone) FROM airtable_members WHERE phone_number(phone) IS NOT NULL
    UNION
    SELECT 'volunteering', 'call', phone_number(phone) FROM civicrm_contacts WHERE phone_number(phone) IS NOT NULL
    UNION
    SELECT list, way, address FROM opt_outs WHERE way <> 'email' AND resubscribed_at IS NULL
  ) t
  CROSS JOIN LATERAL contact_permission(t.topic, t.way, t.address) d;

-- merge_supporters_by_phone() as 0093_broadcasts.sql and 0068_notes.sql
-- have it, reading Airtable's members by their new name, and CiviCRM's
-- numbers too.
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
      UNION SELECT k.supporter_id, phone_number(m.phone) FROM airtable_members m
        JOIN supporter_links k ON k.airtable_member_id = m.id WHERE phone_number(m.phone) %1$s
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
