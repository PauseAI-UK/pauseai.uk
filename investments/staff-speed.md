# Make the staff pages fewer trips to the database

Size: M. Kind: operations.

## Problem

Staff pages and buttons have been reported as slow. Timed on a fixture build, every staff page renders in under 0.4 seconds when the database is on the same machine, so rendering isn't the cost. Put a delay in front of the database, as production's distance from it does, and a page slows by the delay times the number of queries it waits on in turn. How far production's database is from Netlify's functions hasn't been measured; each staff request now logs its time, its queries and its wait on the database (`lib/server/request-timing.server.ts`), so Netlify's function logs say.

What's left making those chains long:

- A button waits for its page to render again (`revalidatePath`, in 60 places across the staff actions). Adding a note to a supporter took 0.15 seconds with no delay and 1.8 seconds at 100 ms a round trip, about as long as loading the page.
- Some pages ask queries that wait on others' answers: a supporter's page and a broadcast's take several rounds even with enough connections.

A one-off thread's page reads every message whole from Blobs to show its text. That wasn't timed, as no fixture thread reached it.

## Fix

- Read the function logs' timing lines for the staff pages people call slow, and fix what they show.
- Join the queries that run one after another on the supporter's and broadcast's pages.
- Then the buttons: revalidate only what changed, and `useOptimistic` where a click changes one thing (as `PickBox` does).

## Hits

- 2026-10-23: search on the supporters page was slow
- 2026-10-27: staff buttons were reported to feel unresponsive
- 2026-11-06: "Save filter" and other menus were slow
- 2026-11-11: a one-off thread's page and a politician's page were slow
- 2026-11-24: timing every staff page took a script in `tmp/` to log in, a delaying proxy for Postgres, and a hand-patched build to try a larger pool, ~1 hour
