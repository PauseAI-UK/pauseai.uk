-- Since when a broadcast's sender has answered, at every try, that it can't
-- send for now, as at a day's limit: none of its copies has gone since. Null
-- once one goes. Whoever scheduled it is told once it has been a while.
ALTER TABLE mailings
  ADD COLUMN held_back_since timestamptz,
  ADD COLUMN held_back_told boolean NOT NULL DEFAULT false;
