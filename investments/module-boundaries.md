# Modules by domain, without cycles

Size: M. Kind: architecture.

## Problem

`lib/server/` is one folder of about 170 files, flat but for the fixtures and the outside services. Each domain is split between it and `lib/` by whether code is server-only, not by what it's about: mailings have six files in each, letters have seven in `lib/server/` and five in `lib/`, and politicians four and three.

About 40 server files import the staff UI's copy.

## Fix

1. Break the import cycles (S): done. `tests/checks/import-cycles.test.ts` keeps them gone.
2. Move one domain at a time into its own folder, with its pure and server files together: email transport, Gmail, letters, mailings, one-off emails, politicians, supporters, events, jobs, staff. The ESLint layer rules extend to say which domain may import which.

## Hits

- 2026-11-12: `email.ts`, `gmail-accounts.ts`, `notifications.ts` and `relays.ts` import each other, so a change to any of them reaches 82 files and most staff flows of the storyboard (`narrow-imports.md`)
