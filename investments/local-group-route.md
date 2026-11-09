# One route for local groups

Size: S. Kind: small fix.

## Problem

Six folders in `app/(site)/` (`london/`, `leicester/`, `manchester/`, `oxford/`, `scotland/`, `west-of-england/`) each hold the same few lines.

## Fix

A `[group]` route with `generateStaticParams`. Check first that the other top-level static routes still take precedence (`node_modules/next/dist/docs/`).

## Hits

None yet.
