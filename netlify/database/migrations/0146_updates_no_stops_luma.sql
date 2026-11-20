-- PauseAI Updates including Luma is a yes to the newsletter or to events,
-- so a no to the newsletter is a no to events too, by the same way: an
-- unsubscribe from Updates stops both lists. It takes no one off the Luma
-- calendar, and a later yes to events, such as joining the calendar again,
-- wins as any later yes does.

CREATE OR REPLACE VIEW consent_answers AS
-- An opt-out in force.
SELECT o.address, o.way, o.list AS topic, 'said' AS kind, 'no' AS send, 'unsubscribed' AS reason,
  o.unsubscribed_at AS at, o.source
FROM opt_outs o
WHERE o.list IN ('newsletter', 'events', 'volunteering') AND o.resubscribed_at IS NULL
UNION ALL
-- A no to the newsletter is a no to events by the same way: PauseAI
-- Updates including Luma is a yes to either, and a no to Updates stops both.
SELECT o.address, o.way, 'events', 'said', 'no', 'unsubscribed', o.unsubscribed_at, o.source
FROM opt_outs o
WHERE o.list = 'newsletter' AND o.way IN ('email', 'text') AND o.resubscribed_at IS NULL
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
