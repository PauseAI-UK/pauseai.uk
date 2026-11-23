# A quicker storyboard review

Size: M. Kind: tools.

## Problem

A review's time is its flows': the fixture build takes 8 to 20 seconds, and every flow on both viewports takes about five minutes on seven workers. The suite grows with every feature: 348 flows on 31 October 2026, 578 on 11 November. Pictures and the settling before them are most of a flow's time.

A review pictures only the flows that the files a branch changes from main can reach, and runs main for the same flows (`docs/testing.md`, "Which flows a review runs"). A sixth of pushes change a migration, `schema.sql` or the seed data, which pictures every desktop flow (79 pushes of 37 PRs, 12 November 2026). What's left is mostly:

- **Some files reach most flows.** `npm run reach` lists them, most first: narrowing what imports one makes every review that changes it shorter.
- **The gallery's flows are a quarter of a full review.** A review pictures only the frames of a group a change reaches, but a component whose examples are in the group's own file (most of the site's kit, `_examples/ui.tsx`) is pictured whenever its group is reached.
- **One file of seed data**, which every desktop flow reruns for (`test-data-builders.md`).
- **A checkout with no kept runs pictures every flow.** Which pages a flow opens is known only from a run of it, kept on the machine that ran it. A new sandbox has none, so nothing says what its change reaches.
- **A flow's record of its pages can be wrong.** One from an older main is out of date if a merge since changed which pages the flow opens, and the review then leaves the flow out. And some of the public pages' flows record other flows' pages in a run of every flow, but only their own when few run, so a review pictures a few more flows than it need.

Main's frames are kept only on the machine that ran them.

Choosing the flows takes about 5 seconds before the build starts, building the import graph, which every review does again from nothing.

A review still carries main's frames from one kept tree to another, by the map of what a change reaches (`carryFromNearest` in `scripts/storyboard.mjs`). It saved hundreds of flows when a review needed all of main. Now it saves a few flows and one build of main after a rebase, for the most intricate part of the review.

## Fix

In order of what each would save:

1. Keep each flow's pages in the repo, so a checkout with no kept run chooses its flows in seconds, as CI could, and the record is the branch's own (`ci-speed.md`, "Each flow's pages, kept in the repo").
2. Take out the carrying of main's frames between trees, leaving the store a plain cache by tree: main then runs a flow once for each commit of main that a review needs it at.
3. Have CI picture main on each push to it and keep the frames as an artifact, for a review to fetch. First compare one run of CI's with one made locally: fonts and the machine may make the pictures differ.
4. Show the review as it fills: open the page at once, and add this branch's side as it arrives.
5. Place a migration by the tables each flow uses, measured rather than read from the code. Each flow has a database of its own, so before it's dropped, `pg_stat_user_tables` in it says which tables the flow read or wrote, views' and functions' tables included; kept beside `opened`, a migration then reruns the flows that used what it alters, and every flow only for a collation or anything it can't place. Postgres keeps a connection's counts for up to a second or so before they show (https://www.postgresql.org/docs/current/monitoring-stats.html), so check none is missed before trusting it.
6. An audit of the map that can be run again, after a change to how the site is built (a new Next, another bundler): the check below was made with scripts that weren't kept.

## Placing a migration by the code that names its tables

Tried in November 2026 (#402, closed): a migration's statements were read for the tables they alter, and a flow reran when a file it reaches named one. On main's last 30 migrations it would have rerun every desktop flow for 15, 70 to 85% of them for 11, and about half for 4, for 600 lines of reading SQL. The import graph is too coarse for it: `tests/storyboard/fixtures.ts` names `errors_seen` and `scripts/fresh-database.mjs` adds the test MPs, and every flow reaches both, and the server code querying `mailings` is reached by about two thirds of flows. Moving the test MPs into a seeding file of their own would narrow a few migrations more, but a migration that broke adding them would then fail every flow unseen. Measuring the tables each flow uses (Fix, 3) needs neither.

## How the map was checked

On 12 November 2026, against what runs. Each of the 280 desktop flows was run alone, on a warm server, with the server's precise coverage taken before and after it, and Next's prefetches answered with nothing. Every position of the build's source maps inside a function that ran was taken as its source file having run in that flow: 19,221 pairs of a flow and a file. Each file was in what the map says the flow reaches, from what the flow recorded as opened in that same run. Taking the hand-overs to `lib/server/problems.server.ts` back out of the map made the check fail on the two files they stand for, so it could have failed.

What that check found on the way, each now in the map or the recording:

- a flow's own request follows redirects without the browser's events, so the fixture server keeps every request;
- two flows start a second browser, whose requests weren't recorded;
- `run-store.server.ts` and `instrumentation.ts` hand code to `problems.server.ts` without an import;
- `next.config.ts` and `proxy.ts` import files no page does;
- files read by name or by listing a folder: fonts, a stand-in picture, the sitemap's walk of `app/`.

Then, by its pictures:

- A review with Next's prefetches answered with nothing pictured all 2,182 frames as one without did, so a page that's prefetched and never opened changes nothing a flow shows.
- Five planted changes, to a staff table, two stylesheets, a staff page's heading and the staff copy, reviewed from the store's frames: 486 flows ran and 80 were carried, and every frame was as a run of all 566 pictured it.
- With the map blinded to the staff copy on purpose and a label on every staff page changed, the review reached no flow, three of its six spot checks looked different, and it ran every flow.

The comparisons found one frame that differed between runs of the same code, the march's sticky header on the phone, now fixed (`tests/storyboard/frame.ts`, `repaintSticky`).

Following the flows' runs by coverage to choose them, in place of imports, picked a little fewer (45% of the time against 47%), but needs a run of one flow at a time. Not worth it.

## Hits

- 2026-11-12: three full reviews in a row on one branch, five minutes each with the build, as each turned up one failing phone flow and the fix to a shared piece (the bubble) needed every flow run again; the changes after the first touched four files, ~20 min waiting
- 2026-11-16: the gate's storyboard in a new sandbox had no frames to carry, so it ran all 626 branch flows (7 min) and then main's whole suite, and stopped at its 20-minute limit before comparing; the gate failed for that alone, ~25 min waiting
- 2026-11-12: a full review took 12 minutes, not 5, with the machine busy with other work, and the staff kit's gallery flow (51 frames) passed its 60 seconds; the review after a one-line fix to a flow's step had to run whole again, ~25 min waiting
- 2026-11-14: a rename-only PR (names that say where code runs) added one marker package to `package.json`, and `package.json` reruns every desktop flow
- 2026-11-16: a migration that only widened the CHECKs of `civicrm_updates`, a table no page shows, reran every desktop flow in the gate's review, though the change could reach none
- 2026-11-17: a migration reran all 658 flows on both viewports in the gate's review, beside `npm test`; the load reached 80 on 14 cores, so dozens of unrelated tests timed out at 10 seconds and the review stopped at its 20-minute limit; both had to run again, one at a time, ~35 min. Part of the load: Vitest also ran the tests of two agents' worktrees under `.claude/worktrees/`, which it now leaves out
- 2026-11-23: a one-file CSS change reached 57 flows by main's kept records and 52 by a run of those flows alone: six of the public pages' flows had recorded every public page in the run of every flow, ~10 min finding why two plans differed
