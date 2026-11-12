# A quicker storyboard review

Size: M. Kind: tools.

## Problem

A full review runs every flow on both viewports, about four minutes on seven workers, and the suite grows with every feature: 348 flows on 31 October 2026, 578 on 11 November. Main's side costs nothing once its frames are kept (`docs/testing.md`, "They're kept by tree"), so this branch's run is what's left.

Screenshots are about a quarter of it: the same 249 flows took 479 seconds without them and 636 with.

Main's frames are kept only on the machine that ran them. A commit of main that no review there has pictured costs one run of main, about four minutes.

## Fix

In order of what each would save:

1. Run only the flows a change can reach. Every request carries the flow's database cookie, so the fixture build can record the routes each flow renders. Changed files map to routes, routes to flows, and the rest are carried from the last review, as a partial run carries them. The last review before merging stays full.
2. Have CI picture main on each push to it and keep the frames as an artifact, for a review to fetch. First compare one run of CI's with one made locally: fonts and the machine may make the pictures differ.
3. Show the review as it fills: open the page at once, run the sections with changed spec files first, and add main's side as it arrives.

## Hits

None yet.
