# A quicker CI

Size: M. Kind: tools.

## Problem

On main, CI takes about 5½ minutes, and the storyboard is the slow path: its slowest part took 314 to 324 seconds on 24 November 2026, against 190 to 194 for the tests'. Each storyboard part spends about a minute before its flows run: 30 to 45 seconds starting its containers, about 11 installing Git and the Postgres client, about 15 on Node and the caches, and about 12 building the site from its cache.

A pull request runs only the flows its change can reach and the spot checks (`docs/testing.md`, "Which flows CI runs"). A PR that reaches no flow ends when the tests do, but a feature PR still runs most of the flows, as it touches files most flows reach (`storyboard-review-speed.md`).

The machines differ: within one job nearly every test file or flow runs at the same fraction of its usual time, from ×0.61 to ×1.17 between jobs (17 and 18 November 2026), so a part's time varies by more than a better deal of its work would save.

## Fix

In the order to do them:

1. **A fourth storyboard part.** Each part's flows go from about 220 seconds to about 165 on main, for one more machine a run. A line in the workflow's matrix and the `3` in `scripts/ci-parts.mjs`'s call.
2. **An image of our own**, with Chromium, Git and the Postgres 18 client in it: perhaps 30 seconds off each Test and Storyboard part, from a smaller download (Playwright's image is 1,007 MB with three browsers, and CI uses one) and no install step to fail. Kept in GitHub's container registry (`ghcr.io`), free for a public image, and built by a workflow when its Dockerfile or the lockfile's Playwright version changes. Not measured.
3. **Leave the gallery's flows out of CI**, if they check nothing a unit test doesn't: they're about 15% of the flows' time, and CI takes no pictures.
4. **Run only the tests a PR can reach** (Vitest's `--changed`), now that a PR's storyboard can be quicker than its tests. Coverage would then be checked only for the changed files, as `npm run test:changed` does, with main's run checking all of it.

A change to `.github/workflows/` is pushed by a maintainer (`ci-workflow-pushes.md`).

## Hits

- 2026-11-19: Ubuntu's mirror timed out in "Install Git and the Postgres 18 client", failing four Test and Storyboard parts before anything ran, ~15 min and a push to run CI again
- 2026-11-19: the same step timed out again on `security.ubuntu.com`, failing a Storyboard part of a PR that changed only a unit test, ~5 min
