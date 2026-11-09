# One runner for scheduled jobs

Size: L. Kind: architecture.

## Problem

Each job is defined once in `JOBS` (`lib/import-runs.ts`), run through `lib/server/jobs.ts` by one cron route and one staff action, and its scheduled function is a line on `netlify/scheduled.ts` whose schedule a test checks. What's left is how a job runs. Each handles its own time budget (`SENDING_MS`, `BUDGET_MS`, `PACE_MS`), calls `keepingFailure` and `recordRun` itself, and does its own locking, three ways: advisory locks in two jobs, row claims in sending, and `job_presses`, a lease that only stops one staff press overlapping another. A scheduled run and a staff press of the politician sync or members import aren't kept apart. The Luma import holds one transaction for its whole run, up to 20 seconds of API calls, on a pool of three connections.

## Fix

`lib/server/jobs.ts` owns the advisory lock (which staff presses share, so `job_presses` can go), `keepingFailure`, `recordRun` and the time budget (`ctx.budget`), with each job's `run(ctx)` beside its definition. The Luma import commits in batches rather than in one transaction. These change how jobs behave in production, so they go in a PR of their own.

## Hits

- 2026-10-14: 71b88060 added a scheduled job, across its ten places
- 2026-10-15: 2ad6dbfe added a scheduled job, across its ten places
- 2026-10-21: 3e5b7f73 added a scheduled job, across its ten places
- 2026-10-22: b72abe1b added a scheduled job, across its ten places
- 2026-10-28: ec3fe73b added a scheduled job, across its ten places
- 2026-10-29: 96c0abd5 added a scheduled job, across its ten places
- 2026-10-30: 950c32d8 added a scheduled job, across its ten places
- 2026-11-05: 38153e2a (#219) added a scheduled job, across its ten places
- 2026-11-05: 50e11f0f (#221) added a scheduled job, across its ten places
