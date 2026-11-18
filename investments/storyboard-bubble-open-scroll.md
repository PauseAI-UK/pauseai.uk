# A flow can still open a bubble without waiting for its scroll

Size: S. Kind: small fix.

## Problem

A bubble (`components/ui/Bubble.tsx`) scrolls the page to show itself on
its `toggle` event, a task after the press that opens it. A flow that
presses the button and goes straight on can take its frame, or press inside
the bubble, while that scroll is still going. In "Writing to a Lord"
(`tests/storyboard/politicians.spec.ts`), on the phone, both frames showed
the page at 171px in some runs and 128px in others, on the same build.

Flows open a bubble with `openBubble` (`tests/storyboard/settle.ts`), which
waits for the scroll. With every flow opening its bubbles that way, three
runs of all of them, on both viewports, gave the same frames, each the same
as main's. ESLint keeps `:popover-open` out of the flows, so none finds an
open bubble by its selector instead.

Two things are left:

- Nothing stops a flow pressing a bubble's button itself and finding what's
  in it by role or label, which the lint can't see. Twelve flows did.
- Why a late scroll lands 43px further, rather than in the same place, isn't
  known. With logging added, the bubble measured the same in every run (its
  top 564px down the window, 212px tall, fonts loaded, the page at the top),
  and the page ended at 128px even in runs where the `toggle` event came
  after Playwright had moved on to filling the bubble's first field. If
  it's something the site does, a person pressing quickly could meet it too.

## Fix

A listener for `toggle` events in the storyboard's page fixture
(`tests/storyboard/fixtures.ts`), which fails a flow when a popover with
`Bubble`'s class opens outside `openBubble`. The gallery's staff-politicians
page has a bubble that opens itself as the page loads, with no button to
press, so it needs a way to say that's meant.

Then, if it's wanted, find the 43px: take "Writing to a Lord" back to a
plain press on a branch, catch a run that lands at 171px with the scroll
position logged at each step and inside the `toggle` handler, and see what
moves it.

## Hits

- 2026-11-16: the flow's two phone frames differed from main's on a branch
  that doesn't reach it; the same build gave 171px in 1 of 4 runs, then
  128px in 30 runs with logging on, ~40 min
- 2026-11-16: on whatsapp-community-import, served from the main checkout
  (`/pauseai.uk`), both phone frames landed at 171px in 4 runs out of 4
  (the review, then `-g "Writing to a Lord"` three times), against main's
  128px, made in the main worktree: a checkout where it reproduces every
  time, ~10 min
- 2026-11-18: "Writing to a Lord" flaked on the phone again, main's build
  giving two scroll positions on different runs: the bubble's opening scroll
  raced the flow's frame. The flow now opens it with `openBubble`
  (`tests/storyboard/settle.ts`), which waits for that scroll, as every
  flow does, and ESLint keeps flows from finding an open bubble by
  `:popover-open`
- 2026-11-18: twelve more flows opened a bubble with a plain press and found
  what's in it by role or label, which that lint can't see. Found by a
  listener for `toggle` events put in the page fixture for one run of every
  flow, naming each popover that opened outside `openBubble`, then taken out
  again, ~20 min
