-- English order, for sorting names: accented letters among the plain ones,
-- lower case among the capitals. The database's own collation, C.UTF-8,
-- sorts by character code. Each sort by a name says COLLATE english
-- (tests/checks/name-sorts.test.ts).
CREATE COLLATION english (provider = icu, locale = 'en-GB');
