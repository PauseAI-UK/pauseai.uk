# Resending lost copies

Postmark can accept a broadcast's emails and then never deliver them or say anything more about them. The site marks those copies "lost", and the broadcast stops (`LOST` in `lib/broadcasts/drafts.server.ts`). This plan lets staff send lost copies again, by Gmail or Postmark, and keeps the broadcast's page accurate afterwards.

## What's in the way

- **The channel belongs to the broadcast, not the copy.** "Lost" checks the broadcast's `send_by = 'postmark'`. Switching a stopped broadcast to Gmail would make its lost copies stop counting as lost, and would show the copies Postmark delivered as sent by Gmail.
- **A copy has one `provider_message_id`.** A resend would overwrite the Postmark ID, which is the evidence for asking Postmark what happened.
- **Resume doesn't send lost copies again.** That's on purpose, and it stays so: resending them needs a choice of channel.

## What to build

1. **Each copy keeps its own channel.** A migration adds `broadcast_messages.send_by`, filled from each copy's broadcast. "Lost", the copy's label (`pages.server.ts`) and the sending read the copy's own channel. Old Postmark copies still match Postmark's delivery and bounce webhooks.
2. **Each send is an event.** A "sent" event in `broadcast_message_events` records the channel and the provider's message ID. So a copy's history reads: sent by Postmark, lost, sent by Gmail, delivered.
3. **A "Send the lost copies again" button** on a broadcast that stopped because copies were lost. It asks for Gmail or Postmark, then says how many copies there are and about how long they'll take at that channel's pace (`EMAIL_CHANNELS` in `lib/broadcasts/channels.server.ts`). It schedules the lost copies again by that channel and sets the broadcast back to sending. The copies it hadn't tried yet go by the same channel.
4. **Gmail's daily limit works as it does now.** When Gmail refuses, the broadcast stops with "limit", and staff press Resume the next day. hello@ sends about 1,800 a day.

All new copy is ⁂ placeholders. Tests and a storyboard flow: a broadcast loses copies, staff send them again by Gmail, and the copies' history shows both sends.

## Personal data

None new. The change records the channel and message ID of each send, as it already does for the last one. `docs/data-protection.md`, the privacy policy and erasure are unchanged.

## Open questions

1. Is the channel chosen each time copies are resent, or does the button just switch the broadcast to Gmail?
2. A separate button, or should Resume offer to include lost copies?
3. Is the two days Gmail takes fast enough, when a broadcast is for an event a few days away?
