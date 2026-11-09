-- A CSV of people who filled in a paper form while flyering, uploaded by
-- staff. Each person is a form entry, as on any form; the upload holds what
-- they share, and is what a person's history links to.

ALTER TABLE form_entries DROP CONSTRAINT form_entries_form_check;
ALTER TABLE form_entries ADD CONSTRAINT form_entries_form_check
  CHECK (form IN ('email-your-mp', 'web-form', 'march-2026-11', 'paper-signup'));

-- `imported` and `held_back` are the file's counts when it went in, which
-- stay as a record when someone in it is later erased. The note is staff's own,
-- about the upload: where the forms came from.
CREATE TABLE signup_uploads (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  filename text NOT NULL,
  signed_on date NOT NULL,
  note text CHECK (btrim(note) <> ''),
  event_id text REFERENCES luma_events (id) ON DELETE SET NULL,
  imported integer NOT NULL CHECK (imported >= 0),
  held_back integer NOT NULL CHECK (held_back >= 0),
  uploaded_by text NOT NULL,
  uploaded_at timestamptz NOT NULL
);

CREATE TABLE signup_upload_entries (
  entry_id bigint PRIMARY KEY REFERENCES form_entries (id) ON DELETE CASCADE,
  upload_id bigint NOT NULL REFERENCES signup_uploads (id) ON DELETE CASCADE
);

CREATE INDEX signup_upload_entries_upload ON signup_upload_entries (upload_id);

-- A paper entry's detail is its upload's note, and it links to the upload.
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
    'form-entry'::text AS kind,
    f.form AS title,
    COALESCE(u.note, f.utm_source) AS detail,
    ('/staff/supporters/import/previous/'::text || u.id) AS href,
    g.status
   FROM ((((form_entries f
     LEFT JOIN form_entry_luma g ON ((g.entry_id = f.id)))
     LEFT JOIN signup_upload_entries e ON ((e.entry_id = f.id)))
     LEFT JOIN signup_uploads u ON ((u.id = e.upload_id))))
  WHERE (NOT (EXISTS ( SELECT 1
           FROM letters_from_supporters s
          WHERE (s.entry_id = f.id))));
