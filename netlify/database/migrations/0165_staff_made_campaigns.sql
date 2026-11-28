-- Who made a campaign on the staff site, and when. A campaign staff made
-- has no code: its page is /campaigns/<slug>, its title over the form, and
-- its letter is in campaign_letters. Both are empty for the campaigns in
-- the code (lib/content/email-your-mp.ts) and pauseai.info's old ones.
ALTER TABLE campaigns
  ADD COLUMN created_by text,
  ADD COLUMN created_at timestamptz,
  ADD CHECK ((created_by IS NULL) = (created_at IS NULL));
