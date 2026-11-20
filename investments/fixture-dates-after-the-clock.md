# Fixture dates the fixture clock hasn't reached

Size: S. Kind: small fix.

## Problem

A fixture build's clock is fixed (`FIXTURE_NOW`, `lib/server/fixtures/fixture-env.mjs`), and the latest thing a person said about a consent is what holds. So a fixture dated after the clock beats anything a flow does "now": a member whose `joined_date` is later than `FIXTURE_NOW` can't be opted out in the storyboard, by staff, by a link or on the preferences page. The opt-out is recorded and the page still says yes. Nothing checks for it: `lib/server/fixtures/civicrm-contacts.json` still has a contact joined four days after the clock, harmless only because that address is on hold.

## Fix

A test in `tests/checks/` that reads every date in `lib/server/fixtures/*.json` and fails on one later than `FIXTURE_NOW`, but for those meant to be to come, such as the Luma fixture's events, which it lists.

## Hits

- 2026-11-19: a fixture member joined after the clock made "Unsubscribe them" look broken in a build on fixture data; a flow had already worked round it with an UPDATE of its own. About 40 minutes to find
