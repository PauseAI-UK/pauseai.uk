# One definition per staff list

Size: M. Kind: architecture.

## Problem

Each list is defined once (`defineStaffList` in `lib/staff-lists.ts`), and its URL's types, reading, sort, headings and saved filter's parameters come from that, but three things are still written per list:

- **The filter bar's filters.** Each `*Filters.tsx` builds its `Filter[]` by hand: a label, whether it repeats and its options. Whether a filter repeats is already in the definition's `params`.
- **A saved list needs a migration.** `saved_filters.list` has a `CHECK` naming each list in `SAVED`, so a new one widens it.
- **The pages' titles and words.** Each list has its own `*Words()` for its title and its saved filters' summaries, and its page calls it in `generateMetadata` as well as in its component.

Each page's `requireStaff()` stays on the page, as `tests/checks/staff-auth.test.ts` reads it there, so a helper that opens a list can't check the permission for it.

## Fix

Give each param in the definition its label and its options' source, and build `Filter[]` from it, leaving each `*Filters.tsx` the choices that come from the database. Drop the `CHECK` on `saved_filters.list`, as `savedListFrom()` already refuses an unknown list. Then a helper after `requireStaff()` can load the saved filter and give the title.

## Hits

- 2026-10-19: f0aff071 added a list's sort or filters, by copying an existing list's
- 2026-10-21: 9838ed79 added a list's sort or filters, by copying an existing list's
- 2026-10-21: c52336f1 added a list's sort or filters, by copying an existing list's
- 2026-10-26: 72ebb864 added a list's sort or filters, by copying an existing list's
- 2026-10-31: a183bbf5 added a list's sort or filters, by copying an existing list's
- 2026-11-02: 596a2f70 (#204) added a list's sort or filters, by copying an existing list's
- 2026-11-05: 38153e2a (#219) added a list's sort or filters, by copying an existing list's
- 2026-11-06: 86266914 (#231) added a list's sort or filters, by copying an existing list's
- 2026-11-06: c4beca45 (#232) added a list's sort or filters, by copying an existing list's
- 2026-11-07: 67477af6 (#243) added a list's sort or filters, by copying an existing list's
