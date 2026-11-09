# Coverage only for code that ships

Size: S. Kind: small fix.

## Problem

`tests/fixtures/**`, the fakes in `lib/server/fixtures/` and the gallery are under the 100% coverage gate though they never run on the live site, so fixtures have tests of their own (`lib/server/fixtures/failing-services.test.ts`) and the gallery's examples have 889 lines of browser tests.

## Fix

Take `tests/fixtures/**`, `lib/server/fixtures/**` and `app/(tools)/gallery/**` out of `coverage.include` in `vitest.config.mts`, and delete the tests that existed only to cover them. The gallery check in `tests/checks/` still makes every component have an example.

## Hits

None yet.
