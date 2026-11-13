-- Email to supporters from pauseai.uk: opt-outs of every bulk email and of
-- all email, and the new ways one reaches us; the email settings page,
-- where a person sees and changes what we send them; our opt-outs sent to
-- CiviCRM; broadcasts sent by email, each copy with its own unsubscribe
-- link; and the replies to them.

-- An opt-out of one topic by one way, or of every bulk email (`bulk`, as
-- CiviCRM's "No bulk emails"), or of all email but what the person just
-- asked for (`all`, as its "Do not email"), the last two by email only.
-- Where it came from: an email's unsubscribe link (`link`), a mail app's own
-- Unsubscribe button (`list-unsubscribe`), a spam complaint, a reply staff
-- recorded as one, staff recording one told them another way, the email
-- settings page, or CiviCRM's suppression check before a broadcast. Staff
-- name who recorded it, and for one told them another way, how it was given.
ALTER TABLE opt_outs DROP CONSTRAINT opt_outs_list_check;
ALTER TABLE opt_outs ADD CONSTRAINT opt_outs_list_check
  CHECK (list IN ('newsletter', 'events', 'volunteering', 'bulk', 'all'));
ALTER TABLE opt_outs ADD CONSTRAINT opt_outs_whole_email CHECK (list NOT IN ('bulk', 'all') OR way = 'email');
ALTER TABLE opt_outs DROP CONSTRAINT opt_outs_source_check;
ALTER TABLE opt_outs ADD CONSTRAINT opt_outs_source_check CHECK (source IN (
  'luma-webhook', 'luma-contacts', 'civicrm', 'link', 'list-unsubscribe', 'postmark-complaint', 'reply', 'staff',
  'preferences', 'civicrm-check'));
ALTER TABLE opt_outs
  ADD COLUMN recorded_by text CHECK (recorded_by = lower(recorded_by)),
  ADD COLUMN how text,
  ADD COLUMN message_id bigint REFERENCES broadcast_messages (id) ON DELETE SET NULL;
ALTER TABLE opt_outs ADD CONSTRAINT opt_outs_recorded_by CHECK ((source IN ('staff', 'reply')) = (recorded_by IS NOT NULL));
ALTER TABLE opt_outs ADD CONSTRAINT opt_outs_how CHECK ((source = 'staff') = (how IS NOT NULL AND how <> ''));

-- A yes given on the email settings page: a topic by a way, to the address
-- the page's link was emailed to, or to a number of theirs; or "No bulk
-- emails" lifted (`bulk`). Each with the words beside what they chose.
-- `refused_at` is when CiviCRM refused a lift, as a newer "No bulk emails"
-- there wins.
CREATE TABLE preference_choices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  address text NOT NULL,
  way text NOT NULL CHECK (way IN ('email', 'text', 'call')),
  topic text NOT NULL CHECK (topic IN ('newsletter', 'events', 'volunteering', 'bulk')),
  wording text NOT NULL CHECK (wording <> ''),
  chosen_at timestamptz NOT NULL DEFAULT now(),
  refused_at timestamptz,
  CHECK (way <> 'email' OR address = lower(address)),
  CHECK (topic <> 'bulk' OR way = 'email'),
  CHECK (refused_at IS NULL OR topic = 'bulk')
);
CREATE INDEX preference_choices_address ON preference_choices (address);

-- What we tell CiviCRM's updateSubscriptions, an event each: an opt-out of
-- ours, or a lift of "No bulk emails" on the email settings page. Kept until
-- CiviCRM answers it, tried again until it does. `event_id` is ours, so
-- sending one twice changes nothing there.
CREATE TABLE civicrm_updates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  opt_out_id bigint UNIQUE REFERENCES opt_outs (id) ON DELETE CASCADE,
  choice_id bigint UNIQUE REFERENCES preference_choices (id) ON DELETE CASCADE,
  change text NOT NULL CHECK (change IN ('unsubscribe', 'no_bulk_email', 'allow_bulk_email')),
  list text CHECK (list IN ('newsletter', 'volunteer_updates')),
  email text NOT NULL CHECK (email = lower(email)),
  contact_id bigint,
  occurred_at timestamptz NOT NULL,
  source text NOT NULL,
  wording text,
  created_at timestamptz NOT NULL DEFAULT now(),
  tries integer NOT NULL DEFAULT 0,
  tried_at timestamptz,
  status text CHECK (status IN ('accepted', 'refused', 'invalid')),
  reason text,
  answered_at timestamptz,
  CHECK (num_nonnulls(opt_out_id, choice_id) = 1),
  CHECK ((choice_id IS NOT NULL) = (change = 'allow_bulk_email')),
  CHECK ((change = 'unsubscribe') = (list IS NOT NULL)),
  CHECK ((change = 'allow_bulk_email') = (wording IS NOT NULL)),
  CHECK ((status IS NULL) = (answered_at IS NULL))
);
CREATE INDEX civicrm_updates_email ON civicrm_updates (email);
CREATE INDEX civicrm_updates_unanswered ON civicrm_updates (id) WHERE status IS NULL;

-- A link to the email settings page, emailed to the address on request:
-- only the hash of its token is kept.
CREATE TABLE preference_links (
  token_hash text PRIMARY KEY,
  address text NOT NULL CHECK (address = lower(address)),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX preference_links_address ON preference_links (address);

-- Each copy of a broadcast: a hash of the token of its unsubscribe link,
-- which opens the email settings page, made as it goes; the Message-ID it
-- went with, which a reply names; and the topics whose yes it went under,
-- which its unsubscribe stops. A copy goes once to each address. One being
-- sent is `sending`, since `sending_since`, until Postmark's answer is kept;
-- one a run left so, as it stopped partway, may have gone, so it isn't sent
-- again. CiviCRM's suppression check stopping one is `suppressed`.
ALTER TABLE broadcast_messages
  ADD COLUMN link_token_hash text UNIQUE,
  ADD COLUMN rfc_message_id text UNIQUE,
  ADD COLUMN topics text[] NOT NULL DEFAULT '{}',
  ADD COLUMN sending_since timestamptz,
  ADD CHECK ((status = 'sending') = (sending_since IS NOT NULL));
ALTER TABLE broadcast_messages DROP CONSTRAINT broadcast_messages_status_check;
ALTER TABLE broadcast_messages ADD CONSTRAINT broadcast_messages_status_check
  CHECK (status IN ('scheduled', 'sending', 'sent', 'delivered', 'failed', 'skipped', 'cancelled'));
ALTER TABLE broadcast_messages DROP CONSTRAINT broadcast_messages_skip_reason_check;
ALTER TABLE broadcast_messages ADD CONSTRAINT broadcast_messages_skip_reason_check
  CHECK (skip_reason IN ('blocked', 'unsubscribed', 'no-permission', 'not-on-whatsapp', 'suppressed'));
CREATE UNIQUE INDEX broadcast_messages_once_an_address ON broadcast_messages (mailing_id, address)
  WHERE address IS NOT NULL;

-- The topics a broadcast goes under besides `topic`, its first: a yes to
-- any of them is enough (`also_topics`). One waiting to go, as CiviCRM didn't
-- answer its suppression check or no pull has completed for a day, since
-- when and why; and when staff were told. One still waiting three days after
-- its time stops, `gave_up` saying so.
ALTER TABLE mailings
  ADD COLUMN also_topics text[] NOT NULL DEFAULT '{}'
    CHECK (also_topics <@ ARRAY['newsletter', 'events', 'volunteering']),
  ADD COLUMN waiting_since timestamptz,
  ADD COLUMN wait_reason text CHECK (wait_reason IN ('civicrm', 'pull')),
  ADD COLUMN gave_up boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT mailings_also_topics CHECK (cardinality(also_topics) = 0 OR (topic IS NOT NULL AND NOT topic = ANY (also_topics))),
  ADD CONSTRAINT mailings_waiting CHECK ((waiting_since IS NULL) = (wait_reason IS NULL)),
  ADD CONSTRAINT mailings_gave_up CHECK (NOT gave_up OR (state = 'cancelled' AND wait_reason IS NOT NULL));

-- A reply to a copy of a broadcast, read from the inbox it went from. The
-- whole message is kept in Netlify Blobs, under `blob_key`. An automatic
-- reply needs nobody; any other waits until staff record it as an opt-out
-- or as nothing to do, or answer it. Its Gmail thread and Message-ID are
-- what an answer joins and names.
CREATE TABLE broadcast_replies (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id bigint NOT NULL REFERENCES broadcast_messages (id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL,
  from_address text NOT NULL CHECK (from_address = lower(from_address)),
  subject text NOT NULL,
  account text NOT NULL,
  gmail_message_id text NOT NULL UNIQUE,
  gmail_thread_id text NOT NULL,
  rfc_message_id text,
  blob_key text NOT NULL,
  automatic boolean NOT NULL,
  outcome text CHECK (outcome IN ('opted-out', 'nothing', 'answered')),
  dealt_by text CHECK (dealt_by = lower(dealt_by)),
  dealt_at timestamptz,
  CHECK ((outcome IS NULL) = (dealt_by IS NULL)),
  CHECK ((outcome IS NULL) = (dealt_at IS NULL)),
  CHECK (NOT (automatic AND outcome IS NOT NULL))
);
CREATE INDEX broadcast_replies_message ON broadcast_replies (message_id);
CREATE INDEX broadcast_replies_waiting ON broadcast_replies (received_at) WHERE outcome IS NULL AND NOT automatic;

-- Staff's answer to a reply, sent by Gmail from the mailbox the reply came
-- to, in its thread. `draft_id` is the page's own, so pressing Send twice
-- sends it once. It's recorded as sending before it goes and sent after,
-- with Gmail's IDs for it and its Message-ID, which a reply to it names.
CREATE TABLE broadcast_answers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reply_id bigint NOT NULL REFERENCES broadcast_replies (id) ON DELETE CASCADE,
  draft_id uuid NOT NULL UNIQUE,
  sent_by text NOT NULL CHECK (sent_by = lower(sent_by)),
  body jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('sending', 'sent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  gmail_message_id text,
  rfc_message_id text,
  CHECK ((status = 'sent') = (sent_at IS NOT NULL))
);
CREATE INDEX broadcast_answers_reply ON broadcast_answers (reply_id);
CREATE INDEX broadcast_answers_rfc ON broadcast_answers (rfc_message_id);

-- Each copy of a broadcast, a link to the email settings page, the email to
-- someone with "No bulk emails" who just ticked a box, and an answer to a
-- reply, are emails of their own; a copy's send names it.
ALTER TABLE email_sends DROP CONSTRAINT email_sends_purpose_check;
ALTER TABLE email_sends ADD CONSTRAINT email_sends_purpose_check CHECK (purpose IN (
  'letter', 'forwarded-reply', 'staff-login', 'staff-alert', 'mailing', 'mailing-test', 'letter-copy', 'relay',
  'supporter-notice', 'office-notice', 'staff-report', 'broadcast', 'preferences-link', 'bulk-notice',
  'broadcast-answer'));
ALTER TABLE email_sends ADD COLUMN broadcast_message_id bigint REFERENCES broadcast_messages (id) ON DELETE SET NULL;

-- When we emailed the person on a form entry, who has "No bulk emails",
-- a link to lift it; once a sign-up.
ALTER TABLE form_entries ADD COLUMN bulk_notice_at timestamptz;

-- contact_permission() as 0105_members_from_civicrm.sql has it, and:
-- - an open opt-out of every bulk email, or of all email, stops email of
--   every topic, as CiviCRM's "No bulk emails" and "Do not email" do;
-- - CiviCRM's "No bulk emails" stops nothing once the person lifted it on
--   the email settings page since we saw it, unless CiviCRM refused that;
-- - a yes ticked on the email settings page (`chose`) is the latest thing
--   the person said, as a box ticked on a form is.
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
  (SELECT 1 AS tier, s.rank, 'no' AS send, s.reason, s.at, s.source FROM stops s ORDER BY s.rank, s.at LIMIT 1)
  UNION ALL
  (SELECT 2, 0, s.send, s.reason, s.at, s.source FROM said s ORDER BY s.at DESC, s.send = 'no' DESC LIMIT 1)
  UNION ALL
  (SELECT 3, 0, 'no', n.reason, n.at, n.source FROM nothing n ORDER BY n.at DESC NULLS LAST LIMIT 1)
) r
ORDER BY r.tier, r.rank
LIMIT 1
$$;

-- The addresses and numbers with an answer, as 0105 has them, with those
-- ticked on the email settings page, and only opt-outs of a topic: one of
-- every bulk email, or all email, is a stop on each topic of an address
-- that has an answer for it.
CREATE OR REPLACE VIEW email_permissions AS
SELECT t.topic, t.address, d.send, d.reason, d.at, d.source
FROM (
  SELECT 'newsletter' AS topic, lower(trim(email)) AS address FROM form_entries
  UNION SELECT 'newsletter', email FROM airtable_members
  UNION SELECT 'newsletter', email FROM civicrm_contacts WHERE newsletter <> 'not_on_list'
  UNION SELECT 'events', email FROM luma_people
  UNION SELECT 'volunteering', email FROM civicrm_contacts WHERE volunteer_updates <> 'not_on_list'
  UNION SELECT list, address FROM opt_outs
    WHERE way = 'email' AND resubscribed_at IS NULL AND list IN ('newsletter', 'events', 'volunteering')
  UNION SELECT topic, address FROM preference_choices WHERE way = 'email' AND topic <> 'bulk'
) t
CROSS JOIN LATERAL contact_permission(t.topic, 'email', t.address) d;

CREATE OR REPLACE VIEW phone_permissions AS
SELECT t.topic, t.way, t.address, d.send, d.reason, d.at, d.source
FROM (
  SELECT 'newsletter' AS topic, 'text' AS way, phone_number(phone) AS address FROM form_entries
    WHERE form IN ('march-2026-11', 'paper-signup') AND phone_number(phone) IS NOT NULL
  UNION SELECT 'events', 'text', phone_number(phone) FROM luma_guests WHERE phone_number(phone) IS NOT NULL
  UNION SELECT 'events', 'text', phone_number(phone) FROM form_entries
    WHERE form IN (SELECT form FROM day_texts) AND phone_number(phone) IS NOT NULL
  UNION SELECT 'volunteering', 'call', phone_number(phone) FROM airtable_members WHERE phone_number(phone) IS NOT NULL
  UNION SELECT 'volunteering', 'call', phone_number(phone) FROM civicrm_contacts WHERE phone_number(phone) IS NOT NULL
  UNION SELECT list, way, address FROM opt_outs WHERE way <> 'email' AND resubscribed_at IS NULL
  UNION SELECT topic, way, address FROM preference_choices WHERE way <> 'email'
) t
CROSS JOIN LATERAL contact_permission(t.topic, t.way, t.address) d;

-- The opt-outs in force of one topic: one of every bulk email, or all
-- email, is an answer's stop, on each topic.
CREATE OR REPLACE VIEW contact_unsubscribes AS
SELECT o.way, o.list AS topic, o.address, d.send, d.reason, d.at, d.source
FROM opt_outs o CROSS JOIN LATERAL contact_permission(o.list, o.way, o.address) d
WHERE o.resubscribed_at IS NULL AND d.reason = 'unsubscribed' AND o.list IN ('newsletter', 'events', 'volunteering');
