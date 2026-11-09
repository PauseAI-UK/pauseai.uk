# Alerts when a scheduled job stops

Size: S. Kind: operations.

## Problem

A scheduled job that fails emails staff, but only if it runs far enough to record the failure. A job that stops running altogether (its schedule lost in a deploy, a crash before it records anything, a Netlify outage) sends nothing. The only check of this kind is the backup's, that some import ran in the last 36 hours, while `read-gmail` runs every five minutes. Nothing checks that the site is up, and there's no health route.

## Fix

Each scheduled job pings its own Healthchecks.io check when it finishes (https://healthchecks.io/docs/), as the backup already does. Add an `/api/health` route that queries the database, and an outside uptime monitor on it and on the home page.

## Hits

None yet.
