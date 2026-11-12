# The errors log's test of one error thrown at once

Size: S. Kind: small fix.

## Problem

`lib/server/errors-seen.test.ts`, "sends one email when the same new error is thrown twice at once", throws the same error three times together and expects one row with a count of 3. Once, in a full gate run with every project's tests going, it found a count of 1, with the one email sent: two of the three were never counted. It passed 52 times on its own and beside other test runs.

`keep()` catches any failure and reports it with `problem()` (`errorNotKept`). The test fails on any problem its three report, with the error's words, so the next failure says why.

One cause gives exactly that result: Postgres with no connections left. The three each need a connection from a pool of three (`lib/server/db.ts`), and the test file holds one already. With the server one short of its `max_connections` of 100, the other two are refused ("sorry, too many clients already"), leaving a count of 1 and one email. Whether that's what happened isn't known. One gate on a 14-core machine was seen to hold 34 connections at its busiest, so it would take about three such runs at once on one Postgres.

## Fix

When it next fails, go by the error it names.

- If it's the connection limit, give the Postgres that the checkouts share more connections (`max_connections`), or have the tests' pools hold fewer.
- If it's the lock or the upsert, the count is lost in production too when one error is thrown by several requests at once, and `count()` or `tell()` needs the fix.

## Hits

- 2026-11-11 (x2): failed once in a gate run, then 52 runs didn't reproduce it
