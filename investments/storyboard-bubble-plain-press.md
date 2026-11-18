# Nothing fails a flow that opens a bubble with a plain press

Size: S. Kind: small fix.

## Problem

A bubble (`components/ui/Bubble.tsx`) scrolls the page to show itself a
moment after the press that opens it, so flows open one with `openBubble`
(`tests/storyboard/settle.ts`), which waits for that scroll. ESLint keeps
`:popover-open` out of the flows, so none finds an open bubble by its
selector instead.

But a flow can still press a bubble's button itself and find what's in it
by role or label, and take its frame mid-scroll. Neither the lint nor
anything else sees that.

## Fix

A listener for `toggle` events in the storyboard's page fixture
(`tests/storyboard/fixtures.ts`), which fails a flow when a popover with
`Bubble`'s class opens outside `openBubble`. The gallery's staff-politicians
page has a bubble that opens itself as the page loads, with no button to
press, so it needs a way to say that's meant.

## Hits

- 2026-11-18: twelve flows opened a bubble with a plain press. Found by
  putting such a listener in the page fixture for one run of every flow,
  then taking it out again, ~20 min
