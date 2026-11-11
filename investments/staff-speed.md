# Measure the staff pages' speed

Size: S. Kind: operations.

## Problem

Staff pages and buttons have been reported as slow, and nobody knows where the time goes. Likely causes:

- every action calls `revalidatePath` (about 40 calls across the staff actions), so a button waits for the whole page to render again, and some wait for the whole staff layout;
- dynamic routes with no `loading.tsx` aren't prefetched;
- the database's distance from Netlify's functions.

## Fix

Log a `Server-Timing` header on each staff render and action (https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing) and look at it on production. Then fix what dominates: revalidating only what changed, `useOptimistic` where a click changes one thing (as `PickBox` does), `Suspense` around heavy lists.

## Hits

- 2026-10-23: search on the supporters page was slow
- 2026-10-27: staff buttons were reported to feel unresponsive
- 2026-11-06: "Save filter" and other menus were slow
