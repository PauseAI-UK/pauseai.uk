# Delete one-off jobs once run

Size: S. Kind: ways of working.

## Problem

One-off jobs stay after they've done their work. The old letters import is one (`docs/domain-concepts.md`): 979 lines of code, 1,070 lines of tests, a 604-line fake mailbox and a 358-line storyboard section. Its test file is the slowest in the suite, 91 seconds, about a tenth of Vitest's time. Four of the twelve scheduled jobs are one-offs.

## Fix

When a one-off job has run in production, delete it with its tests, fixtures and flows, as `docs/testing.md` already says for data-migration tests. A line in the job's opening comment says it's one-off, so it's easy to find.

## Hits

None yet.
