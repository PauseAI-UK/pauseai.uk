# A flow's request to the fixture server is reset

Size: S. Kind: small fix.

## Problem

A storyboard flow's `page.request.get` failed with `read ECONNRESET`, with
nothing in the server's log: "A supporter's page" (desktop), fetching
`/staff/supporters/download?format=vcf`, in a full gate on a busy machine. It
passed in five runs alone straight after. The route doesn't stream, so a
response broken partway is unlikely. A request sent on a kept-alive socket
just as the server closes it would do this (Node closes idle ones after 5
seconds, and `next start` keeps that unless given `--keepAliveTimeout`), but
a script timing Playwright's request client across that edge, 21 times, saw
no reset.

## Fix

Find what resets it first: run the storyboard's server with
`--keepAliveTimeout` well over a flow's longest idle gap
(`scripts/serve-fixture.mjs`) and see whether the reset stops, or catch one
with the server's socket errors logged.

## Hits

- 2026-11-17: "A supporter's page" (desktop) failed in the gate with ECONNRESET, and passed five times alone, ~20 min
