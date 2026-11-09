# Tests of jobs running at once

Size: S. Kind: operations.

## Problem

Sending mailings relies on `FOR UPDATE SKIP LOCKED` (`lib/server/mailing-sending.ts`), and send-mailings has a background twin, but no test runs two sends at once to check each letter goes once. The jobs' advisory locks are tested only by taking the lock by hand.

## Fix

A test helper that runs N copies of a job at once on one database and counts what the fake services received. Use it for send-mailings, read-gmail and import-luma.

## Hits

None yet.
