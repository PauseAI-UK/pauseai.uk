# A frame lands a pixel lower now and then

Size: S. Kind: small fix.

## Problem

A phone frame taken after a button re-renders part of a form can land a pixel lower than the same frame in another run, everything below the sticky header moved: the broadcasts flow "A draft a colleague schedules meanwhile", frame 3, and the mailings flow "A test copy for someone who's no longer a recipient", frame 1. The first came out once with everything below the sticky header a pixel lower than main's and than three more runs of the same build. The frame is taken after Unschedule re-renders the draft, so the window's scroll after that render seems to land a pixel apart now and then. Not yet reproduced on demand.

## Fix

Run the flow until it differs, read `window.scrollY` before the frame in both, and find what leaves it a pixel off; `tests/storyboard/frame.ts` rounds a fractional scroll already, so it's likely a scroll still moving when the frame is taken.

## Hits

- 2026-11-24: differed from main in a review of a branch that doesn't reach its page's look, then matched main in three reruns, ~10 min
- 2026-11-24: the mailings flow "A test copy for someone who's no longer a recipient" (phone), frame 1, a pixel lower than main's in the same way, after Send test, so it isn't one flow's
- 2026-11-28: the same flow (desktop), frame 1, a pixel lower than main's, in a review of a branch that changes nothing on that page
