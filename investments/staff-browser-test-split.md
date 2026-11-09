# Split the staff browser tests

Size: M. Kind: architecture.

## Problem

One test file, `app/(staff)/staff/_components/staff.browser.test.tsx`, covers dozens of staff components: 6,044 lines, 63 top-level `describe` blocks and 80 imports. That's against the rule that tests sit next to their code. One component's tests can't be run on their own, it takes 36 seconds in one worker, and branches conflict in it.

## Fix

Move each `describe` into a test file beside its component. It's mechanical, and best done when few staff branches are open.

## Hits

- Week of 2026-10-26: a rebase conflicted in it
- Week of 2026-11-02: a rebase conflicted in it
