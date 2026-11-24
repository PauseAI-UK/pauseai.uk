-- A staff member's name, from their Google account, kept each time they log
-- in with it (createSession in lib/accounts/auth.server.ts). None until then.
ALTER TABLE staff_accounts ADD COLUMN name text;
