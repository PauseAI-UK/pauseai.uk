# Investments

Work that makes the site easier to change, safer to run, or quicker to work on, as opposed to work on what it does for people. Each file here is one piece of it. They come in three sizes of ambition:

- **Architecture:** large refactors that change how a whole area is built, so that a kind of change that now touches ten files touches one. A letter's lifecycle defined once, one runner for every scheduled job, modules by domain. They take a week or more, and are done a step at a time.
- **Operations:** what keeps the live site working and tells us when it isn't. Error reporting, alerts when a job stops, checks that stop a bad deploy.
- **Small fixes:** a wrong type, a list kept by hand, a helper that's missing. Each takes an hour or two, and is easiest done in passing by whoever is working nearby.

Alongside them are the tools agents keep rebuilding for themselves, and changes to how we work.

## Logging a hit

When one of these costs you time, add a line under "Hits" in its file, saying when, what happened and, if you know, how long it cost:

```markdown
- 2026-11-12: wrote a script in tmp/ to run the gate in parallel, ~10 min
- Week of 2026-11-09 (x6): sessions set TEST_DATABASE_URL by hand
```

`(x6)` counts as six hits, for a line that sums up many. If no file fits, start one from the template at the end. Log a hit when you:

- write a script in `tmp/` that you'd want again
- make the same edit in three or more places for one change
- meet a flaky test (and fix it, as `docs/testing.md` says)
- wait more than five minutes for a check
- find a bug that the design made easy to write
- have to ask Francis something the docs should have said
- work around a tool, check or rule

The repo is public. A hit names no one and quotes no data, and says nothing about how you used production services or the database.

## Picking the next one

`npm run investments` lists every item, most hits first, with its size and kind.

Hits are a guide, not the answer. A missing tool is hit in every session, so tools pile up hits fast. An architecture item is hit once per feature that runs into it, and each of those hits can cost hours. Operations items get no hits until the day something goes wrong unseen. So weigh hits against size, weigh an architecture item by the changes it would make easy, and an operations item by how bad the failure it prevents would be.

Once a month, add up the month's hits (`friction-sweep.md`), reorder the list below, and choose what's next. About one PR in five should be one of these, each in its own PR. The PR that finishes an item deletes its file and its line here. An architecture item done in steps keeps its file until the last step, with the Fix saying what's left.

## The list

The order within each kind is a first judgement, until hits come in.

Architecture:

1. [A letter's lifecycle in one place](letter-lifecycle.md) (L)
2. [One runner for scheduled jobs](scheduled-job-runner.md) (L)
3. [One definition per staff list](staff-list-definition.md) (L)
4. [Modules by domain, without cycles](module-boundaries.md) (M)
5. [Copy beside its feature](copy-beside-features.md) (L)
6. [One pattern for staff actions](staff-actions-one-pattern.md) (M)
7. [Builders for test data](test-data-builders.md) (L)
8. [Row types from the schema](generated-row-types.md) (M)
9. [Composable SQL for lists](sql-fragments.md) (M)
10. [Typed audit actions](audit-actions-typed.md) (M)
11. [Politicians' past addresses in a table](politician-addresses.md) (M)
12. [Staff components grouped by feature](staff-components-by-feature.md) (M)
13. [Gallery examples beside their components](gallery-beside-components.md) (M)
14. [Split the staff browser tests](staff-browser-test-split.md) (M)
15. [One table for kept mail](mail-messages-table.md) (L)

Operations:

1. [Error reporting](error-reporting.md) (S)
2. [Alerts when a scheduled job stops](scheduled-job-alerts.md) (S)
3. [A check that pushed migrations are unchanged](pushed-migration-check.md) (S)
4. [Measure the staff pages' speed](staff-speed.md) (S)
5. [A merge queue](merge-queue.md) (S)
6. [Tests of jobs running at once](overlapping-job-tests.md) (S)
7. [Fixtures checked against the real services](contract-tests.md) (M)
8. [Postcodes.io in fixture builds](postcodes-in-fixtures.md) (S)

Small fixes:

1. [The test database's table list](test-database-tables.md) (S)
2. [One type for timestamps](timestamp-types.md) (S)
3. [Cached page loaders](cached-page-loaders.md) (S)
4. [CHECK lists in step with TypeScript](check-constraint-sync.md) (S)
5. [A plural helper](plural-helper.md) (S)
6. [One place for configuration](config-module.md) (S)
7. [Coverage only for code that ships](coverage-scope.md) (S)
8. [Fixtures out of `tests/`](fixtures-out-of-tests.md) (S)
9. [The storyboard's section list](storyboard-sections.md) (S)
10. [A helper for the supporters permission](can-see-supporters.md) (S)
11. [Pages that choose a view](page-view-choice.md) (S)
12. [A file per blog post](blog-one-file-per-post.md) (S)
13. [One route for local groups](local-group-route.md) (S)

Tools:

1. [`npm run gate`](gate-command.md) (S)
2. [Tests that find Postgres without help](test-database-default.md) (S)
3. [`npm run worktree`](worktree-setup.md) (S)
4. [Coverage on changed files](coverage-on-changed-files.md) (S)
5. [The storyboard's changed frames](storyboard-changed-frames.md) (S)
6. [Cancel superseded CI runs](ci-cancel-superseded.md) (S)
7. [Netlify's build without the checks](netlify-build-checks.md) (S)
8. [Vitest in two shards](vitest-sharding.md) (M)
9. [Group the storyboard's changed frames](storyboard-review-grouping.md) (M)
10. [Mutation testing on the core](mutation-testing.md) (M)
11. [The friction sweep](friction-sweep.md) (S)
12. [Project settings for Claude Code](claude-project-settings.md) (S)

Ways of working:

1. [Smaller pull requests](smaller-prs.md) (S)
2. [Delete one-off jobs once run](one-off-code-expiry.md) (S)

## Template

```markdown
# Title

Size: S, M or L. Kind: architecture, operations, small fix, tools or ways of working.

## Problem

What's wrong, where, and the facts that show it.

## Fix

What to change, and in what order if it takes several steps.

## Hits

None yet.
```

S is under a day, M a few days, L a week or more.
