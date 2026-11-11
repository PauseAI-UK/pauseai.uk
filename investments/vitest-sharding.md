# Vitest in two shards

Size: M. Kind: tools.

## Problem

CI's Test job is its longest: a passing run takes about five minutes, most of it `npm test` with coverage. CPU is the limit: the files' times add up to about 15 minutes, half of it the browser project. The slowest is `MailingWriter.browser.test.tsx` (31s).

## Fix

Run Vitest in two shards with blob reports, and merge them for coverage (https://vitest.dev/guide/improving-performance#sharding). The Test job would take about three minutes.

## Hits

None yet.
