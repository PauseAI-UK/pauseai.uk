# A quicker storyboard review

Size: M. Kind: tools.

## Problem

A full review runs every flow on both viewports, about four minutes on seven workers, and the suite grows with every feature: 348 flows on 31 October 2026, 578 on 11 November. Main's side costs nothing once its frames are kept (`docs/testing.md`, "They're kept by tree"), so this branch's run is what's left.

Screenshots are about a quarter of it: the same 249 flows took 479 seconds without them and 636 with.

Main's frames are kept only on the machine that ran them. A commit of main that no review there has pictured costs one run of main, about four minutes.

## Fix

In order of what each would save:

1. Run only the flows a change can reach. Every request carries the flow's database cookie, so the fixture build can record the routes each flow renders. Changed files map to routes, routes to flows, and the rest are carried from the last review, as a partial run carries them. The last review before merging stays full.

   Tried on 12 November 2026 (branch `storyboard-affected-flows`, scripts in its `tmp/affected/`), on the 280 desktop flows, against the 79 later pushes of 37 PRs (one CI run each), 231 commits and 80 merged PRs.

   **Finding what a flow reaches.** Record what each flow opens, in the storyboard's own fixtures, and follow the imports of each route it renders. Leave out Next's prefetches (one public page "reaches" 25 routes through them) and type-only imports (`import type` tied 123 server modules into one knot). A gallery group reaches only its own examples, though the gallery's index imports them all. A change to `staffCopy` counts only for the files that read the keys it changed. A data file read at run time (a fixture's emails, a CSV) counts for the flows that reach code naming it. Server and browser coverage, taken flow by flow, did only a little better (below) and costs a 9-minute run one flow at a time, in which the browser's coverage made 9 letter flows fail. Recording requests costs nothing, so every run can keep the map up to date.

   **Nothing was missed.** Four planted staff changes changed 42 desktop flows. Imports predicted 244 before the refinements above, and coverage 111. Frames that changed between kept commits of main were all predicted too.

   **What a push after the first would rerun**, on average: 47% of a full review's flow time with imports, 45% with coverage, against 59% before the refinements. A quarter of pushes (19 of 79) need no flows at all. A sixth (14) change a migration, `schema.sql` or the seed data, which no file can be traced through.

   **Why so many flows.** The fixture build takes 8 to 20 seconds, so a review's time is its flows': 6.6 minutes on both viewports, 2.9 on desktop alone, 2.0 for the gate's flows without pictures. Pictures and the settling before them are most of a flow's time. What makes a change reach so many:
   - The staff server code is one web. Each list page imports Server Action modules for a button or two (`supporters/page.tsx` imports `broadcast-actions.ts`, and so all of the mailing drafts), and those import most of the rest: `actions.ts` has every scheduled job and erasure; `email.ts`, `gmail-accounts.ts`, `notifications.ts` and `relays.ts` import each other. A list page reaches 180 to 280 files, and splitting one module out changes nothing.
   - `staffCopy`, one 2,900-line object read by 208 files, is in two thirds of the commits that rerun over half. Even key by key, a key such as `politician` reaches 146 flows.
   - The gallery's 25 flows take a quarter of a review, so a component change that reaches them costs far more than its flow count.

   **Recommendation.** Make the gate and the review one run, as "The gate's flows and the full review run the same flows twice" proposes. It runs every flow on desktop, as the gate does now, which catches what a migration or seed data breaks. It takes pictures only of the flows the change reaches, on both viewports, and the phone's tagged flows run as now; the rest carry their frames from the last run. A change to a migration, `schema.sql` or the seed data pictures every desktop flow. On these pushes that's 4.1 minutes on average against 8.8 for the gate then the review. The review before merging stays full, unless CI pictures every flow.

   **First steps:**
   1. Record each flow's requests in every run.
   2. Skip the review when a change touches only docs, plans, investments or unit tests.
   3. Then pick flows from the map.

   Coverage isn't worth it. Splitting the staff Server Action modules or `staffCopy` would help the map less than it would help reading the code.
2. Have CI picture main on each push to it and keep the frames as an artifact, for a review to fetch. First compare one run of CI's with one made locally: fonts and the machine may make the pictures differ.
3. Show the review as it fills: open the page at once, run the sections with changed spec files first, and add main's side as it arrives.

## Hits

- 2026-11-12: three full reviews in a row on one branch, five minutes each with the build, as each turned up one failing phone flow and the fix to a shared piece (the bubble) needed every flow run again; the changes after the first touched four files, ~20 min waiting
- 2026-11-12: a full review took 12 minutes, not 5, with the machine busy with other work, and the staff kit's gallery flow (51 frames) passed its 60 seconds; the review after a one-line fix to a flow's step had to run whole again, ~25 min waiting
