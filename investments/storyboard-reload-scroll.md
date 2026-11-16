# A reload in a flow restores the scroll

Size: S. Kind: small fix.

## Problem

`page.reload()` in a storyboard flow keeps the window's scroll from before,
and the browser puts it back at a moment that depends on how far the page
has loaded. A frame taken after a reload of a scrolled page can land a few
dozen pixels apart between runs of the same build. Flows call
`page.reload()` in many places.

## Fix

A check in `tests/storyboard/` that a flow reloads only at the top of the
page, or a helper that loads the page fresh (`page.goto(page.url())`) and
is used in place of `page.reload()`.

## Hits

- 2026-11-16: "Our answer to a text, read" (phone) differed from main's by its scroll alone, ~15 min
