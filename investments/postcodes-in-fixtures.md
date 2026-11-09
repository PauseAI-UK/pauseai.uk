# Postcodes.io in fixture builds

Size: S. Kind: operations.

## Problem

Fixture builds should reach no outside service, but the storyboard's server has logged failed calls to Postcodes.io. Any flow that depends on such a call fails whenever Postcodes.io is down.

## Fix

Find what makes the call, and fake it in fixture mode along with the other outside services.

## Hits

- 2026-11-07 (x2): `[WebServer] Postcodes.io failed … returned 503` in storyboard shards of CI runs 42399134220 and 42374268026
