-- CiviCRM is a source of supporters (lib/server/supporter-sources.ts): a UK
-- chapter contact links to a supporter by email, like a Luma user or a
-- member, so one whose address we have from nowhere else is a supporter
-- too. It gives an address and nothing more: no name, number or place, so
-- it has no contact view. Its contact going, by erasure, takes its link.

ALTER TABLE supporter_links ADD COLUMN civicrm_contact_id bigint UNIQUE
  REFERENCES civicrm_contacts (contact_id) ON DELETE CASCADE;
ALTER TABLE supporter_links DROP CONSTRAINT supporter_links_check;
ALTER TABLE supporter_links ADD CONSTRAINT supporter_links_check
  CHECK (num_nonnulls(luma_user_id, form_entry_id, member_id, civicrm_contact_id) = 1);

-- First seen when a pull first returned them.
CREATE VIEW supporter_source_civicrm AS
  SELECT c.contact_id AS source_id, c.email, '' AS name, c.first_seen_at AS seen_at FROM civicrm_contacts c;

-- In the UK chapter in CiviCRM, from when a pull first returned them.
CREATE VIEW supporter_activity_civicrm AS
  SELECT c.contact_id AS source_id, c.first_seen_at AS at, 'civicrm-contact' AS kind, NULL::text AS title,
    NULL::text AS detail, NULL::text AS href, NULL::text AS status
  FROM civicrm_contacts c;

CREATE OR REPLACE VIEW supporter_identity AS
 SELECT k.supporter_id,
    'luma'::text AS source,
    s.email,
    s.name,
    s.seen_at
   FROM (public.supporter_source_luma s
     JOIN public.supporter_links k ON ((k.luma_user_id = s.source_id)))
UNION ALL
 SELECT k.supporter_id,
    f.form AS source,
    s.email,
    s.name,
    s.seen_at
   FROM ((public.supporter_source_form s
     JOIN public.supporter_links k ON ((k.form_entry_id = s.source_id)))
     JOIN public.form_entries f ON ((f.id = s.source_id)))
UNION ALL
 SELECT k.supporter_id,
    'member'::text AS source,
    s.email,
    s.name,
    s.seen_at
   FROM (public.supporter_source_member s
     JOIN public.supporter_links k ON ((k.member_id = s.source_id)))
UNION ALL
 SELECT k.supporter_id,
    'civicrm'::text AS source,
    s.email,
    s.name,
    s.seen_at
   FROM (public.supporter_source_civicrm s
     JOIN public.supporter_links k ON ((k.civicrm_contact_id = s.source_id)));

CREATE OR REPLACE VIEW supporter_activity AS
 SELECT k.supporter_id,
    'luma'::text AS source,
    p.contact_since AS at,
    'luma-contact'::text AS kind,
    NULL::text AS title,
    NULL::text AS detail,
    NULL::text AS href,
    NULL::text AS status
   FROM (public.luma_people p
     JOIN public.supporter_links k ON ((k.luma_user_id = p.user_id)))
  WHERE (p.contact_since IS NOT NULL)
UNION ALL
 SELECT k.supporter_id,
    'luma'::text AS source,
    g.registered_at AS at,
    'luma-registered'::text AS kind,
    e.name AS title,
    g.approval_status AS detail,
    ('https://luma.com/'::text || e.url) AS href,
    NULL::text AS status
   FROM ((public.luma_guests g
     JOIN public.luma_events e ON ((e.id = g.event_id)))
     JOIN public.supporter_links k ON ((k.luma_user_id = g.user_id)))
  WHERE (g.removed_at IS NULL)
UNION ALL
 SELECT k.supporter_id,
    f.form AS source,
    a.at,
    a.kind,
    a.title,
    a.detail,
    a.href,
    a.status
   FROM ((public.supporter_activity_form a
     JOIN public.supporter_links k ON ((k.form_entry_id = a.source_id)))
     JOIN public.form_entries f ON ((f.id = a.source_id)))
UNION ALL
 SELECT k.supporter_id,
    o.source,
    o.unsubscribed_at AS at,
    'opted-out'::text AS kind,
    o.list AS title,
    o.address AS detail,
    NULL::text AS href,
    NULL::text AS status
   FROM (public.opt_outs o
     JOIN ( SELECT DISTINCT supporter_links.supporter_id,
            supporter_links.matched_value
           FROM public.supporter_links) k ON ((k.matched_value = o.address)))
UNION ALL
 SELECT k.supporter_id,
    o.source,
    o.resubscribed_at AS at,
    'resubscribed'::text AS kind,
    o.list AS title,
    o.address AS detail,
    NULL::text AS href,
    NULL::text AS status
   FROM (public.opt_outs o
     JOIN ( SELECT DISTINCT supporter_links.supporter_id,
            supporter_links.matched_value
           FROM public.supporter_links) k ON ((k.matched_value = o.address)))
  WHERE (o.resubscribed_at IS NOT NULL)
UNION ALL
 SELECT k.supporter_id,
    'member'::text AS source,
    a.at,
    a.kind,
    a.title,
    a.detail,
    a.href,
    a.status
   FROM (public.supporter_activity_member a
     JOIN public.supporter_links k ON ((k.member_id = a.source_id)))
UNION ALL
 SELECT k.supporter_id,
    'luma'::text AS source,
    COALESCE(h.added_at, e.created_at, e.first_seen_at) AS at,
    'luma-hosted'::text AS kind,
    e.name AS title,
    NULL::text AS detail,
    ('https://luma.com/'::text || e.url) AS href,
    NULL::text AS status
   FROM ((public.luma_event_hosts h
     JOIN public.luma_events e ON ((e.id = h.event_id)))
     JOIN public.supporter_links k ON ((k.luma_user_id = h.user_id)))
UNION ALL
 SELECT k.supporter_id,
    'civicrm'::text AS source,
    a.at,
    a.kind,
    a.title,
    a.detail,
    a.href,
    a.status
   FROM (public.supporter_activity_civicrm a
     JOIN public.supporter_links k ON ((k.civicrm_contact_id = a.source_id)));
