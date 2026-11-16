-- A politician's photo, as their body's list gives it: the address of the
-- picture on the body's own site, which their page shows. Each import keeps
-- it, null where the body has none.
ALTER TABLE politicians ADD COLUMN photo_url text CHECK (photo_url ~ '^https://');
