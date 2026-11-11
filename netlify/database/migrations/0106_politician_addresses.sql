-- A politician's addresses besides the one in notable_people.email, which say
-- a message is to or from them (lib/server/politician-book.ts):
--   parliament: listed for an MP by Parliament's Members API, kept by the
--     nightly MP check, which deletes one no longer listed;
--   office: a parliament address that isn't a politician's own, seen only in
--     threads with one politician, so their office's, worked out again each
--     time one-off threads are relinked;
--   staff: added by hand, such as a personal Gmail, with who added it.
CREATE TABLE politician_addresses (
  address text NOT NULL CHECK (address = lower(address) AND address LIKE '_%@_%'),
  notable_person_id bigint NOT NULL REFERENCES notable_people (id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('parliament', 'office', 'staff')),
  added_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (address, notable_person_id, source),
  CHECK ((source = 'staff') = (added_by IS NOT NULL))
);
CREATE INDEX politician_addresses_person ON politician_addresses (notable_person_id);

-- What a one-off message quotes or forwards, read from its blob: the
-- addresses on the From, To and Cc lines of the mail it quotes, and the names
-- given there with no address ("HILLIER, Meg", as Outlook writes a colleague
-- in Parliament). Null until read, which keeping it does, or the relinking
-- job for a message kept before.
-- A politician staff took off a one-off thread, as it isn't theirs: neither
-- relinking nor a new message in it links them again.
CREATE TABLE one_off_unlinked (
  thread_id bigint NOT NULL REFERENCES one_off_threads (id) ON DELETE CASCADE,
  notable_person_id bigint NOT NULL REFERENCES notable_people (id) ON DELETE CASCADE,
  unlinked_by text NOT NULL,
  unlinked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, notable_person_id)
);

ALTER TABLE one_off_messages ADD COLUMN quoted_addresses text[], ADD COLUMN quoted_names text[];
ALTER TABLE one_off_messages ADD CHECK ((quoted_addresses IS NULL) = (quoted_names IS NULL));
CREATE INDEX one_off_messages_unquoted ON one_off_messages (id) WHERE quoted_addresses IS NULL;
