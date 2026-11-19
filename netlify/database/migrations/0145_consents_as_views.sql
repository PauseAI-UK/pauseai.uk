-- Whether we may contact an address or number about each topic, by each
-- way, as views worked out for everyone at once: each rule is a query of
-- consent_answers, each stop one of consent_stops, and contact_permissions
-- picks one answer for each. contact_permission() looks one up.
--
-- The newsletter is PauseAI Updates, and events the Luma calendar, which
-- with the newsletter makes PauseAI Updates including Luma. Every UK
-- chapter member is a yes to Updates by email (`member`): giving their
-- details to the UK chapter is the yes. Every volunteer is a yes to it, by
-- email and text (`volunteered`). A letter written on pauseai.info's
-- earlier form before it had a consent box, 23 September 2026, is a yes to
-- it too (`wrote`).

DROP VIEW contact_unsubscribes;
DROP VIEW contact_permissions;
DROP VIEW email_permissions;
DROP VIEW phone_permissions;
DROP FUNCTION phone_usable(text);

-- Every answer a rule gives an address or number about a topic, by a way:
-- `said` is a yes or no they gave, `nothing` why there's no yes.
CREATE VIEW consent_answers AS
-- An opt-out in force.
SELECT o.address, o.way, o.list AS topic, 'said' AS kind, 'no' AS send, 'unsubscribed' AS reason,
  o.unsubscribed_at AS at, o.source
FROM opt_outs o
WHERE o.list IN ('newsletter', 'events', 'volunteering') AND o.resubscribed_at IS NULL
UNION ALL
-- A box ticked on one of our forms, or a paper sign-up; or left unticked.
SELECT lower(trim(f.email)), 'email', 'newsletter', 'said', 'yes',
  CASE WHEN f.form = 'paper-signup' THEN 'signed-up' ELSE 'asked' END, f.created_at, f.form
FROM form_entries f
WHERE f.contact_consent AND f.email IS NOT NULL
UNION ALL
SELECT f.phone, 'text', 'newsletter', 'said', 'yes',
  CASE WHEN f.form = 'paper-signup' THEN 'signed-up' ELSE 'asked' END, f.created_at, f.form
FROM form_entries f
WHERE f.contact_consent AND f.form IN ('march-2026-11', 'paper-signup') AND f.phone IS NOT NULL
UNION ALL
SELECT lower(trim(f.email)), 'email', 'newsletter', 'nothing', 'no', 'declined', f.created_at, f.form
FROM form_entries f
WHERE NOT f.contact_consent AND f.email IS NOT NULL AND NOT (f.form = 'web-form' AND f.created_at < '2026-09-23')
UNION ALL
SELECT f.phone, 'text', 'newsletter', 'nothing', 'no', 'declined', f.created_at, f.form
FROM form_entries f
WHERE NOT f.contact_consent AND f.form IN ('march-2026-11', 'paper-signup') AND f.phone IS NOT NULL
UNION ALL
-- A letter on pauseai.info's earlier form before it had a consent box:
-- writing is the yes.
SELECT lower(trim(f.email)), 'email', 'newsletter', 'said', 'yes', 'wrote', f.created_at, f.form
FROM form_entries f
WHERE f.form = 'web-form' AND f.created_at < '2026-09-23' AND NOT f.contact_consent AND f.email IS NOT NULL
UNION ALL
-- In our WhatsApp community, unless they've opted out since, or before.
SELECT f.phone, 'text', 'newsletter', 'said', 'yes', 'joined-whatsapp', min(f.created_at), 'whatsapp-community'
FROM form_entries f
WHERE f.form = 'whatsapp-community' AND f.phone IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM opt_outs o WHERE o.way = 'text' AND o.address = f.phone
    AND o.list = 'newsletter' AND o.resubscribed_at IS NULL)
GROUP BY f.phone
UNION ALL
-- A box ticked on the email settings page.
SELECT p.address, p.way, p.topic, 'said', 'yes', 'chose', p.chosen_at, 'preferences'
FROM preference_choices p
WHERE p.topic <> 'bulk'
UNION ALL
-- Volunteering chosen there, by email or text, is a yes to the newsletter,
-- unless they've opted out of it.
SELECT p.address, p.way, 'newsletter', 'said', 'yes', 'volunteered', min(p.chosen_at), 'preferences'
FROM preference_choices p
WHERE p.topic = 'volunteering' AND p.way IN ('email', 'text')
  AND NOT EXISTS (SELECT 1 FROM opt_outs o WHERE o.way = p.way AND o.address = p.address
    AND o.list = 'newsletter' AND o.resubscribed_at IS NULL)
GROUP BY p.address, p.way
UNION ALL
-- A member of the UK chapter, while a pull returns them, unless they've
-- unsubscribed from CiviCRM's newsletter list.
SELECT c.email, 'email', 'newsletter', 'said', 'yes', 'member', min(civicrm_joined_at(c.joined_date, c.first_seen_at)),
  'civicrm'
FROM civicrm_contacts c
WHERE c.gone_at IS NULL AND c.newsletter <> 'unsubscribed' AND c.email IS NOT NULL
GROUP BY c.email
UNION ALL
-- On CiviCRM's volunteer list, while a pull returns the contact.
SELECT c.email, 'email', 'volunteering', 'said', 'yes', 'subscribed', min(c.volunteer_updates_since), 'civicrm'
FROM civicrm_contacts c
WHERE c.gone_at IS NULL AND c.volunteer_updates = 'subscribed' AND c.email IS NOT NULL
GROUP BY c.email
UNION ALL
-- A member's number: a volunteer's (one who chose to volunteer or lead, or
-- joined before the join form asked) is a yes to volunteering calls and
-- texts and newsletter texts; anyone else's a reason there's none for
-- volunteering.
SELECT c.phone, t.way, t.topic, CASE WHEN v.volunteer THEN 'said' ELSE 'nothing' END,
  CASE WHEN v.volunteer THEN 'yes' ELSE 'no' END, CASE WHEN v.volunteer THEN 'volunteered' ELSE 'not-volunteer' END,
  civicrm_joined_at(c.joined_date, c.first_seen_at), 'civicrm'
FROM civicrm_contacts c
  CROSS JOIN LATERAL (SELECT coalesce(c.intent IN ('volunteer', 'lead')
    OR (c.intent IS NULL AND c.joined_date < '2026-06-30'), false) AS volunteer) v
  JOIN (VALUES ('volunteering', 'call'), ('volunteering', 'text'), ('newsletter', 'text')) t (topic, way)
    ON v.volunteer OR t.topic = 'volunteering'
WHERE c.gone_at IS NULL AND c.phone IS NOT NULL
UNION ALL
-- Gone from the chapter: a member, for the newsletter; one on the volunteer
-- list, for volunteering; one who gave a number, for what it was for.
SELECT c.email, 'email', t.topic, 'nothing', 'no', 'left', c.gone_at, 'civicrm'
FROM civicrm_contacts c
  JOIN (VALUES ('newsletter'), ('volunteering')) t (topic) ON t.topic = 'newsletter' OR c.volunteer_updates <> 'not_on_list'
WHERE c.gone_at IS NOT NULL AND c.email IS NOT NULL
UNION ALL
SELECT c.phone, t.way, t.topic, 'nothing', 'no', 'left', c.gone_at, 'civicrm'
FROM civicrm_contacts c, (VALUES ('volunteering', 'call'), ('volunteering', 'text'), ('newsletter', 'text')) t (topic, way)
WHERE c.gone_at IS NOT NULL AND c.phone IS NOT NULL
UNION ALL
-- On the Luma calendar, or not.
SELECT l.email, 'email', 'events', 'said', 'yes', 'following', min(l.contact_since), 'luma'
FROM luma_people l
WHERE l.contact_since IS NOT NULL
GROUP BY l.email
UNION ALL
SELECT DISTINCT l.email, 'email', 'events', 'nothing', 'no', 'not-following', NULL::timestamptz, 'luma'
FROM luma_people l
UNION ALL
-- A number given at a Luma registration has the answer of the account that
-- gave it, of those on the calendar: of several, a yes if any is, from the
-- newest; else the newest unsubscribe.
SELECT g.phone, 'text', 'events', 'said', CASE WHEN bool_or(o.id IS NULL) THEN 'yes' ELSE 'no' END,
  CASE WHEN bool_or(o.id IS NULL) THEN 'following' ELSE 'unsubscribed' END,
  CASE WHEN bool_or(o.id IS NULL) THEN max(l.contact_since) FILTER (WHERE o.id IS NULL) ELSE max(o.unsubscribed_at) END,
  'luma'
FROM luma_guests g
  JOIN luma_people l ON l.user_id = g.user_id AND l.contact_since IS NOT NULL
  LEFT JOIN opt_outs o ON o.way = 'email' AND o.list = 'events' AND o.address = l.email AND o.resubscribed_at IS NULL
WHERE g.phone IS NOT NULL
GROUP BY g.phone
UNION ALL
SELECT DISTINCT g.phone, 'text', 'events', 'nothing', 'no', 'not-following', NULL::timestamptz, 'luma'
FROM luma_guests g
WHERE g.phone IS NOT NULL
UNION ALL
-- A number for text updates on a day, until the day ends.
SELECT f.phone, 'text', 'events', CASE WHEN now() < d.ends_at THEN 'said' ELSE 'nothing' END,
  CASE WHEN now() < d.ends_at THEN 'yes' ELSE 'no' END, CASE WHEN now() < d.ends_at THEN 'gave-number' ELSE 'ended' END,
  CASE WHEN now() < d.ends_at THEN f.created_at ELSE d.ends_at END, f.form
FROM form_entries f
  JOIN day_texts d ON d.form = f.form
WHERE f.phone IS NOT NULL;

-- What stops every topic by a way, most binding first (`rank`).
CREATE VIEW consent_stops AS
SELECT b.address, 'email' AS way, 1 AS rank, 'blocked' AS reason, p.at, p.kind AS source
FROM email_blocks b
  JOIN email_problems p ON p.id = b.problem_id
UNION ALL
SELECT c.email, 'email', 2, 'do-not-email', min(c.do_not_email_since), 'civicrm'
FROM civicrm_contacts c
WHERE c.do_not_email AND c.email IS NOT NULL
GROUP BY c.email
UNION ALL
-- "No bulk emails", unless lifted since on the email settings page, and
-- CiviCRM hasn't refused the lift.
SELECT c.email, 'email', 3, 'no-bulk-email', min(c.no_bulk_email_since), 'civicrm'
FROM civicrm_contacts c
WHERE c.no_bulk_email AND c.email IS NOT NULL
  AND c.no_bulk_email_since > coalesce((SELECT max(p.chosen_at) FROM preference_choices p
    WHERE p.way = 'email' AND p.address = c.email AND p.topic = 'bulk' AND p.refused_at IS NULL), '-infinity')
GROUP BY c.email
UNION ALL
SELECT c.phone, 'text', 2, 'do-not-sms', min(c.do_not_sms_since), 'civicrm'
FROM civicrm_contacts c
WHERE c.do_not_sms AND c.phone IS NOT NULL
GROUP BY c.phone
UNION ALL
SELECT c.phone, 'call', 2, 'do-not-phone', min(c.do_not_phone_since), 'civicrm'
FROM civicrm_contacts c
WHERE c.do_not_phone AND c.phone IS NOT NULL
GROUP BY c.phone
UNION ALL
-- Every email, every bulk email, or every text or call to the number, stopped.
SELECT o.address, o.way, CASE WHEN o.list = 'all' THEN 2 ELSE 3 END,
  CASE WHEN o.way <> 'email' THEN 'unsubscribed' WHEN o.list = 'all' THEN 'do-not-email' ELSE 'no-bulk-email' END,
  o.unsubscribed_at, o.source
FROM opt_outs o
WHERE o.list IN ('all', 'bulk') AND o.resubscribed_at IS NULL;

-- One answer for each address or number, way and topic: a stop, else the
-- latest yes or no they gave (a no wins a tie), else the latest reason
-- there's none. An address or number we know of from CiviCRM or a stop of
-- every text or call, with no answer, has one only if it's stopped.
CREATE VIEW contact_permissions AS
SELECT a.topic, a.way, CASE WHEN a.way = 'email' THEN 'email' ELSE 'phone' END AS channel, a.address,
  CASE WHEN s.reason IS NULL THEN a.send ELSE 'no' END AS send,
  coalesce(s.reason, a.reason) AS reason,
  CASE WHEN s.reason IS NULL THEN a.at ELSE s.at END AS at,
  CASE WHEN s.reason IS NULL THEN a.source ELSE s.source END AS source
FROM (
  SELECT DISTINCT ON (f.address, f.way, f.topic) f.*
  FROM (
    SELECT * FROM consent_answers
    UNION ALL
    SELECT c.email, 'email', t.topic, 'known', 'no', NULL, NULL, NULL
    FROM civicrm_contacts c
      JOIN (VALUES ('newsletter'), ('volunteering')) t (topic)
        ON t.topic = 'newsletter' OR c.volunteer_updates <> 'not_on_list'
    WHERE c.email IS NOT NULL
    UNION ALL
    SELECT c.phone, t.way, t.topic, 'known', 'no', NULL, NULL, NULL
    FROM civicrm_contacts c,
      (VALUES ('volunteering', 'call'), ('volunteering', 'text'), ('newsletter', 'text')) t (topic, way)
    WHERE c.phone IS NOT NULL
    UNION ALL
    SELECT o.address, o.way, t.topic, 'known', 'no', NULL, NULL, NULL
    FROM opt_outs o
      JOIN (VALUES ('newsletter', 'text'), ('events', 'text'), ('volunteering', 'text'), ('volunteering', 'call')) t (topic, way)
        ON t.way = o.way
    WHERE o.list = 'all' AND o.way <> 'email' AND o.resubscribed_at IS NULL
  ) f
  ORDER BY f.address, f.way, f.topic, f.kind = 'said' DESC, f.kind = 'known',
    -- Of what they said, an answer with no date is the latest.
    (f.kind = 'said' AND f.at IS NULL) DESC, f.at DESC NULLS LAST, f.send = 'no' DESC
) a
  LEFT JOIN (SELECT DISTINCT ON (s.address, s.way) s.* FROM consent_stops s ORDER BY s.address, s.way, s.rank, s.at) s
    ON s.address = a.address AND s.way = a.way
WHERE a.kind <> 'known' OR s.reason IS NOT NULL;

CREATE VIEW email_permissions AS
SELECT p.topic, p.address, p.send, p.reason, p.at, p.source FROM contact_permissions p WHERE p.channel = 'email';

CREATE VIEW phone_permissions AS
SELECT p.topic, p.way, p.address, p.send, p.reason, p.at, p.source FROM contact_permissions p WHERE p.channel = 'phone';

-- Opt-outs that are why we wouldn't contact someone about their topic.
CREATE VIEW contact_unsubscribes AS
SELECT o.way, o.list AS topic, o.address, p.send, p.reason, p.at, p.source
FROM opt_outs o
  JOIN contact_permissions p ON p.address = o.address AND p.way = o.way AND p.topic = o.list
WHERE o.resubscribed_at IS NULL AND p.reason = 'unsubscribed' AND o.list IN ('newsletter', 'events', 'volunteering');

-- The answer for one address or number, by a way, about a topic: from
-- contact_permissions, or for one it has none for, any stop.
CREATE OR REPLACE FUNCTION contact_permission(for_topic text, for_way text, for_address text)
  RETURNS TABLE(send text, reason text, at timestamp with time zone, source text)
  LANGUAGE sql STABLE
AS $function$
SELECT r.send, r.reason, r.at, r.source FROM (
  (SELECT 1 AS tier, p.send, p.reason, p.at, p.source FROM contact_permissions p
   WHERE p.address = for_address AND p.way = for_way AND p.topic = for_topic)
  UNION ALL
  (SELECT 2, 'no', s.reason, s.at, s.source FROM consent_stops s
   WHERE s.address = for_address AND s.way = for_way ORDER BY s.rank, s.at LIMIT 1)
) r
ORDER BY r.tier
LIMIT 1
$function$;
