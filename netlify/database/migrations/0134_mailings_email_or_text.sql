-- A mailing goes by email or by text. A text is sent by WhatsApp, which is
-- its backend, not a channel of its own.
ALTER TABLE mailings DROP CONSTRAINT mailings_channel_check;
ALTER TABLE mailings ADD CONSTRAINT mailings_channel_check CHECK (channel IN ('email', 'text'));
