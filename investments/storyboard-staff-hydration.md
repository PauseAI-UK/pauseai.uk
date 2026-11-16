# Flows can't tell when a staff page has hydrated

Size: S. Kind: small fix.

## Problem

`hydrated()` in `tests/storyboard/settle.ts` knows a page has hydrated by
the site header's `--site-header-h`, which staff pages don't have. On them
it waits only for the load and a quiet console. A flow that presses a link
just after the load can press it before React has, and a Next link pressed
then goes nowhere. Flows that hit it add a wait of their own (`handled()`,
or `hydrated()` where it happens to be long enough).

## Fix

Have `hydrated()` wait, on every page, for React to have taken over the
body's content (the `__reactProps$` key `handled()` looks for), and drop the
flows' own waits.

## Hits

- 2026-11-16: "An event stays on Future until the end of its day" failed in CI, its Group by choice pressed 200ms after the load, ~20 min
