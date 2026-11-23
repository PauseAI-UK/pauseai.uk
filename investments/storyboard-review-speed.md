# A quicker storyboard review

Size: M. Kind: tools.

## Problem

A review's time is its flows': the fixture build takes 8 to 20 seconds, and every flow on both viewports takes about five minutes on seven workers. The suite grows with every feature: 348 flows on 31 October 2026, 578 on 11 November. Pictures and the settling before them are most of a flow's time.

A review pictures only the flows that the files a branch changes from main can reach, and runs main for the same flows (`docs/testing.md`, "Which flows a review runs"). A sixth of pushes change a migration, `schema.sql` or the seed data, which pictures every desktop flow (79 pushes of 37 PRs, 12 November 2026). What's left is mostly:

- **Some files reach most flows.** `npm run reach` lists them, most first: narrowing what imports one makes every review that changes it shorter.
- **The gallery's flows are a quarter of a full review.** A review pictures only the frames of a group a change reaches, but a component whose examples are in the group's own file (most of the site's kit, `_examples/ui.tsx`) is pictured whenever its group is reached.
- **One file of seed data**, which every desktop flow reruns for (`test-data-builders.md`).
- **A checkout with no kept runs pictures every flow.** Which pages a flow opens is known only from a run of it, kept on the machine that ran it, beside main's frames. A new sandbox has neither, so nothing says what its change reaches, and main runs for every flow too.
- **A flow's record of its pages can be wrong.** One from an older main is out of date if a merge since changed which pages the flow opens, and the review then leaves the flow out. Six flows record different pages from one run to the next, for reasons not yet known (`ci-speed.md`, "Lists that differ between runs").

Choosing the flows takes about 5 seconds before the build starts, building the import graph, which every review does again from nothing.

## Fix

In order of what each would save:

1. Keep each flow's pages in the repo (`ci-speed.md`, "Each flow's pages, kept in the repo"). A checkout with no kept run then chooses its flows in seconds, and the record is the branch's own.
2. Take out the carrying of main's frames between kept trees (`carryFromNearest` in `scripts/storyboard.mjs`), leaving the store a plain cache by tree: main then runs a flow once for each commit of main a review needs it at. Carrying saves only a few flows and one build of main after a rebase, for the most intricate part of the review.
3. Have CI picture main on each push to it and keep the frames as an artifact, for a review to fetch. First compare one run of CI's with one made locally: fonts and the machine may make the pictures differ.
4. Show the review as it fills: open the page at once, and add this branch's side as it arrives.
5. Place a migration by the tables each flow uses, measured rather than read from the code. Each flow has a database of its own, so before it's dropped, `pg_stat_user_tables` in it says which tables the flow read or wrote, views' and functions' tables included; kept beside `opened`, a migration then reruns the flows that used what it alters, and every flow only for a collation or anything it can't place. Postgres keeps a connection's counts for up to a second or so before they show (https://www.postgresql.org/docs/current/monitoring-stats.html), so check none is missed before trusting it.
6. An audit of the map that can be run again, after a change to how the site is built (a new Next, another bundler): the check below was made with scripts that weren't kept.

Reading a migration's SQL for the tables it alters, and rerunning the flows whose files name one, doesn't narrow enough (#402, closed): on main's last 30 migrations it would still have rerun every desktop flow for 15 of them, as files every flow reaches (`tests/storyboard/fixtures.ts`, `scripts/fresh-database.mjs`) name the common tables.

## How the map was checked

On 12 November 2026, each of the 280 desktop flows was run alone on a warm server, with Next's prefetches answered with nothing, and the server's coverage taken before and after. Every source file that ran in a flow (19,221 pairs of a flow and a file) was in what the map says that flow reaches. Taking a known hand-over back out of the map made the check fail, so it could fail.

By pictures: a review with prefetches answered with nothing pictured all 2,182 frames as one without did; five planted changes, reviewed from kept frames, pictured every frame as a run of every flow did; and with the map blinded to the staff copy on purpose, the spot checks caught it and the review ran every flow.

Choosing flows by each flow's coverage, in place of imports, picked a little fewer (45% of the time against 47%) but needs each flow run alone. Not worth it.

## Hits

- 2026-11-12: three full reviews in a row on one branch, five minutes each with the build, as each turned up one failing phone flow and the fix to a shared piece (the bubble) needed every flow run again; the changes after the first touched four files, ~20 min waiting
- 2026-11-16: the gate's storyboard in a new sandbox had no frames to carry, so it ran all 626 branch flows (7 min) and then main's whole suite, and stopped at its 20-minute limit before comparing; the gate failed for that alone, ~25 min waiting
- 2026-11-14: a rename-only PR (names that say where code runs) added one marker package to `package.json`, and `package.json` reruns every desktop flow
- 2026-11-16: a migration that only widened the CHECKs of `civicrm_updates`, a table no page shows, reran every desktop flow in the gate's review, though the change could reach none
- 2026-11-17: a migration reran all 658 flows on both viewports in the gate's review, beside `npm test`; the load reached 80 on 14 cores, so dozens of unrelated tests timed out at 10 seconds and the review stopped at its 20-minute limit; both had to run again, one at a time, ~35 min