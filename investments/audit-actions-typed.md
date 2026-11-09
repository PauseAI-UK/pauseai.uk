# Typed audit actions

Size: M. Kind: architecture.

## Problem

`logChange(actor, action: string, details: object)` takes any string, from about 45 places. The audit log's detail view, `AuditDetail.tsx`, switches over the 23 strings it knows. A typo, or a new action with nothing to show it, isn't caught.

## Fix

An `AuditEvent` union, each action with its own details type, and a `Record` of renderers keyed by action, so the compiler finds a missing one.

## Hits

- 2026-10-01 to 2026-11-07 (x31): commits added or changed `logChange` calls, each with a string and details the detail view must match by hand
