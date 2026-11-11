# Row types from the schema

Size: M. Kind: architecture.

## Problem

Every query's result type is written by hand: about 500 `query<...>()` calls and about 300 `AS "camelCase"` aliases, tests included. Nothing ties them to the schema, so a changed column is found at runtime, or not at all.

## Fix

Generate table and enum types from the template database with kanel (https://github.com/kristiandupont/kanel), or type each query from its SQL with pgtyped (https://pgtyped.dev). Status unions come from the CHECK constraints, in place of the test that compares each CHECK's list with its TypeScript constant (`netlify/database/check-constraints.test.ts`).

## Hits

None yet.
