# One pattern for staff actions

Size: M. Kind: architecture.

## Problem

Staff Server Actions report back in five ways:

- return nothing and give up silently when the input doesn't parse (about 20 places across `actions.ts`, `mailings/actions.ts`, `saved-filter-actions.ts` and `broadcast-actions.ts`);
- return a boolean;
- return a typed result;
- redirect with `?notice=` for the page to read;
- take positional arguments and refresh by hand (`saveMailing`).

Pending states are built three ways (`useFormStatus`, `useOptimistic` as a saving flag, `useTransition`). `useActionState`, which the Next.js docs recommend for this (`node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`), isn't used at all. A thrown action ends on the staff pages' error page, in place of the form.

## Fix

- One result type, `{ ok: true, … } | { ok: false, reason }`, with `reason` a key into the feature's copy.
- One `useStaffAction` hook over `useActionState`, which gives the pending flag and the message.
- A check in `tests/checks/` that every staff action returns the result type.

Convert one form at a time, the silent ones first.

## Hits

- 2026-11-06: "Save filter" gave no sign it was working while slow; Francis asked for the standard dimming and spinner
