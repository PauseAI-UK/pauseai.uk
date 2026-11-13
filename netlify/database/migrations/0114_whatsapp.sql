-- Texts to supporters by WhatsApp (lib/server/outside-services/whatsapp.ts).

-- A stop given in WhatsApp: its "Offers and announcements" setting, a
-- template's Stop button, a reply asking to stop, or a message WhatsApp
-- refused as the person had stopped. It stops every text to the number. A
-- resume in the setting closes the stops the setting made.
ALTER TABLE opt_outs
  DROP CONSTRAINT opt_outs_source_check,
  ADD CONSTRAINT opt_outs_source_check CHECK (source IN ('luma-webhook', 'luma-contacts', 'civicrm', 'link',
    'list-unsubscribe', 'postmark-complaint', 'reply', 'staff', 'preferences', 'civicrm-check', 'whatsapp'));

-- Numbers WhatsApp couldn't deliver to, as they aren't on it: a text skips
-- them from then on. Erasure deletes a supporter's.
CREATE TABLE whatsapp_unreachable (
  number text PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  message_id bigint REFERENCES broadcast_messages (id) ON DELETE SET NULL
);

-- A copy WhatsApp held back, as the person had had enough marketing
-- messages lately, goes again no sooner than this.
ALTER TABLE broadcast_messages ADD COLUMN not_before timestamptz;

-- A reply to a text: WhatsApp's ID for it and its words, where an email's
-- is a Gmail message kept whole.
ALTER TABLE broadcast_replies
  ALTER COLUMN account DROP NOT NULL,
  ALTER COLUMN gmail_message_id DROP NOT NULL,
  ALTER COLUMN gmail_thread_id DROP NOT NULL,
  ALTER COLUMN blob_key DROP NOT NULL,
  ADD COLUMN provider_message_id text UNIQUE,
  ADD COLUMN body text,
  ADD CONSTRAINT broadcast_replies_one_kind CHECK (num_nonnulls(gmail_message_id, provider_message_id) = 1),
  ADD CONSTRAINT broadcast_replies_gmail CHECK (
    num_nonnulls(account, gmail_message_id, gmail_thread_id, blob_key) IN (0, 4)),
  ADD CONSTRAINT broadcast_replies_whatsapp CHECK ((provider_message_id IS NULL) = (body IS NULL));

-- An answer to a reply to a text goes by WhatsApp, with its ID for it.
ALTER TABLE broadcast_answers ADD COLUMN provider_message_id text;

-- A template as WhatsApp has it: the name it's sent by, its ID there, and
-- the category it approved it as. One WhatsApp approved can be paused or
-- disabled later, for its quality, which stops the texts on it.
ALTER TABLE whatsapp_templates
  ADD COLUMN meta_name text UNIQUE CHECK (meta_name ~ '^[a-z0-9_]+$'),
  ADD COLUMN meta_id text UNIQUE,
  ADD COLUMN category text CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  ADD COLUMN stopped_at timestamptz,
  DROP CONSTRAINT whatsapp_templates_status_check,
  ADD CONSTRAINT whatsapp_templates_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'paused', 'disabled')),
  DROP CONSTRAINT whatsapp_templates_check,
  ADD CONSTRAINT whatsapp_templates_check CHECK (status <> 'approved' OR approved_at IS NOT NULL),
  ADD CONSTRAINT whatsapp_templates_stopped CHECK ((status IN ('paused', 'disabled')) = (stopped_at IS NOT NULL));

-- A text stops, as one that hasn't all gone in time does, when WhatsApp
-- pauses or disables its template: for that, its reason is 'template'.
ALTER TABLE mailings
  DROP CONSTRAINT mailings_wait_reason_check,
  ADD CONSTRAINT mailings_wait_reason_check CHECK (wait_reason IN ('civicrm', 'pull', 'limit', 'template'));

-- A stop of every text to a number, or of every call, goes to CiviCRM as
-- "Do not SMS" or "Do not phone" for the number.
ALTER TABLE civicrm_updates
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN phone text,
  DROP CONSTRAINT civicrm_updates_change_check,
  ADD CONSTRAINT civicrm_updates_change_check CHECK (change IN ('unsubscribe', 'no_bulk_email', 'allow_bulk_email',
    'do_not_sms', 'do_not_phone')),
  ADD CONSTRAINT civicrm_updates_email_or_phone CHECK (num_nonnulls(email, phone) = 1),
  ADD CONSTRAINT civicrm_updates_phone CHECK ((phone IS NOT NULL) = (change IN ('do_not_sms', 'do_not_phone')));
CREATE INDEX civicrm_updates_phone_index ON civicrm_updates (phone);
