# A quicker storyboard review

Size: M. Kind: tools.

## Problem

A full review runs every flow on both viewports, about four minutes on seven workers, and the suite grows with every feature: 348 flows on 31 October 2026, 578 on 11 November. Main's side costs nothing once its frames are kept (`docs/testing.md`, "They're kept by tree"), so this branch's run is what's left.

Screenshots are about a quarter of it: the same 249 flows took 479 seconds without them and 636 with.

Main's frames are kept only on the machine that ran them. A commit of main that no review there has pictured costs one run of main, about four minutes.

## Fix

In order of what each would save:

1. Run only the flows a change can reach. Every request carries the flow's database cookie, so the fixture build can record the routes each flow renders. Changed files map to routes, routes to flows, and the rest are carried from the last review, as a partial run carries them. The last review before merging stays full.

   Tried on 12 November 2026, on the 280 desktop flows, against the last 80 PRs merged and the 231 commits inside 37 of them (branch `storyboard-affected-flows`):

   - Two ways of finding what a flow reaches. One records the routes it opens and follows their imports. Next's prefetches must be left out: on their own they make a public page "reach" 25 routes. The other takes V8 coverage of the server and the browser after each flow, run one at a time (about 9 minutes), mapped through the build's source maps. Pages rendered at build time need the imports, and a module that ran also counts what it imports, as values read at set-up aren't calls.
   - Neither missed a changed flow. Four planted staff changes changed 42 desktop flows. Imports predicted 244, coverage 111. Coverage's only misses were in flows that failed while it was recording, so every flow must pass in that run.
   - Most merged PRs still rerun everything: 47 of 80 touch a migration, `schema.sql`, `tests/fixtures/staff-data.sql`, `package.json` or the Playwright config.
   - Commits inside a PR do better. With coverage, and with `staffCopy` followed key by key, the median commit reruns 33% of flows (imports alone: 71%). 53 of 231 need no flows at all (docs, unit tests), and 107 need a quarter or fewer.
   - The staff pages are why it's broad. Every staff flow signs in to the dashboard, which reads most of the staff code. The list registry, the nav and the one `staffCopy` object reach 150 to 250 flows each.

   So the cheap parts are worth having now: no review at all for a change to docs or unit tests alone, and only a spec's own flows when only that spec changed. Choosing flows by coverage would make reviews quicker while a PR is being worked on, roughly halving the flows' 6.6 of the review's 9 minutes, but not the review before merging.
2. Have CI picture main on each push to it and keep the frames as an artifact, for a review to fetch. First compare one run of CI's with one made locally: fonts and the machine may make the pictures differ.
3. Show the review as it fills: open the page at once, run the sections with changed spec files first, and add main's side as it arrives.

## Hits

- 2026-11-12: three full reviews in a row on one branch, five minutes each with the build, as each turned up one failing phone flow and the fix to a shared piece (the bubble) needed every flow run again; the changes after the first touched four files, ~20 min waiting
- 2026-11-12: a full review took 12 minutes, not 5, with the machine busy with other work, and the staff kit's gallery flow (51 frames) passed its 60 seconds; the review after a one-line fix to a flow's step had to run whole again, ~25 min waiting
