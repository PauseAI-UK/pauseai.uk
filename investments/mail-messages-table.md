# One table for kept mail

Size: L. Kind: architecture.

## Problem

`letter_replies` and `one_off_messages` share about 12 identical columns (account, Gmail ids, from, when, blob key, size), and `politician-correspondence.ts` queries each and merges them in TypeScript. `unmatched_mail` and `old_letters_mail` are further variants.

## Fix

One `mail_messages` table, linked to a letter or a thread. It's worth it only when a third use appears. First work out what it means for erasure (`one_off_erased`).

## Hits

None yet.
