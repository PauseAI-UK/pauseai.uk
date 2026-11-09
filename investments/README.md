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

`npm run investments` lists every item, most hits first, with its size and kind, and writes the list to `investments/ranked.txt`, which isn't committed, each line starting with the item's file name so an editor can open it (`gf` in Vim). The Git hooks write it again after each checkout or merge (`docs/development.md`). There's no list kept by hand: the files are the list.

Hits are a guide, not the answer. A missing tool is hit in every session, so tools pile up hits fast. An architecture item is hit once per feature that runs into it, and each of those hits can cost hours. Operations items get no hits until the day something goes wrong unseen. So weigh hits against size, weigh an architecture item by the changes it would make easy, and an operations item by how bad the failure it prevents would be.

Once a month, add the month's hits (`friction-sweep.md`) and choose what's next. About one PR in five should be one of these, each in its own PR. The PR that finishes an item deletes its file. An architecture item done in steps keeps its file until the last step, with the Fix saying what's left.

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
