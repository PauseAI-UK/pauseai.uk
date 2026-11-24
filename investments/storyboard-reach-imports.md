# Imports that make a small change picture every flow

Size: M. Kind: small fixes.

## Problem

A storyboard review pictures the flows that a branch's changed files reach through imports (`docs/testing.md`, "Which flows a review runs"). A few imports carry far more than the page needs, so a file most pages have no use for counts as part of them all, and a change to it runs every flow. `npm run reach` lists the files that reach most. The ones found so far:

- **The footer imports the QR tool's caption module.** `components/layout/FooterQr.tsx` takes one small helper, `displayLink()`, from `lib/collateral/qrCaption.ts`, which also measures captions and loads their fonts. The footer is on every page, so that module and everything it imports reach all 355 desktop flows. `lib/ask-server.ts`, the browser's fetch helper, reaches every flow only this way: the caption module fetches its fonts through it.
- **The campaigns are in the same files as the Email your MP form.** `lib/content/email-your-mp.ts` holds the campaigns, whose names most staff pages show, and the form's own copy. `lib/email-your-mp.ts` holds the helpers that find a campaign, and the form's letter and its types. Counting imports, 56 of the app's 134 pages and routes reach them, so rewording the form, or adding a type for it, pictures most staff flows.
- **The postcode binding** (`lib/server/outside-services/postcodes.server.ts`) is reached by 28 of those 134.

Nothing says which of a branch's files is the one that reaches most. `npm run storyboard -- --plan` says how many flows and how many files, and `npm run reach` lists every file, not the branch's.

## Fix

Each is a refactor of its own. Add to the list as more are found.

1. Move `displayLink()` beside `normaliseUrl()`, which it's built on, in `lib/collateral/qr.ts`, or to a file of its own, so the footer no longer imports the caption module.
2. Split the campaigns, as data, from the Email your MP form's copy and code, so the staff pages import only the campaigns.
3. Have `--plan` name the changed files that reach the most flows, or give `npm run reach` the branch's files alone.

## Hits

- 2026-11-24: a branch that changed nothing anyone sees pictured all 713 flows, on main and on the branch, as it added `lib/ask-server.ts` and the caption module imported it, ~26 min waiting
- 2026-11-24: wrote a script in `tmp/` to count the pages that import each changed file, as `--plan` said only that every flow was reached, and its count named the wrong files; `npm run reach` named the right one, ~15 min
