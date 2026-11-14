# Pages that import only what they use

Size: M. Kind: architecture.

## Problem

Ignoring type imports, a staff list page reaches 180 to 280 of the repo's files through what it imports. Most of that is Server Action modules imported for a button or two, which import most of the server:

- `app/(staff)/staff/actions.ts` is imported by 14 components across the staff pages. It imports `lib/jobs/jobs.server.ts`, the registry of every scheduled job (147 files), and `lib/erasure/erase.server.ts` (103 files, as erasing someone touches every table).
- `supporters/page.tsx` imports `broadcasts/actions.ts`, and through it all of `lib/mailings/drafts.server.ts`.
- The staff dashboard, where signing in lands, imports 121 files.

So a change to one import job, the sender or the Gmail reader reaches about 130 of the storyboard's 280 desktop flows, and a review that picks flows by what a change reaches (`storyboard-review-speed.md`) reruns most of them. It also makes a page's code hard to read and its bundle hard to reason about, and an import cycle easy to make.

What else makes a change reach many flows has its own file:

- the cycle through the email transport (`module-boundaries.md`);
- the one `staffCopy` object (`copy-beside-features.md`);
- the gallery's shared `staff.client.tsx`, which every staff group imports (`gallery-beside-components.md`).

## Fix

1. A Server Action module per feature, beside its form: running a job in `scheduled-jobs/actions.ts`, erasing in the erase button's. A page imports the actions it has buttons for, and no others.
2. The dashboard's tiles each load their own numbers, so the page imports a tile, not every domain.
3. `npm run reach` lists the files that reach the most, from the map the storyboard keeps of what each flow opens. Work down that list, and it shows whether a change helped.

Do it a module at a time, when next working nearby. Measure each step by how many flows a change to `jobs.server.ts` or `email.server.ts` reaches.

## Hits

- 2026-11-12: a planted change to one staff table reran 36 flows to picture 13 that changed; most of the rest reached it through `actions.ts` and the gallery's shared examples
