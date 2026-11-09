# One runner for scheduled jobs

Size: L. Kind: architecture.

## Problem

A new scheduled job is spread over about ten places: `IMPORT_JOBS`, `IMPORT_SLUGS` and `JOB_SCHEDULES` in `lib/import-runs.ts`, `jobTitles` in the staff copy, switches in `Run.tsx` and `lib/run-log.ts`, a line in the staff actions, a cron route, and a folder in `netlify/functions/` with a near-identical wrapper and test. Each schedule is written twice, in the function's `config` and in `JOB_SCHEDULES`, and nothing checks they agree. Each job also handles its own time budget (`SENDING_MS`, `BUDGET_MS`, `PACE_MS`) and its own locking, three ways: advisory locks in two jobs, row claims in sending, and `job_presses`, a lease that only stops one staff press overlapping another. A scheduled run and a staff press of the politician sync or members import aren't kept apart. The Luma import holds one transaction for its whole run, up to 20 seconds of API calls, on a pool of three connections.

## Fix

`defineJob({ slug, schedule, title, budgetMs, exclusive, run(ctx) })`, one per job. The runner owns the advisory lock (which staff presses share), `keepingFailure`, `recordRun` and the time budget (`ctx.budget`), and the staff pages read titles and how a run is shown from the definition. The Netlify function wrappers share one helper and keep only their `config`, and a test checks each `config.schedule` against the definition. The Luma import commits in batches rather than in one transaction.

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
