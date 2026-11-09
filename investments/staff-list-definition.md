# One definition per staff list

Size: L. Kind: architecture.

## Problem

A staff list's filters, sorts, saved filters and URL parameters are defined in about eight places. Saved filters for the audit log (#243, 55 files) changed `lib/saved-filters.ts`, `lib/server/stored-filters.ts`, `lib/staff-forms.ts`, `lib/staff-search.ts`, `ChangesFilters.tsx`, `lib/change-sort.ts`, the storyboard's frame list and a migration that only widened a CHECK. The parameter names are typed by hand in five of those files. There are six `*-sort.ts` files and five `*Filters.tsx` files built from the same pattern, and one list's parser is in `lib/server/politicians.ts` while the rest are in `lib/staff-search.ts`.

## Fix

Define each list once, with `defineStaffList({ path, params, sorts, needs })`, and derive the parser, the saved and choosing parameters, the value checks, the `FilterBar` filters and the permission from it. A `staffListPage()` helper does the auth, saved filters, parsing and title that each list page repeats. This completes the existing kit (`FilterBar`, `parseSort`, `savedFiltersProps`) rather than replacing it.

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
