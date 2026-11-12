# A check that each migration is backward compatible

Size: M. Kind: operations.

## Problem

`docs/code-structure.md` says migrations must be backward compatible (expand, then contract), as Netlify applies them before the new code is published, so the old code runs against the new schema for a while, and for good if the deploy then fails. Nothing checks it. A rename of a table, view or column passes every check and only shows when old code meets the new schema.

The storyboard's review meets it only when run with `--this-suite-on-main`, where main's server runs against this branch's migrations (`scripts/storyboard.mjs`): every main flow that touches what was renamed fails there. A plain review takes main's frames from main's own suite, on main's own schema, so it shows nothing.

## Fix

A check in the gate and CI that runs main's server, or main's Vitest database tests, against a database built from the branch's migrations, and lists what fails. A branch that means to break compatibility says so (a label, say), and the check then names what breaks, so the review knows which flows have no main to compare with.

## Hits

- 2026-11-11: renaming `members` to `airtable_members` failed 143 of main's storyboard flows, leaving their frames out of the review, ~20 min to find why
