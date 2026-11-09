# Row types from the schema

Size: M. Kind: architecture.

## Problem

Every query's result type is written by hand: 459 `query<...>()` calls and about 230 `AS "camelCase"` aliases. Nothing ties them to the schema, so a changed column is found at runtime, or not at all. Timestamps were typed `string` in places where node-postgres gives a `Date`.

## Fix

Generate table and enum types from the template database with kanel (https://github.com/kristiandupont/kanel), or type each query from its SQL with pgtyped (https://pgtyped.dev). Status unions come from the CHECK constraints, which makes `check-constraint-sync.md` the cheap first half.

## Hits

None yet.
