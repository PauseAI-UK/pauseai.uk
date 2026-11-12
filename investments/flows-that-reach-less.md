# Flows that reach less

Size: M. Kind: tools.

## Problem

A storyboard review reruns the flows a change can reach (`docs/testing.md`, "Which flows a review runs"). Some of what a flow reaches comes from how the storyboard itself is built, not from what the flow pictures. Of the 280 desktop flows, on 12 November 2026:

- **Signing in lands on the dashboard.** 137 flows open `/staff` only on their way somewhere else. The dashboard has a tile for every area and reaches 114 files, so a change to any of them reruns all 137.
- **A few helper files serve every area.** `tests/steps.ts` and `tests/luma-webhooks.ts` are reached by 168 flows, `tests/storyboard/letters-inbox-steps.ts` by 134 and `staff-steps.ts` by 120. A change to one helper reruns every flow whose spec imports the file.
- **`tests/routes.ts` lists `app/`, and 162 flows reach it**, most through `staff-steps.ts`. So a page added anywhere reruns them all.
- **Every flow reaches the fake letters inbox and the email viewer.** `fixtures.ts` imports `lib/server/fixtures/letters-inbox.ts` for one function, and `frame.ts` imports `tests/fixtures/email-view.ts`.
- **`next.config.ts` imports the campaigns' and the march's content** for its redirects, and every flow runs the build's settings. So a change to `lib/content/email-your-mp.ts`, `lib/content/march.ts`, `lib/asks.ts` or `lib/controlai-letter.ts` reruns every flow.

The site's side of this is in `narrow-imports.md`, the copy's in `copy-beside-features.md`, the seed data's in `test-data-builders.md`, and the gallery's in `gallery-beside-components.md` and `storyboard-review-speed.md`.

## Fix

Each on its own, measured by `npm run storyboard -- --plan` after a change to the file in question:

1. Sign in straight to where the flow is going: the fixture build's login takes the page to land on. The dashboard is then opened by the flows about it.
2. Helpers by what they drive: a file of steps for each area, so a spec imports only what it uses. `ROUTES` goes only into the specs that walk every route.
3. `fixtures.ts` and `frame.ts` import nothing of the site but small constants: the inbox's clock from a file of its own, the email viewer only by the module that frames an email.
4. `next.config.ts` takes the addresses its redirects need from a small file of their own, which the content imports too.

## Hits

- 2026-11-12: a planted change to one staff table reran 36 flows, of which 13 pictured it; the rest reached it through the dashboard and the gallery
