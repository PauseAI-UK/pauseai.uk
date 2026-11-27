-- The WhatsApp waiting room: someone asks to join our WhatsApp community by
-- messaging our number, says why they're interested, and is let in (sent
-- the community's link) by an LLM's check or by staff, or held, or
-- dismissed. docs/domain-concepts.md, "The waiting room".

-- One row per number that asked to join.
CREATE TABLE waiting_room (
  id bigserial PRIMARY KEY,
  number phone NOT NULL UNIQUE,
  -- The WhatsApp profile name their messages came with, or '' for none.
  profile_name text NOT NULL DEFAULT '',
  -- The code of the button they came by ("parents", "footer"), from the message it typed.
  came_from text CHECK (came_from ~ '^[a-z0-9-]{1,40}$'),
  asked_at timestamptz NOT NULL,
  -- asked: welcomed, no reply yet; held: for staff; let-in: sent the link, or to be when they next write; dismissed: for good.
  state text NOT NULL DEFAULT 'asked' CHECK (state IN ('asked', 'held', 'let-in', 'dismissed')),
  -- Why the check held them, in its words, or that it couldn't be asked.
  held_why text,
  -- Who let them in or dismissed them: a staff member, or none for the check.
  decided_by text,
  decided_at timestamptz,
  -- When the community's link went to them, and when we said we'd check, once.
  link_sent_at timestamptz,
  checking_sent_at timestamptz,
  -- The form entry they became once let in.
  entry_id bigint UNIQUE REFERENCES form_entries (id) ON DELETE SET NULL,
  CHECK ((state IN ('let-in', 'dismissed')) = (decided_at IS NOT NULL))
);

-- Every message in a waiting room chat, theirs and ours.
CREATE TABLE waiting_room_messages (
  id bigserial PRIMARY KEY,
  person_id bigint NOT NULL REFERENCES waiting_room (id) ON DELETE CASCADE,
  at timestamptz NOT NULL,
  ours boolean NOT NULL,
  -- What a message that isn't words alone was (a photo, a voice note), as a broadcast reply keeps it.
  kind text,
  body text,
  provider_message_id text UNIQUE
);
CREATE INDEX waiting_room_messages_person ON waiting_room_messages (person_id, id);

-- Each community link staff have set. The newest is the one sent.
CREATE TABLE waiting_room_links (
  id bigserial PRIMARY KEY,
  link text NOT NULL CHECK (link ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]+$'),
  set_by text NOT NULL,
  set_at timestamptz NOT NULL DEFAULT now()
);

-- Someone let in is a form entry, with their number and perhaps an email.
ALTER TABLE form_entries DROP CONSTRAINT form_entries_form_check;
ALTER TABLE form_entries ADD CONSTRAINT form_entries_form_check
  CHECK (form IN ('email-your-mp', 'web-form', 'march-2026-11', 'march-2027-04', 'paper-signup', 'whatsapp-community',
    'whatsapp-join'));
ALTER TABLE form_entries DROP CONSTRAINT form_entries_email_check;
ALTER TABLE form_entries ADD CONSTRAINT form_entries_email_check
  CHECK (email IS NOT NULL OR (form IN ('whatsapp-community', 'whatsapp-join') AND phone IS NOT NULL));

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
-- A box ticked on one of our forms, or a paper sign-up; or left unticked. A
-- march's sign-up and a paper one ask for a number too. Joining the WhatsApp
-- community through the waiting room is a yes by text alone: an email given
-- in its chat is kept, but is no yes.
SELECT lower(trim(f.email)), 'email', 'newsletter', 'said', 'yes',
  CASE WHEN f.form = 'paper-signup' THEN 'signed-up' ELSE 'asked' END, f.created_at, f.form
FROM form_entries f
WHERE f.contact_consent AND f.email IS NOT NULL AND f.form <> 'whatsapp-join'
UNION ALL
SELECT f.phone, 'text', 'newsletter', 'said', 'yes',
  CASE WHEN f.form = 'paper-signup' THEN 'signed-up' ELSE 'asked' END, f.created_at, f.form
FROM form_entries f
WHERE f.contact_consent AND (f.form IN ('paper-signup', 'whatsapp-join') OR f.form LIKE 'march-%') AND f.phone IS NOT NULL
UNION ALL
SELECT lower(trim(f.email)), 'email', 'newsletter', 'nothing', 'no', 'declined', f.created_at, f.form
FROM form_entries f
WHERE NOT f.contact_consent AND f.email IS NOT NULL AND NOT (f.form = 'web-form' AND f.created_at < '2026-09-23')
UNION ALL
SELECT f.phone, 'text', 'newsletter', 'nothing', 'no', 'declined', f.created_at, f.form
FROM form_entries f
WHERE NOT f.contact_consent AND (f.form IN ('paper-signup', 'whatsapp-join') OR f.form LIKE 'march-%') AND f.phone IS NOT NULL
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
-- A number given on a march's sign-up, which asks for it "for text updates
-- about events". Not November 2026's, which asked for it for the day alone.
SELECT f.phone, 'text', 'events', 'said', 'yes', 'gave-number', f.created_at, f.form
FROM form_entries f
WHERE f.form LIKE 'march-%' AND f.form <> 'march-2026-11' AND f.phone IS NOT NULL;
