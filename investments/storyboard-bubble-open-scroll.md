# A bubble opening on a phone sometimes scrolls 43px further

Size: S. Kind: small fix.

## Problem

In "Writing to a Lord" (`tests/storyboard/politicians.spec.ts`), on the
phone, both frames sometimes show the page scrolled to 171px rather than
128px, with the same build. The bubble under "add email" opens near the foot
of the window, and `BubbleBox` (`components/ui/Bubble.tsx`) scrolls the page
on its `toggle` event by however far its foot hangs below the window.

With logging added, the bubble measured the same in every run (its top 564px
down the window, 212px tall, fonts loaded, the page at the top), and the page
always ended at 128px. That held even in the runs where the `toggle` event
came after Playwright had moved on to filling the bubble's first field. So
the extra 43px comes from something not yet found: a scroll from filling a
field, or from the frame itself, or a layout above the bubble that hadn't
settled when it was measured.

## Fix

Catch a run that lands at 171px with the scroll position logged at each step
and inside the `toggle` handler, find what moves it, and make the opening
scroll not depend on it.

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
