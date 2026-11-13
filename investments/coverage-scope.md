# Coverage only for code that ships

Size: S. Kind: small fix.

## Problem

`tests/fixtures/**`, the fakes in `lib/server/fixtures/` and the gallery are under the 100% coverage gate though they never run on the live site. So fixtures have tests of their own (`lib/server/fixtures/failing-services.test.ts`), and the gallery has about 1,000 lines of tests.

## Fix

In `vitest.config.mts`, take `tests/fixtures/**` out of `coverage.include`, add `lib/server/fixtures/**` and `app/(tools)/gallery/**` to `coverage.exclude`, and delete the tests that existed only to cover them. The gallery check in `tests/checks/` still makes every component have an example.

## Hits

- 2026-11-14: wrote tests for the fake WhatsApp (`lib/server/fixtures/whatsapp.test.ts`) and the fake CiviCRM's answer for numbers only to keep them at 100%, ~15 min
