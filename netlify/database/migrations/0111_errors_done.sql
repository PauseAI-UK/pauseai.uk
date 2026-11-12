-- An error an admin has marked done: when, and who. Happening again clears
-- both, so it's back on the list of those to do (lib/server/errors-seen.ts).
ALTER TABLE errors_seen
  ADD COLUMN done_at timestamptz,
  ADD COLUMN done_by text,
  ADD CONSTRAINT errors_seen_done CHECK ((done_at IS NULL) = (done_by IS NULL));
