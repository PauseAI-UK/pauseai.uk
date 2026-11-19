# A quicker CI

Size: M. Kind: tools.

## Problem

A push to a PR waits about 4½ to 5 minutes on CI (18 November 2026), and the storyboard is the slow path. Each of its three parts spends 30 to 45 seconds starting its containers, about 11 installing Git and the Postgres client, about 15 on Node and the caches, about 12 building the site from its cache, and then about 180 running its flows. The tests' three parts are done in about 3½ minutes.

What's known, from the runs of 17 and 18 November 2026:

- **The machines differ.** Within one job, nearly every test file or flow runs at the same fraction of its usual time, and the fraction differs between jobs: ×0.61 to ×1.06 for the tests' parts, ×0.82 to ×1.17 for the storyboard's, whatever each part holds. The part with the most work of any finished before lighter ones. So the same commit's slowest storyboard part took 183s in one run and 206s in the next. The logs don't name each job's processor, so this is inferred.
- **Single test files swing further**, and it isn't known why: `QrScanner.browser.test.tsx` took 4.8s, 5.4s, 19.3s and 23.5s in four runs, every test in it slower alike. Held to four cores here, it took 3.1s alone and 4.1s beside 54 other files, so the tests beside it don't explain it.
- **Dealing the tests by time gains nothing.** The slowest part's tests took 115 to 122s by count (Vitest's `--shard`), in turn, by each file's last time, and by time within each project. A perfect split would save about 10s, less than the machines differ by.
- **Dealing the flows evenly gains about 20s.** Playwright's `--shard` hands out blocks of flows in file order, so the gallery's and the broadcasts' land together: 675s, 428s and 512s of work in the three parts, at the flows' usual times. Dealt in turn they were 539s, 531s and 544s, and by each flow's last time 537s, 537s and 540s. The slowest part's flows averaged about 240s over four runs with `--shard` (up to 272s) and about 219s over four dealt by time (up to 232s).

## Fix

In the order to do them:

1. **A fourth storyboard part.** Each part's flows go from about 180s to about 135s, for one more machine a run. A line in the workflow's matrix and the `3` in `scripts/ci-parts.mjs`'s call.
2. **Take the times back out.** `scripts/ci-parts.mjs` deals by times kept in the Actions cache, which the facts above don't earn. Keep only the storyboard's flows dealt in turn, with no times: the tests go back to Vitest's `--shard`, and the sequencer, the times reporter (`tests/storyboard/report/times.ts`), the cache and artifact steps and the merging of times go.
3. **Run only the flows a PR can reach**, from each flow's pages kept in the repo (below). On 79 pushes a review took about half a full one's time on average, and a quarter of pushes needed no flow (`storyboard-review-speed.md`).
4. **An image of our own**, with Chromium, Git and the Postgres 18 client in it: perhaps 30s off each Test and Storyboard part, from a smaller download (Playwright's image is 1,007 MB with three browsers, and CI uses one) and no install step. Kept in GitHub's container registry (`ghcr.io`), which is free for a public image, and built by a workflow when its Dockerfile or the lockfile's Playwright version changes. `tests/checks/playwright-image.test.ts` would check our tag. Not measured.
5. **See what the gallery's flows check in CI**, which takes no pictures: they're about 15% of the flows' time (252s of 1,654s), and may be worth leaving out there.
6. **Run only the tests a PR can reach** (Vitest's `--changed`), once the storyboard is quicker than the tests. Coverage could then be checked only for the changed files, as `npm run test:changed` does, with main's run checking all of it.

To confirm the machines, print each job's processor and memory (`lscpu`, `free`) in the Test and Storyboard parts.

A change to `.github/workflows/` is pushed by Francis (`ci-workflow-pushes.md`).

## Each flow's pages, kept in the repo

Which flows a change can reach comes from two things: the files each page of the site uses, read from the imports, and the pages each flow asks for, which only a run of the flow tells (`opened`, `tests/storyboard/fixtures.ts`). The second is kept only with a run's frames, on the machine that ran it. Kept in the repo, a file for each section beside its spec, CI could choose a PR's flows, and so could a checkout with no kept run near it: a new worktree, a new machine, a PR stacked on unmerged ones. Those are the reviews that now plan for minutes and run every flow (seven of the hits in `storyboard-review-speed.md`). A review in a checkout that has reviewed lately would choose as it does now.

How it would work:

- The review adds to the lists of the flows it ran, and the change is committed with the PR. A list holds routes (`/staff/mailings/[id]`), not addresses: 40 of 535 addresses carry a database id.
- The planner (`scripts/storyboard-reach.mjs`) reads the lists of the commit a branch left main at, where it now needs a kept run.
- CI on a PR runs the flows the PR's changes reach, and every flow for a migration, the seed data, `package.json` or a file it can't place. A push to main runs every flow.
- A flow that asks for something not in its list fails, naming it, so a list can't fall behind unseen.

To settle first:

- **Lists that differ between runs.** Of 664 flows over about 11,000 kept runs, 566 had the same list every time, 66 changed once and stayed, as a change to the code would make them, and 32 went back and forth. 26 of those are `public-pages` flows: each checks its page's links by asking for them, but skips those an earlier flow in the same worker has checked (`checkedLinks`, `tests/storyboard/public-pages.spec.ts`), so the menu's and footer's links are in the list of whichever flow a worker ran first. One flow that checks every public page's links, and none in the others, would make each list the same every run. The other six aren't explained: a press logo in `onboarding-embed`, `/staff` in "Folding the sidebar", `/what-is-pauseai-uk` in "Closing a submenu", and three addresses in two phone flows of `mailings` and `politicians`.
- **Main's pictures.** The lists say which flows to run, but a review sets each frame beside main's, which still come from a kept run or from running main, for the reached flows only. What a review shows for a flow with no kept pictures needs deciding.

## Hits

- 2026-11-18: dealing CI's parts by each test file's and flow's last time took three pushes and eight runs of CI to find it gains the tests nothing and the storyboard about what dealing in turn does, as the machines' speeds differ by more than the parts did, ~4 hours
- 2026-11-19: Ubuntu's mirror timed out in "Install Git and the Postgres 18 client", failing four Test and Storyboard parts before anything ran; an image of our own (4, above) has no install step to fail, ~15 min and a push to run CI again
- 2026-11-19: the same step timed out again on `security.ubuntu.com`, failing a Storyboard part of a PR that changed only a unit test, ~5 min
