# Builders for test data

Size: L. Kind: architecture.

## Problem

Tests make their rows by hand:

- over 300 `INSERT INTO` statements in about 60 Vitest files;
- about 60 more in the storyboard's specs;
- `INSERT INTO letters` in about 20 files;
- some files' own helpers, such as `seed()` in `lib/server/old-letters-import.test.ts`.

There are three other separate datasets:

- `tests/fixtures/staff-data.sql` (about 1,300 lines, changed in 70 commits);
- the `*.examples.ts` files;
- the builders in `tests/database.ts` (`addTestPolitician`, `addTestLetter`).

So a renamed or new column means editing every one of them.

## Fix

A typed builder module, such as `tests/build.ts` with `build.letter({...})`, `build.supporter(...)` and `build.mailing(...)`, giving valid defaults for every column. Each takes a database, so the storyboard can use them too. New tests use them, and existing files convert as they're touched, starting with `letters`. Later, `staff-data.sql` is made from the same builders.

## Hits

- 2026-10-28: renaming the letter tables (68906753) touched 27 files
