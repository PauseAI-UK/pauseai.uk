# What's left of one pattern for staff actions

Size: S. Kind: architecture.

## Problem

Every staff Server Action answers one shape, `FormResult` (`lib/form-result.ts`), or redirects, and its form is a `ResultForm` or goes through `useSave` (`docs/code-structure.md`, "Errors"). Three things still sit outside that:

- **A refusal can't carry detail.** It's a reason code and nothing more, so an action that has words of someone else's to pass on answers "done" with a flag: `submitTemplateNow` answers `{ ok: true, taken: false, said }` with WhatsApp's reason, and `scheduleBroadcastNow` `{ ok: true, scheduled: false, said }` (`app/(staff)/staff/_components/broadcasts/actions.ts`). The upload of sign-ups answers `{ ok: true, changed: plan }` for the same reason.
- **A draft's own saves keep a catch of their own.** `save`, `attach` and `detach` in `useDraftWriter` (`mailings/DraftWriter.tsx`) are awaited one after another for the draft's version, and `useSave`'s `run` returns nothing to await.
- **Two forms say a refusal by redirecting with `?notice=`**, the asks' and the accounts', where the rest answer a reason for the form to say in place.

## Fix

- Let a refusal carry what its form needs beside the reason, as `RefusedFields` does for fields (`lib/form-result.ts`), and move the three actions to it.
- Give `useSave` a `run` that can be awaited, or a queue of its own, and move the draft's saves to it.
- Answer the asks' and accounts' refusals as reasons, keeping the redirect for a save that's done.

## Hits

None yet.
