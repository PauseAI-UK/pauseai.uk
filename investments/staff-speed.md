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
- 2026-11-11: a one-off thread's page and a politician's page were slow: the same loaders ran several times a page, one after another, and a thread's page reads every message whole from Blobs to show its text
- 2026-11-18: a broadcast draft's Consent buttons felt clunky. Filled to about 27,000 supporters (34,000 email consents), its page took 1.1s to build, 850ms of it two queries one after the other that work out consents from the views (`email_permissions`, `contact_permissions`): the supporters list's Consent filter, then `permissionsFor` for the 12,000 it found. The rest took under 35ms each. Both are priced at about 2.5 million, far over `jit_above_cost`
