-- What sending a broadcast's copies keeps of its tries, by either channel.

-- When a copy being sent was handed to its channel. One a run took and
-- stopped before handing over never went, so it goes again; one handed over
-- may have gone, so it's failed, never sent twice. Null again once it's put
-- back to go later.
ALTER TABLE broadcast_messages ADD COLUMN handed_at timestamptz;

-- When a try at one of a broadcast's copies last failed. The broadcast
-- rests a while after, as whatever failed one copy may fail them all.
ALTER TABLE mailings ADD COLUMN try_failed_at timestamptz;
