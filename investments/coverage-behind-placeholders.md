# Coverage checked while copy waits for approval

Size: S. Kind: tools.

## Problem

Vitest skips the coverage report, and with it the 100% gate, when any test fails. `tests/checks/placeholder-copy.test.ts` fails on purpose while a branch has placeholder copy, which is most of a feature's life, so `npm test` and the gate never check coverage on those branches. Gaps pile up unseen until the copy is approved, and `npm test`'s exit code is 1 either way. Running everything but that check (`npx vitest run --coverage -t '^(?!.*placeholder mark)'`) shows them, but nothing says to.

## Fix

Have `npm test` (and the gate) run the placeholder check apart from the coverage run: the coverage run without it, then the check on its own, each with its own exit code in the gate's table. Or report the placeholder check as a warning on a branch and fail only on main's.

## Hits

- 2026-11-09: a feature branch's coverage had gone unchecked since its first placeholder; nine files had gaps when the check was left out, ~40 min
