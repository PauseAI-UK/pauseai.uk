# Error reporting

Size: S. Kind: operations.

## Problem

When a Server Action, route handler or page throws in production, nobody is told. The error is in Netlify's function logs, for as long as Netlify keeps them, until someone happens to look. There's no `instrumentation.ts` or `onRequestError`, no `app/global-error.tsx` and no `error.tsx`, and CSP reports also go only to the function logs (`app/api/csp-report/route.ts`).

## Fix

Add `instrumentation.ts` with `onRequestError` (https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation#onrequesterror). Send each error either to Sentry (https://docs.sentry.io/platforms/javascript/guides/nextjs/) or to staff through the site's own notifications, once per error until it's fixed, as store failures are. Add `app/global-error.tsx`, and an `error.tsx` for the staff area.

## Hits

- 2026-10-14: staff login on a deploy preview returned a 500; Francis found it by trying it
- 2026-10-15: sending a letter in production failed the anti-spam check for every sender; Francis found it by trying it
