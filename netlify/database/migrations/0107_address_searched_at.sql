-- When policy@ and Joseph's mailbox were searched for an address staff
-- added to a politician's, for the mail with it that came before it was
-- added. Null until the regular read of Gmail has searched for it
-- (lib/server/politician-aliases.ts), which then carries on with the next.
-- Those added already are searched again, as their search ran while the
-- staff member waited and Gmail could cut it short.
ALTER TABLE politician_addresses ADD COLUMN searched_at timestamptz;
ALTER TABLE politician_addresses ADD CHECK (searched_at IS NULL OR source = 'staff');
