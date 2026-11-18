-- Someone asked who hasn't answered can be marked so by staff: "invited", a
-- status either kind of ask allows. It isn't an answer (lib/asks/asks.ts).
INSERT INTO ask_kind_statuses (kind, status) VALUES
  ('letter', 'invited'),
  ('event', 'invited');

-- An ask's kind can change while nobody has answered it, and those marked
-- invited follow it, as either kind allows that.
ALTER TABLE ask_statuses
  DROP CONSTRAINT ask_statuses_ask_ask_kind_fkey,
  ADD CONSTRAINT ask_statuses_ask_ask_kind_fkey
    FOREIGN KEY (ask, ask_kind) REFERENCES asks (slug, kind) ON UPDATE CASCADE;

-- An "other" answer whose note says only that they haven't replied was
-- staff's way of marking them invited, so that's what it becomes. The audit
-- log's record of setting each says the same, so the history reads as the
-- answers do.
UPDATE ask_statuses
SET status = 'invited'
WHERE status = 'other' AND lower(btrim(note)) = 'no reply';

UPDATE audit_log
SET details = details || jsonb_build_object('status', 'invited')
WHERE action = 'set status'
  AND details ->> 'status' = 'other'
  AND lower(btrim(details ->> 'note')) = 'no reply';
