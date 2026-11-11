# Fixtures checked against the real services

Size: M. Kind: operations.

## Problem

Luma, Airtable, Parliament, Postmark, Gmail and Stripe are faked from canned responses in `lib/server/fixtures/`. Nothing checks those fixtures against the live APIs, so if a service changes its format every test still passes, and production breaks.

## Fix

A scheduled GitHub Action, not part of the gate, that calls each service's read-only endpoints through `lib/server/outside-services/` and checks the responses' shape against the fixtures' types. The repo is public, so it prints only pass or fail, never a response.

## Hits

None yet.
