# One set of states for a copy sent

Size: M. Kind: architecture.

## Problem

A mailing's letters to politicians and a broadcast's copies to supporters are separate models, each with its own statuses, skip reasons, counts, tag words and colours (`copyStatus` in `app/(staff)/staff/_components/BroadcastView.tsx`; a mailing's in its own components and `staffCopy.mailingPages`). Where they mean the same thing (sent, failed and why, bounced and why, an address blocked, stopped before it went) they're written twice, and drift: a broadcast's failure can say why while a mailing's can't.

## Fix

One description of what can become of an email sent (status, why, tone, which count), which both use, each adding its own: a mailing's left office and no address, a broadcast's opt-outs and WhatsApp's states.

## Hits

- 2026-11-13: giving a broadcast's Failed and Bounced tags their reason; a mailing's letters have the same failures and won't say why.
