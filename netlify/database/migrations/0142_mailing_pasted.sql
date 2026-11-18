-- The names last pasted while choosing who a draft mailing is for, and who
-- each line found, for the politicians list's Paste names tab: each line
-- that found someone, with the politicians' IDs, and how many found no one.
ALTER TABLE mailings ADD COLUMN pasted jsonb;
