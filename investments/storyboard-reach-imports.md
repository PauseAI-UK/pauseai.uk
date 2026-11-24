# Imports that make a small change picture every flow

Size: M. Kind: small fixes.

## Problem

A storyboard review pictures the flows that a branch's changed files reach through imports (`docs/testing.md`, "Which flows a review runs"). A few imports carry far more than the page needs, so a file most pages have no use for counts as part of them all, and a change to it runs most flows. `npm run reach` lists the files that reach most. The counts here are of the 355 desktop flows on 24 November 2026, and each chain was traced through the import map.

**Every page:**

- **The footer imports the QR tool's library.** `components/layout/FooterQr.tsx` takes one small helper, `displayLink()`, from `lib/collateral/qrCaption.ts`, which also measures captions and loads their fonts, and it draws its code with `lib/collateral/qrShape.ts`, which brings the design studio's themes and contrast. The footer is on every page, so seven files of `lib/collateral/`, and everything they import, reach all 355 flows. `lib/ask-server.ts`, the browser's fetch helper, reaches every flow only this way: the caption module fetches its fonts through it.

**Most pages with a form, 250 flows:**

- **The form kit's inputs import the date picker.** `components/ui/Controls.tsx` holds the text input, which nearly every form uses, and `DateRange`, for which it imports `components/ui/DatePicker.tsx` with its calendar and its copy. So a change to the date picker pictures every page with a text box, the staff login among them.

**Nearly every staff page, 230 to 290 flows:**

- **The staff lists' shared files import the campaigns.** `lib/staff-search.ts`, `lib/staff-list-filters.ts` and `lib/staff-forms.ts`, which every staff list and form is made with, each take something small from `lib/email-your-mp.ts` or `lib/content/email-your-mp.ts`. Those two hold the campaigns and also the Email your MP form's copy, its letter and its types. So 33 of the 38 staff pages reach them, and rewording the public form, or adding a type for it, pictures most staff flows.
- **The march's address is in a file the campaigns import.** `lib/content/redirect-addresses.ts` holds the march's path and the first campaign's slug, for `next.config.ts`'s redirects. `lib/content/email-your-mp.ts` imports it for the slug, and most staff pages import that (above). So changing where `/march` leads reached 305 of 356 flows.
- **Saved filters import every list's server code.** `lib/server/stored-filters.server.ts` checks a saved filter against the choices of whichever list it's for, so it imports the events', politicians', supporters' and audit log's server modules. Every page with saved filters reaches all of them through `app/(staff)/staff/saved-filter-actions.ts`. The audit log's page reaches the email-sending layer this way, by the events list's module.
- **Reading a record reaches everything that sends an alert about it.** `lib/email/notifications.server.ts` imports the email sender, both providers' bindings and the MIME reader. The modules that keep errors, job runs and Gmail accounts import it to tell staff, and the pages that only list those records import the same modules. So the Errors page, the jobs' pages and the dashboard reach the whole sending layer: 29 of the 38 staff pages do.
- **One module answers for every outside service in a fixture build.** `lib/server/outside-services/outside-fetch.server.ts` imports `lib/server/fixtures/outside-services.ts`, which holds every service's fake and its data. A change to one fake, such as Stripe's sessions, pictures 288 flows, most of which never call that service.
- **Every binding's problems are in one copy file.** `lib/server/copy.ts` holds the sentences for what goes wrong in each outside service and in the server's own code, so rewording one pictures 290 flows.

Nothing says which of a branch's files is the one that reaches most. `npm run storyboard -- --plan` says how many flows and how many files, and `npm run reach` lists every file, not the branch's.

## Fix

Each is a refactor of its own, smallest first. Add to the list as more are found.

1. Move `displayLink()` beside `normaliseUrl()`, which it's built on, in `lib/collateral/qr.ts`, or to a file of its own, so the footer no longer imports the caption module. Then see what of `qrShape.ts` the footer's code needs, and whether its themes can stay with the studio.
2. Move `DateRange` out of `Controls.tsx`, beside `DatePicker`, so a text input doesn't import the calendar.
3. Split the campaigns, as data with the helpers that find one, from the Email your MP form's copy and code, so the staff pages import only the campaigns.
4. Have `--plan` name the changed files that reach the most flows, or give `npm run reach` the branch's files alone.
5. Split what reads errors, job runs and Gmail accounts from what records them and tells staff, so a page that lists them doesn't import the email sender.
6. Give each list its own check of a saved filter, registered with the saved filters' code, so that one list's page doesn't import the others' server modules.
7. Have each binding's fake loaded with that binding, not all from `outside-fetch.server.ts`, and each binding's problems declared beside it.
8. Give the march's address and the first campaign's slug a file each, so a change to one redirect doesn't reach the pages that import the other.

## Hits

- 2026-11-24: the march pages' branch pictured all 763 flows, twice over with main's. Its change is wide, but `--plan` didn't say which files made it so: a comment in `components/layout/SiteFrame.tsx` reached every flow by itself, and the march's new address reached 305 through `lib/content/redirect-addresses.ts`, ~20 min to find with `npm run reach -- 100000` and a list of the branch's files
- 2026-11-24: a branch that changed nothing anyone sees pictured all 713 flows, on main and on the branch, as it added `lib/ask-server.ts` and the caption module imported it, ~26 min waiting
- 2026-11-24: wrote a script in `tmp/` to count the pages that import each changed file, as `--plan` said only that every flow was reached, and its count named the wrong files; `npm run reach` named the right one, ~15 min
- 2026-11-24: wrote two more scripts in `tmp/`, for the chain of imports from a page to a file and for which staff pages reach a file, to find the imports above, ~20 min
