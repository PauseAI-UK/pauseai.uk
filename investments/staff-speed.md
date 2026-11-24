# Make the staff pages fewer trips to the database

Size: M. Kind: operations.

## Problem

Staff pages and buttons have been reported as slow. Timed on a fixture build, every staff page renders in under 0.4 seconds when the database is on the same machine, so rendering isn't the cost. Put a delay in front of the database, as production's distance from it does, and the pages slow down by the delay times the number of queries each waits on in turn: at 100 ms a round trip, a supporter's page waits on about 22, a broadcast's 22, the broadcasts list 23, the dashboard 12 and the scheduled jobs 11, so each takes 1.1 to 2.5 seconds. How far production's database is from Netlify's functions hasn't been measured, so the real figure isn't known.

Three things make those chains long:

- The pool keeps at most three connections (`lib/server/db.server.ts`), so a page's independent queries go out three at a time. A supporter's page asks about 20 queries, and they leave in seven or so waves. With a pool of 12, at 100 ms, the supporter's page fell from 2.3 to 0.7 seconds, the broadcasts list from 2.5 to 1.0 and the dashboard from 1.2 to 0.4. That test reused warm connections: in production each function instance opens its own, each costing several round trips, and Netlify Database's connection limit is unknown.
- The broadcasts list works out the audience of every draft and scheduled broadcast on each load (`broadcastsPage` in `lib/broadcasts/pages.server.ts`), so the supporter, preference and campaign queries run once per draft. The fixtures' nine drafts make it nine times; production's count of drafts sets its cost, and on production's number of supporters each of those is a full pass over them.
- A button waits for its page to render again (`revalidatePath`, in 60 places across the staff actions). Adding a note to a supporter took 0.15 seconds with no delay and 1.8 seconds at 100 ms, about as long as loading the page.

A one-off thread's page reads every message whole from Blobs to show its text. That wasn't timed, as no fixture thread reached it.

## Fix

- Measure the round trip on production first: a `Server-Timing` header on each staff render and action (https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing), with the time spent waiting on queries. Without it, none of the numbers above are production's.
- Raise the pool's size to what Netlify Database allows each function, and see whether its pooled connection string is available.
- Count each draft's audience in one query for the whole list, or only when the draft's page is opened.
- Join the queries that run one after another on the supporter's and broadcast's pages, the dashboard and scheduled jobs.
- Then the buttons: revalidate only what changed, and `useOptimistic` where a click changes one thing (as `PickBox` does).

The timings came from a script that logs in with the dev login and loads each page three times in Firefox, behind a proxy that delays the Postgres socket. It's the tool to rerun after each fix.

## Hits

- 2026-10-23: search on the supporters page was slow
- 2026-10-27: staff buttons were reported to feel unresponsive
- 2026-11-06: "Save filter" and other menus were slow
- 2026-11-11: a one-off thread's page and a politician's page were slow
- 2026-11-24: timing every staff page took a script in `tmp/` to log in, a delaying proxy for Postgres, and a hand-patched build to try a larger pool, ~1 hour
