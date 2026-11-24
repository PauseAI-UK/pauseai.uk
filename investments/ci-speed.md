# A quicker CI

Size: M. Kind: tools.

## Problem

On main, the storyboard is CI's slow path. Its four parts' flows take about 150 to 160 seconds each, on top of a minute or so of setup: starting the containers, Node and the caches, and building the site from its cache. The tests' parts take about 160 to 190 seconds, so the two paths are now close. Both figures are simulated from main's runs of 24 November 2026, before the fourth part and CI's own image; measure them again over a few runs on main.

A pull request runs only the flows its change can reach and the spot checks (`docs/testing.md`, "Which flows CI runs"). A PR that reaches no flow ends when the tests do, but a feature PR still runs most of the flows, as it touches files most flows reach (`npm run reach` lists them).

The machines differ: within one job nearly every test file or flow runs at the same fraction of its usual time, from ×0.61 to ×1.17 between jobs (17 and 18 November 2026), so a part's time varies by more than a better deal of its work would save.

## Fix

1. **Leave the gallery's flows out of CI**, once every flow fails on a console error. They're about 15% of the flows' time, and without them the slowest part's flows would take about 120 to 130 seconds. But apart from `public-pages`, they're the only flows that fail on a console error, so they're CI's only check that a staff component hydrates: a hydration mismatch planted in `CopyButton` failed the gallery's `staff-kit` and `staff-letters` flows and nothing else, though 48 other flows opened it and its unit tests rendered it. Move the console check into the flows' shared fixture first, then the gallery's flows check nothing the others don't.
2. **Run only the tests a PR can reach** (Vitest's `--changed`), now that a PR's storyboard can be quicker than its tests. Coverage would then be checked only for the changed files, as `npm run test:changed` does, with main's run checking all of it. Vitest follows imports, so it would miss the tests that read files by path, such as `tests/checks/`.

A change to `.github/workflows/` is pushed by a maintainer (`ci-workflow-pushes.md`).

## Hits
