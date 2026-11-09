# The storyboard's section list

Size: S. Kind: small fix.

## Problem

Each storyboard spec file is listed again in `SECTIONS` in `tests/storyboard/report/frames.ts`, and in a table in `docs/testing.md`. Only the docs table is checked. The table's rows are padded to one width, so one longer cell rewraps every row, and `docs/testing.md` is the file rebases conflict in most.

## Fix

Each spec declares its section's name and order, and the report reads them. The docs table becomes a list.

## Hits

- Week of 2026-10-12 (x1): rebases conflicted in `docs/testing.md`, in that many sessions
- Week of 2026-10-19 (x1): rebases conflicted in `docs/testing.md`, in that many sessions
- Week of 2026-10-26 (x4): rebases conflicted in `docs/testing.md`, in that many sessions
- Week of 2026-11-02 (x4): rebases conflicted in `docs/testing.md`, in that many sessions
- 2026-10-16: 00a887bb added a spec file, so edited the list and the table
- 2026-10-16: 8303d087 added a spec file, so edited the list and the table
- 2026-10-19: 29584c9f added a spec file, so edited the list and the table
- 2026-10-21: 9838ed79 added a spec file, so edited the list and the table
- 2026-10-21: b0431372 added a spec file, so edited the list and the table
- 2026-10-23: 6c8a4e41 added a spec file, so edited the list and the table
- 2026-10-26: f0f826a8 added a spec file, so edited the list and the table
- 2026-10-28: c7df38a8 added a spec file, so edited the list and the table
- 2026-10-29: 7a096a9c added a spec file, so edited the list and the table
- 2026-11-02: 6f6d6a79 added a spec file, so edited the list and the table
- 2026-11-02: 55632d4a added a spec file, so edited the list and the table
- 2026-11-04: bade75cc (#205) added a spec file, so edited the list and the table
- 2026-11-05: 38153e2a (#219) added a spec file, so edited the list and the table
- 2026-11-06: c4beca45 (#232) added a spec file, so edited the list and the table
- 2026-11-07: 67477af6 (#243) added a spec file, so edited the list and the table
