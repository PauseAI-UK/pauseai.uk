# Some frames show the day they were made

Size: S. Kind: small fix.

## Problem

A flow's clock is fixed, in the page, on the server and in Postgres (`tests/storyboard/fixtures.ts`), yet a few frames show the real day ("25 Nov" one day, "26 Nov" the next). A review then lists them as changed against main's frames, which are kept from the day main first ran the flow, and a flow carried from an earlier day's review differs from its own next run.

Seen in the mailings flows "A new mailing" (frame 1), "A stopped mailing" (frame 1), "Changing and deleting a draft" (frame 8), "Old mailings" (frame 1) and "Rescheduling a mailing" (frame 1), "Sorting and searching" in staff-navigation (frames 1 to 3), and "Unblocking an MP's address" in letters (frame 3). Each differs by the few hundred pixels of a date. Which timestamp gets past the fixed clock isn't found yet.

## Fix

Find where those rows' dates come from: a time written when the flow's database is made, before the fixed clock is set, is the likeliest. Give it the flow's fixed time. Then check that two reviews on different days show none of these as changed.

## Hits

- 2026-11-26: a review a day after main's frames listed these as changed in a branch that doesn't reach them, ~10 min to find it was the date
