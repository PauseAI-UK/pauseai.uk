# A helper for the supporters permission

Size: S. Kind: small fix.

## Problem

The UI checks `permissions.includes("supporters")` by hand in 9 places, while the data functions take the permissions and decide themselves.

## Fix

A `canSeeSupporters(staff)` helper beside `requireStaff()`, used everywhere the UI checks.

## Hits

None yet.
