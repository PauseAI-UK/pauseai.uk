# Vitest in two shards

Size: M. Kind: tools.

## Problem

CI's Test job is its longest: a passing run takes a median 4.5 minutes, and `npm test` with coverage is about four of them. CPU is the limit: the files' times add up to about 15 minutes, half of it the browser project. The slowest are `lib/server/old-letters-import.test.ts` (91s), `staff.browser.test.tsx` (36s) and `MailingWriter.browser.test.tsx` (31s).

## Fix

Run Vitest in two shards with blob reports, and merge them for coverage (https://vitest.dev/guide/improving-performance#sharding). The Test job would take about three minutes.

## Hits

None yet.
