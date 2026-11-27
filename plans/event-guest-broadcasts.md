# Broadcasts to an event's guests

This plan is a draft. The choices still to make are marked O, so they
can be answered by ID.

## Why

Today every broadcast goes out under a consent list, so the button on an
event's page reaches only the guests on PauseAI UK Updates including
Luma: three of the five coming to the fixture protest. To run an event,
staff need to email everyone coming, and mail-merge into it what's
theirs alone, such as the link to write to their MP from
`plans/parliament-lobbying.md` (#496).

So a broadcast gets a second kind of audience: the guests of one or more
events, whatever lists they're on, about those events.

## Who gets it

- **In:** everyone on the chosen events' guest lists on Luma who hasn't
  declined, as the supporters list's Event filter counts them, by the
  email they gave Luma. One email can go to the guests of several
  events, such as every part of PauseCon; someone at three parts gets
  one copy.
- **Out:** a guest who declined, or whom Luma no longer lists; anyone
  who opted out of everything; a blocked or bounced address; anyone who
  unsubscribed from emails about one of the chosen events (below).
- The supporters list's other filters can narrow it, as now: "has a
  postcode", near a place, by MP.
- How each guest stands (going, waitlisted) is a condition in the email,
  as "going to this event" is already, not a choice of who it goes to.

O1. "No bulk emails". Someone who chose it gets no newsletters. Should
they still get emails about an event they signed up for? Leaning yes:
it's about something they asked to come to.

Email only. WhatsApp needs a person's opt-in before a business messages
them, and registering on Luma isn't one.

## Consent

No new consent. These emails rest on legitimate interests, running an
event the person registered for, which `docs/data-protection.md` already
gives as a purpose of Luma registrations. Under PECR, a message purely
about that event (times, the venue, what to bring, a change) isn't
direct marketing, so needs no consent.

The ICO counts promoting a campaigning organisation's aims as direct
marketing, which does. Asking a lobbying day's guests to write to their
MP for a meeting on the day is arguably part of the event they signed
up for; asking PauseCon's canvassers to write about a bill isn't. The
writer says so beside the audience, for staff to judge each email.

O2. Whether that line is right is the organisation's call, not the
code's. Someone should check it against the ICO's guidance before the
first send.

## What's stored

### Which events a broadcast's guests come from

A new table, `broadcast_events`. One row is one event whose guests a
broadcast goes to.

| mailing_id | event_id                |
| ---------- | ----------------------- |
| 41         | evt-pausecon-canvassing |
| 41         | evt-pausecon-talks      |
| 41         | evt-pausecon-lobbying   |

`mailings.audience` gains a third value, `guests`, beside `politicians`
and `supporters`. A guests broadcast has no `topic`: what it's about is
its events. `mailings_topic_for_supporters` becomes "a supporters
broadcast has a topic, and only one", and a check says a guests
broadcast has at least one row here before it's scheduled.

### Unsubscribing from an event's emails

`opt_outs` gains a list, `event`, and a column, `event_id`, set exactly
when the list is `event`. One row is someone who asked for no more
emails about that event.

| address              | list  | event_id              | source | unsubscribed_at  |
| -------------------- | ----- | --------------------- | ------ | ---------------- |
| jane.smith@example.com | event | evt-pausecon-lobbying | link   | 2027-02-10 09:12 |

It's an opt-out like the others, in the same table, so the pages that
list someone's opt-outs, erasure and resubscribing all treat it as they
treat the rest. Its `source` is one they already have: `link`,
`list-unsubscribe`, `reply` or `staff`.

### Not stored

- Who a guests broadcast reaches: worked out from the guest lists when
  it sends, as a supporters broadcast's is from its filter.
- A guest's status: Luma's, as the import keeps it.

## What people see

- **An event's page:** the button reads "Email the N guests", counting
  everyone it would reach, and makes a guests broadcast to that event.
- **The writer:** the To step has "Guests of events" beside the lists.
  Choosing it hides the lists and offers the events, the event's page's
  chosen already, with the note on what these emails may be about. The
  count and "Change who" work as now.
- **The email:** its footer says why it came ("You're getting this
  because you registered for PauseCon: canvassing"), and its unsubscribe
  link, one click as Gmail and Yahoo require, stops emails about those
  events alone.
- **The page the link opens:** says they'll get no more emails about
  those events, and offers opting out of everything.
- **A reply saying "unsubscribe":** does what the link does, and staff
  see it as they do now.
- **A supporter's page:** lists an event's opt-out with the others.
- **The broadcasts list:** shows a guests broadcast's events where a
  supporters one shows its list.

## Merge fields

Nothing here is special to guests: a merge field works in any broadcast.
The MP's name and the link to write to them on a campaign come from
`plans/parliament-lobbying.md`, built there.

## Personal data

- `docs/data-protection.md`: Luma registrations gain a use, emailing
  guests about events they registered for; opt-outs gain the per-event
  kind, kept as the others are.
- The privacy policy: a line saying we email people who register for an
  event about that event, and that each email's link stops them.
- Erasure: keeps an event's opt-out, as it keeps every other: it exists
  to stop us emailing the address. The rows in `broadcast_events` are
  about events, not people, so erasure has nothing to do there.

## Order of work

1. The migration, settled before the first push.
2. Recipients and sending: who a guests broadcast reaches, the footer,
   the unsubscribe link and its page, replies.
3. The writer's To step, the event page's button, the broadcasts list.
4. The docs, the privacy policy's draft line for approval, and a flow
   for each thing a person sees.
