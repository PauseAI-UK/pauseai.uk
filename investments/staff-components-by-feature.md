# Staff components grouped by feature

Size: M. Kind: architecture.

## Problem

`app/(staff)/staff/_components/` is one folder of about 260 entries, about 120 of them components. It's flat but for the UI kit in `ui/`, and was touched in about 500 commits since October. Finding the pieces of one feature (politicians, mailings, letters, events, imports, accounts) means knowing their names.

## Fix

A folder per feature under `_components/`, holding its components, their tests, examples and `copy.ts` (`copy-beside-features.md`). The ESLint import layers allow it unchanged. Move each feature when it is next worked on.

## Hits

None yet.
