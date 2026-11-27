# PauseCon 2027: sign-up, accommodation and event pages

This plan is a draft. The choices still to make are marked O, so they
can be answered by ID.

## What PauseCon is

PauseCon is a gathering of several days in London, about a month
before the march, from Saturday 27 February to Tuesday 2 March 2027:

- Saturday 27 February: canvassing, and training for it.
- Sunday 28 February: a more typical conference, with talks during the
  day.
- Sunday 28 February, in the evening: a big public speaker event,
  likely in a bigger venue away from the rest of the conference.
- Monday 1 March: putting up posters.
- Tuesday 2 March: the lobbying day in Parliament
  (`plans/parliament-lobbying.md`).

Around 300 people are expected at PauseCon, and the lobbying day is
aiming for 500 to 1,000. People need about two months' notice, so
sign-ups should open by the end of December.

## Signing up

Each of the five parts is its own Luma event, so that people browsing
Luma find them. Anyone can RSVP straight on Luma, and the Luma import
brings them into the site as it does for every event. Each Luma event's
description links to the PauseCon page for anyone who needs a bed.

The PauseCon page is our own, on the site, and the PauseCon domain
redirects to it. Its form is bespoke, as the march forms are
(`app/(march)/demonstrations/`): its own page, fields and server
route, calling the same shared pieces underneath (`addLumaGuest()`,
`addFormEntry()` and `form_entry_luma`). We build it as a very simple,
plain mockup, and our designer then has an agent give it its real
design. The form asks for:

- name, email, phone and postcode;
- which of the five parts they're coming to, as tick boxes;
- whether they want accommodation, and if so, the questions staff need
  in order to approve it, such as what they've done with PauseAI
  before;
- if they tick the lobbying day, its own questions.

When they send it, the site registers them on the Luma event for each
part they ticked, so Luma sends its usual confirmation and reminder.
The postcode goes in `form_entries`' own column, and the answers to the
accommodation questions go on the accommodation request (below), so
the form needs nowhere else to keep answers.

Two shared pieces change, and any later form gets both:

- `form_entry_luma` keeps one event per form entry, and a PauseCon
  entry registers someone for up to five, so it takes a row per entry
  and event.
- `addLumaGuest()` sends answers to the event's registration
  questions, such as the lobbying day's postcode, as well as name and
  email (`plans/parliament-lobbying.md`, "Signing up").

## Accommodation

Accommodation isn't a Luma event. It lives only on the site, and it's
the only thing that needs approval.

Someone who asks for it is told it isn't approved yet, and that we'll
get back to them. People are expected to come to two or three of the
parts to get a bed, but the form doesn't enforce it: staff decide, as
there will be exceptions, such as a speaker. The main things staff go
on are whether the person has volunteered with PauseAI before, and
whether they know what PauseAI is and what they're applying for.

Only once someone is approved do we ask which nights they're staying,
and the rest of the accommodation's questions. Their approval email
links to a second form, with a link that's theirs alone, so it knows
who they are. Asking in two steps spares people who aren't approved
from filling in the details, and spares us from keeping them.

O1. Approving people we already know. Someone with a record of
volunteering on the site (a past event, a letter to their MP, a march)
could be approved automatically, or shown to staff with that record
beside their request. Showing it to staff is safer to begin with.

The hotel assigns the rooms. We give it lists of names for each night.

### What it belongs to

Accommodation belongs to PauseCon as a whole, not to one of its five
Luma events, and nothing on the site holds PauseCon as one thing today.

O15. A tag on the five Luma events, such as "PauseCon 2027", which the
staff events list can already group by. Accommodation belongs to the
tag. It's cheap, but if someone renames or removes the tag in Luma,
the requests lose their home, and the gathering is worked out from
tags each time rather than held anywhere.

O16. A small table of gatherings. PauseCon 2027 is one row, with its
five Luma events tied to it. Requests belong to the gathering, and its
staff page shows the five events together, with the accommodation
lists on it, under Events in the sidebar rather than an entry of its
own. The saved filter for "anyone going to any part of PauseCon" could
become the gathering's own filter.

I recommend O16.

### Where requests are kept, and how the questions can change

Whoever runs PauseCon will want to change what the form asks, and how
it says it, often and at short notice. So the choice is mostly about
how cheap a change is.

O17. On the site, a column for each question. Simple to read, but
every new or changed question needs a migration and a deploy, and old
answers don't fit a reworded question. Too rigid for this.

O18. On the site, a fixed core and the rest as questions and answers.
The core is what the site acts on: who, which gathering, its status
(waiting, approved or declined), who decided and when, the nights, and
a note for staff. The vetting questions and the second form's are
kept as pairs of a question, in the words it was asked, and its
answer. All the form's wording is in one copy file. Changing a
question is a small PR, with no migration, that an agent can make in
minutes and the organiser can check on the deploy preview, and old
answers still read under the question they were asked.

O19. On the site, with questions staff edit. As O18, but staff add,
reword and remove the questions on the staff site, and the form shows
them as they stand. Changes need no PR at all, but it's the most work:
an editor for questions, and a form that builds itself from them.
O18 can grow into it if the PRs turn out too slow.

O20. The site keeps the core, and an outside form tool, such as
Fillout or Tally, asks the questions. The organiser edits that form
whenever they like. The site's form, and the approval email, link to
it with the person's ID, and its answers come to the site one way, by
webhook, shown beside the request. Changes are free and instant, but
the answers live in two places, and the webhook is one more thing to
keep working, much like last time's chain, though only one way.

O4. Airtable for all of it. Staff run accommodation in Airtable from
the start, changing it as they please. The site then knows nothing of
it, so the broadcasts can't tell who is approved, and the reminders
and the hotel list are done in Airtable too.

I recommend O18, and O19 if it's needed later.

### The hotel's list

With the requests on the site (O17 to O20), the list comes from the supporters
list's CSV download, which exists already: staff filter by
"accommodation approved" and a night, and download. The download gains
columns for the nights. The site never reads a sheet back, so nothing
can fall out of step.

## Staff pages

Events have a list on the staff site (`/staff/events`) but no page
each. Each event gets a page of its own, showing who's going, with
their answers where they used our form, and a button to email the
people going, which opens a new broadcast with the event's filter set.

Accommodation has two lists of its own, on PauseCon's page (O16):
requests waiting for a decision, and people approved, with their
nights.

Emailing everyone going to any of several events already works: the
supporters list's event filter takes more than one event, and a saved
filter can keep "anyone going to any part of PauseCon".

## Emails

The broadcasts already have conditional blocks for "going to this
event", so one email to everyone at PauseCon can tell those not going
to Sunday about Sunday, and so on. Luma sends its own reminder for each
event. The broadcasts need three more conditions, and the same as
filters on the supporters list:

- has asked for accommodation;
- their request is waiting, approved or declined;
- approved but hasn't yet given their nights.

## Personal data

The plan collects the parts someone is coming to, the nights they're
staying, their answers to the approval questions, and staff's decision.
Before anything is built, this section will say what each does to
`docs/data-protection.md`, to the privacy policy and to erasure, and
how long it's kept after PauseCon.

The site doesn't ask about dietary or access needs. Lunch on Saturday,
Sunday and Monday is for whoever has signed up for that part, so the
count of those going is all the caterers need.
