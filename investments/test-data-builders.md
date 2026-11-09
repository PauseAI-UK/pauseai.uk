# Builders for test data

Size: L. Kind: architecture.

## Problem

Tests make their rows by hand: 281 `INSERT INTO` statements in 57 Vitest files, about 150 more in the storyboard's specs, 40 `INSERT INTO letters` across 24 files, and some files' own `seed()` helpers. There are three other separate datasets: `tests/fixtures/staff-data.sql` (1,091 lines, changed in 62 commits), the `*.examples.ts` files, and two builders in `tests/database.ts`. So a renamed or new column means editing every one of them.

## Fix

A typed builder module, such as `tests/build.ts` with `build.letter({...})`, `build.supporter(...)` and `build.mailing(...)`, giving valid defaults for every column. Each takes a database, so the storyboard can use them too. New tests use them, and files convert as they're touched, `letters` first. Later, `staff-data.sql` is made from the same builders.

## Hits

- 2026-10-28: renaming the letter tables (68906753) touched 27 files
