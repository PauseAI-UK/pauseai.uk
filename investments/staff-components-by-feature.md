# Staff components grouped by feature

Size: M. Kind: architecture.

## Problem

`app/(staff)/staff/_components/` is one folder of about 260 entries, about 120 of them components. It's flat but for the UI kit in `ui/`, and was touched in about 500 commits since October. Finding the pieces of one feature (politicians, mailings, letters, events, imports, accounts) means knowing their names.

## Fix

A folder per feature under `_components/`, holding its components, their tests, examples and `copy.ts` (`copy-beside-features.md`). The ESLint import layers allow it unchanged. Move each feature when it is next worked on.

## Hits

- 2026-11-14: the politicians' move (feature-folders chain) took two checks fixing for files they'd never seen in a feature folder: a gallery example's `<h1>` counted as a page's own title (staff-page-kinds), and a type import of a feature's lib counted as a job's module (cron-runs)
