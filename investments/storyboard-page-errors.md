# Every flow fails on a page error

Size: S. Kind: small fix.

## Problem

Only the public-pages and gallery sections of the storyboard fail when the page throws: each listens for `pageerror` itself. The other flows click through the site and pass while it throws. Following the march banner to the march page threw on every click, and picking a Consent on New broadcast left an unhandled `NEXT_REDIRECT`. Both flows already went that way in the storyboard, and both errors were found only once production's error reports showed them. Playwright's `pageerror` doesn't hear a rejection Next marks as handled, so a listener for `pageerror` alone would have missed the second one.

## Fix

In the storyboard's `page` fixture (`tests/storyboard/fixtures.ts`), listen for `pageerror`, and for `unhandledrejection` through an init script, and fail the flow at its end with what was heard. Leave out what `ErrorReporter` leaves out (another origin's scripts, Next's redirect and not-found), so the flows fail on what production would report. Then take the two sections' own listeners out.

## Hits

- 2026-11-13: two errors production reported, from flows the storyboard already drives; wrote two Playwright probes in tmp/ to reproduce them, ~30 min
