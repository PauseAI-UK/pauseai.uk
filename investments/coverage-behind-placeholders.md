# Coverage checked while copy waits for approval

Size: S. Kind: tools.

## Problem

Vitest skips the coverage report, and with it the 100% gate, when any test fails. `tests/checks/placeholder-copy.test.ts` fails on purpose while a branch has placeholder copy, each piece of which starts with an asterism (three stars in a triangle). A branch has placeholders for most of a feature's life, so `npm test` and the gate never check coverage on it. Gaps pile up unseen until the copy is approved, and `npm test`'s exit code is 1 either way. Running everything but that check (`npx vitest run --coverage -t '^(?!.*placeholder mark)'`) shows the gaps, but nothing tells anyone to run it.

## Fix

Have `npm test` (and the gate) run the placeholder check apart from the coverage run: first the coverage run without the check, then the check on its own. Each has its own exit code in the gate's table. Or report the placeholder check as a warning on a branch, and fail on it only on main.

## Hits

- 2026-11-09: a feature branch's coverage had gone unchecked since its first asterism; nine files had gaps when the check was left out, ~40 min
