# A quicker CI

Size: M. Kind: tools.

## Problem

On main, the storyboard is CI's slow path. Without the gallery's flows, its four parts' flows take about 120 to 130 seconds each, on top of about 45 seconds of setup: starting the containers, Node and the caches, and building the site from its cache. The tests' parts take about 135 to 175 seconds, so the tests may now be the slow path. The flows' figure is simulated from main's runs of 24 November 2026; measure both again over a few runs on main.

A pull request runs only the flows its change can reach and the spot checks (`docs/testing.md`, "Which flows CI runs"). A PR that reaches no flow ends when the tests do, but a feature PR still runs most of the flows, as it touches files most flows reach (`npm run reach` lists them).

The machines differ: within one job nearly every test file or flow runs at the same fraction of its usual time, from ×0.61 to ×1.17 between jobs (17 and 18 November 2026), so a part's time varies by more than a better deal of its work would save.

## Fix

**Run only the tests a PR can reach** (Vitest's `--changed`), now that a PR's storyboard can be quicker than its tests. Coverage would then be checked only for the changed files, as `npm run test:changed` does, with main's run checking all of it. Vitest follows imports, so it would miss the tests that read files by path, such as `tests/checks/`.

A change to `.github/workflows/` is pushed by a maintainer (`ci-workflow-pushes.md`).

## Hits
