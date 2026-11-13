-- contact_permission() as 0112_email_to_supporters.sql has it, and a member's
-- number is a yes to volunteering texts as it is to volunteering calls: from
-- a contact or member who chose to volunteer or lead when joining, or joined
-- before the form asked, with CiviCRM's "Do not SMS" stopping texts as
-- "Do not phone" stops calls.
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
  -- The contacts and members who gave the number, for a volunteering call or
  -- text, each with whether they wanted to volunteer, and when they joined.
  callers AS (
    SELECT coalesce(c.intent IN ('volunteer', 'lead') OR (c.intent IS NULL AND c.joined_date < '2026-06-30'), false)
        AS volunteer,
      civicrm_joined_at(c.joined_date, c.first_seen_at) AS at, 'civicrm' AS source
    FROM civi c
    WHERE for_way IN ('call', 'text') AND for_topic = 'volunteering' AND c.gone_at IS NULL
      AND phone_number(c.phone) = for_address
    UNION ALL
    SELECT coalesce(m.intent IN ('Volunteer', 'Lead') OR (m.intent IS NULL AND m.created_at < '2026-06-30T00:00:00Z'),
        false),
      m.created_at, 'airtable'
    FROM members_kept m
    WHERE for_way IN ('call', 'text') AND for_topic = 'volunteering' AND m.never_returned
      AND phone_number(m.phone) = for_address
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
        OR (for_way IN ('call', 'text') AND for_topic = 'volunteering' AND phone_number(m.phone) = for_address))
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

-- The numbers with an answer, as 0112 has them, with members' numbers for
-- volunteering texts too.
CREATE OR REPLACE VIEW phone_permissions AS
SELECT t.topic, t.way, t.address, d.send, d.reason, d.at, d.source
FROM (
  SELECT 'newsletter' AS topic, 'text' AS way, phone_number(phone) AS address FROM form_entries
    WHERE form IN ('march-2026-11', 'paper-signup') AND phone_number(phone) IS NOT NULL
  UNION SELECT 'events', 'text', phone_number(phone) FROM luma_guests WHERE phone_number(phone) IS NOT NULL
  UNION SELECT 'events', 'text', phone_number(phone) FROM form_entries
    WHERE form IN (SELECT form FROM day_texts) AND phone_number(phone) IS NOT NULL
  UNION SELECT 'volunteering', w.way, phone_number(phone) FROM airtable_members, (VALUES ('call'), ('text')) w (way)
    WHERE phone_number(phone) IS NOT NULL
  UNION SELECT 'volunteering', w.way, phone_number(phone) FROM civicrm_contacts, (VALUES ('call'), ('text')) w (way)
    WHERE phone_number(phone) IS NOT NULL
  UNION SELECT list, way, address FROM opt_outs WHERE way <> 'email' AND resubscribed_at IS NULL
  UNION SELECT topic, way, address FROM preference_choices WHERE way <> 'email'
) t
CROSS JOIN LATERAL contact_permission(t.topic, t.way, t.address) d;
