# Imports that make a small change picture many flows

Size: M. Kind: small fixes.

## Problem

A storyboard review pictures the flows that a branch's changed files reach through imports (`docs/testing.md`, "Which flows a review runs"). A few imports still carry far more than the page needs, so a file most pages have no use for counts as part of them all. `npm run reach` lists the files that reach most, and `npm run reach -- --branch` the branch's own. The counts here are of the 356 desktop flows on 24 November 2026.

- **The scheduled jobs' route imports every job.** `app/api/cron/[job]/route.ts` runs a job through `lib/jobs/jobs.server.ts`, which imports each job's module, and through them every binding and the sending layer. About 60 flows run an import as part of their story, so each of those reaches every job: it's most of why `lib/server/copy.ts`, the fakes and `lib/content/email-your-mp.ts` still reach 160 to 280 flows. The map can't tell which job a request to `/api/cron/<job>` ran, as the route is one file.
- **Every binding's problems are in one copy file.** `lib/server/copy.ts` declares the problems of every outside service's binding and of the server's routes, so rewording one reaches every flow that calls any service: 280. Declaring each binding's beside it would make two declarations under the feature "server", which `tests/checks/declared-problems.test.ts` refuses, as two features of one name could make one code twice; a new feature name for each changes the problems' codes, which makes each a new problem to every run that has reported it.
- **The broadcasts' and mailings' pages import what sends.** `lib/broadcasts/pages.server.ts` reaches `lib/broadcasts/drafts.server.ts`, which reads drafts and also tells staff, and `lib/mailings/pages.server.ts` reaches the email sender through `lib/mailings/channels.server.ts`. So the supporters' and politicians' lists reach the sending layer.
- **The dashboard finds a campaign by its ask in the Email your MP form's module.** `lib/dashboard/politicians.server.ts` takes `campaignForAsk()` from `lib/email-your-mp.ts`, so rewording the form pictures the dashboard's flows.
- **The events' words are one file that the import and every list read.** `lib/events/copy.ts` holds the Luma import's problems and emails beside the events list's filter words, and the saved filters (`lib/server/stored-filters.server.ts`) read those words for every staff list. So rewording an import problem pictures every list's flows: 221.
- **The footer's QR code reaches the QR tool's layout.** `lib/collateral/qr.ts` holds `qrPlan()`, which imports `lib/collateral/formats.ts`, so every page reaches the design studio's formats. Both are small and rarely change.

## Fix

Each is a refactor of its own.

1. Have the map know which job a request to `/api/cron/<job>` runs, or give each job a route of its own, so a flow that runs one import reaches only that job.
2. Let one feature's problems be declared in several files, the check refusing a code declared twice instead of a feature, then declare each binding's problems beside it.
3. Split what reads the broadcasts' drafts from what tells staff about them, and what the mailings' pages read of the channels from what sends.
4. Put each campaign's ask in `lib/content/campaigns.ts`, beside its name, so `campaignForAsk()` can be there too.
5. Move `qrPlan()` and its limits out of `lib/collateral/qr.ts`, beside the templates that place codes.
6. Give the events list's filter words a file of their own, which the saved filters read, apart from the import's problems and emails.

## Hits

- 2026-11-27: an event page's first review pictured 591 flows, mostly through `lib/events/copy.ts` and `lib/events/list.ts`; split the list's terms (`list-terms.ts`) and its page's loader (`list-page.server.ts`) out, ~30 min
