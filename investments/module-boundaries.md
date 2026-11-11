# Modules by domain, without cycles

Size: M. Kind: architecture.

## Problem

`lib/server/` is one folder of about 170 files, flat but for the fixtures and the outside services, and each domain is split between it and `lib/` by whether code is server-only, not by what it's about: mailings are six files in each, letters seven and five, politicians four and three. Ignoring type imports, nine files form an import cycle through the email transport: `send()`, the bottom layer, also owns `unblock()`, which calls back into the relays (`resendAfterFix`); `email` and `notifications` import each other; and `letter-sending`, `relays` and `held-replies` form a loop. `gmail-reading` and `letters-inbox-reading` import each other too. About 40 server files import the staff UI's copy.

## Fix

First (S), break the cycle: move `unblock()` into `delivery-problems.ts`, or pass the resend in as a hook, and have notifications use a lower-level send. Add ESLint's `import/no-cycle` (https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-cycle.md). Then move one domain at a time into its own folder, its pure and server files together: email transport, Gmail, letters, mailings, one-off emails, politicians, supporters, events, jobs, staff. The ESLint layer rules extend to say which domain may import which.

## Hits

None yet.
