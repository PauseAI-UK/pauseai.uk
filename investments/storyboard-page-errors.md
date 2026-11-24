# Every flow fails on an unhandled rejection

Size: S. Kind: small fix.

## Problem

Every flow fails when a page throws, or logs an error from our own code (`watchConsole` in `tests/storyboard/fixtures.ts`), but not on a promise rejection Next marks as handled: Playwright's `pageerror` doesn't hear one, and nothing logs it. Picking a Consent on New broadcast left an unhandled `NEXT_REDIRECT` that production's error reports showed and the flow that goes that way passed. And the check fails on what the console says, not on what `ErrorReporter` would report, so the two can disagree.

## Fix

Listen for `unhandledrejection` through an init script in the same fixture, and add what it hears to the flow's problems. Leave out what `ErrorReporter` leaves out (another origin's scripts, Next's redirect and not-found), so the flows fail on what production would report.

## Hits

- 2026-11-13: an unhandled `NEXT_REDIRECT` production reported, from a flow the storyboard already drives; wrote a Playwright probe in tmp/ to reproduce it, ~15 min
