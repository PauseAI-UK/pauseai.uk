# Coverage that depends on timing

Size: S. Kind: tools.

## Problem

A branch covered only when a timer or a connection happens to go one way passes `npm test` on a quiet machine and fails CI's per-file coverage gate on a loaded one, on a PR that never touched the file. The failure names the file and its percentage, not the branch, and the branch's other tests keep passing, so it reads as the PR's fault.

## Fix

A check, run nightly or from the gate on demand, that runs the node project's tests several times with a JSON coverage report and lists every branch whose hit count is zero in any run, or differs between runs at a count of one or two. Each one it finds gets a test that reaches it on purpose.

## Hits

- 2026-11-14: `lib/server/db.ts`'s flow pool closing after `closeDb()` was reached only if its one-second idle timer hadn't fired first, which failed coverage on #336, ~30 min
