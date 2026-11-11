# The errors log's test of one error thrown at once

Size: S. Kind: small fix.

## Problem

`lib/server/errors-seen.test.ts`, "sends one email when the same new error is thrown twice at once", throws the same error three times together and expects one row with a count of 3. Once, in a full gate run with every project's tests going, it found a count of 1, with the one email sent: two of the three were never counted. `keep()` catches any failure and reports it with `problem()` (`errorNotKept`), so the test passes on to its check without saying what went wrong.

It passed 52 times on its own and beside other test runs, so what failed isn't known. The three each take a connection from a pool of three (`lib/server/db.ts`), and the upsert (`count()`) and the email's claim on the row (`tell()`) both touch the one row.

## Fix

Have the test fail on any `problem()` its three report, with the error, so the next failure says why; then fix that. If it's the pool or the lock, the count may be lost in production too when one error is thrown by several requests at once.

## Hits

- 2026-11-11 (x2): failed once in a gate run, then 52 runs didn't reproduce it
