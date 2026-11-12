# A quicker storyboard review

Size: M. Kind: tools.

## Problem

A review's time is its flows': the fixture build takes 8 to 20 seconds, and every flow on both viewports takes 6.6 minutes on seven workers. The suite grows with every feature: 348 flows on 31 October 2026, 578 on 11 November. Pictures and the settling before them are most of a flow's time: every desktop flow took 2.9 minutes with pictures and about 1.7 without.

A review runs only the flows a change can reach (`docs/testing.md`, "Which flows a review runs"). On the 79 later pushes of 37 PRs (12 November 2026), that's 47% of a full review's time on average. A quarter of pushes need none. A sixth change a migration, `schema.sql` or the seed data, which reruns every desktop flow. What's left is mostly:

- **The staff pages reach most of the staff code.** A list page reaches 180 to 280 files, mostly through Server Action modules (`narrow-imports.md`), and `staffCopy` is in two thirds of the commits that rerun over half (`copy-beside-features.md`).
- **The gallery's flows are a quarter of a review.** A gallery flow is a whole group, one frame per component, and the six staff groups share `_examples/staff.client.tsx` (`gallery-beside-components.md`). So a change to one staff component re-pictures every staff group, about 45 seconds of a review.
- **The review before merging is full**, as it's the run kept for main's tree.

Main's frames are kept only on the machine that ran them, carried from the nearest kept tree for what a change can't reach.

## Fix

In order of what each would save:

1. Picture only the gallery's sections whose example reaches a changed file: each section's heading names its example file, and a gallery frame doesn't depend on the ones before it, so it can be carried on its own. A change to one component is then a page load and a picture or two.
2. Have CI picture main on each push to it and keep the frames as an artifact, for a review to fetch. First compare one run of CI's with one made locally: fonts and the machine may make the pictures differ.
3. Show the review as it fills: open the page at once, and add main's side as it arrives.

Following the flows' runs on the server, by coverage, picked a little fewer than following imports (45% of the time against 47%), but needs a run of one flow at a time, and the browser's coverage made nine letter flows fail. Not worth it.

## Hits

- 2026-11-12: three full reviews in a row on one branch, five minutes each with the build, as each turned up one failing phone flow and the fix to a shared piece (the bubble) needed every flow run again; the changes after the first touched four files, ~20 min waiting
- 2026-11-12: a full review took 12 minutes, not 5, with the machine busy with other work, and the staff kit's gallery flow (51 frames) passed its 60 seconds; the review after a one-line fix to a flow's step had to run whole again, ~25 min waiting
