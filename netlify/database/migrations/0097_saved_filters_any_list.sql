-- Which lists can have saved filters is the code's (SAVED in
-- lib/saved-filters.ts), whose forms refuse any other, so a new one needs
-- no migration.
ALTER TABLE saved_filters DROP CONSTRAINT saved_filters_list_check;
