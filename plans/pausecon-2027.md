# PauseCon 2027: sign-up, accommodation and event pages

This plan is a draft. Its open questions are marked Q, and the choices
still to make are marked O, so they can be answered by ID.

## What PauseCon is

PauseCon is a gathering of several days in London, about a month
before the march, from Saturday 27 February to Tuesday 2 March 2027.
Most of it falls on a weekend, so that people can stay, and the visit
to Parliament is on the Tuesday, as it has to be on a Tuesday or a
Wednesday:

- Saturday 27 February: canvassing, and training for it.
- Sunday 28 February: a more typical conference, with talks during the
  day.
- Sunday 28 February, in the evening: a big speaker event, separate
  from the day's conference.
- Monday 1 March: putting up posters.
- Tuesday 2 March: the lobbying day in Parliament.

There will be one base that everything runs from, ideally somewhere
near food. Around 300 people are expected at PauseCon, and the
lobbying day is aiming for 500 to 1,000. People need about two months'
notice, so sign-ups should open around the end of December.

## What people see

Each of the five parts is its own Luma event, so that people browsing
Luma find the parts of PauseCon as well as the whole. Anyone can RSVP straight on
Luma, and the Luma import brings them into the site as it does for
every event. Each Luma event's description links to the PauseCon page
for anyone who needs a bed for the night.

The PauseCon page is our own, on the site, and the PauseCon domain
redirects to it. Its form works like the march forms
(`app/(march)/demonstrations/`), but it won't look like them. We build
it as a very simple, plain mockup, clearly unfinished, and our designer
then has an agent give it its real design. Its form asks for:

- name, email, phone and postcode;
- which of the five parts they're coming to, as tick boxes;
- whether they want accommodation;
- if they do, the questions staff need in order to approve it, such as
  what they've done with PauseAI before;
- if they tick the lobbying day, its own questions (see
  `plans/parliament-lobbying.md`).

When they send it, the site registers them on the Luma event for each
part they ticked, so Luma sends its usual confirmation and reminder, and
the event shows them as going. This is what the march form does already
with `addLumaGuest()`, one event at a time.

Someone who asks for accommodation is told it isn't approved yet, and
that we'll get back to them. Accommodation is not a Luma event, since
it isn't one. It lives only on the site.

To get a bed, people are expected to come to two or three of the
parts. The form doesn't enforce this: anyone can ask, and staff decide,
since there will be exceptions, such as a speaker.

## Approval

Approval is for accommodation only, for now. A request starts as
waiting. Staff approve or decline it on the site, and the person is
emailed either way. The main things staff go on are whether the person
has volunteered with PauseAI before, and whether they know what
PauseAI is and what they're applying for.

Only once someone is approved do we ask for the details: which nights
they're staying, and the rest of the accommodation's questions. Their
approval email links to a second form for these, with a link that's
theirs alone, so it knows who they are without asking again. Until
they fill it in, the broadcasts can keep reminding them (see "Emails",
below). Asking in two steps spares people who aren't approved from
filling in the details, and spares us from keeping them.

O1. Approving people we already know, without asking them anything.
Someone with a record of volunteering on the site (a past event, a
letter to their MP, a march) could be approved automatically, or shown
to staff first with that record beside their request. Showing it to
staff is safer to begin with, and automatic approval can follow once
staff trust the rule.

No part of PauseCon needs approval to come to. The Sunday evening
speaker event is public, likely in a bigger venue away from the rest of
the conference.

## Where the answers are kept

`form_entries` holds a form's name, email, phone and postcode, in fixed
columns. Nothing on the site holds other answers today, or the days
someone ticked, or a request for accommodation. Three ways to hold
them:

O2. A table just for PauseCon. It's the quickest, and its columns say
exactly what it holds, but the next event with accommodation needs
another.

O3. Accommodation as a feature of any event. An accommodation request
is a row of its own: the person, the event it belongs to, its status
(waiting, approved or declined), who decided and when, then the nights
and needs from the second form, and a note for staff. Answers to the form's other questions are kept
with the form entry, under question IDs defined in code. Any later
residential event uses the same tables and the same staff pages.

O4. Airtable or Google Sheets as the place it's kept. Staff are used to
spreadsheets, and the hotel needs one. But the site has no live link to
either today. It would need a sync both ways, for the requests going
out and the approvals coming back, and the broadcasts would only see
approvals once the sync had run. That is the fragile Zapier chain again.

I recommend O3, with a spreadsheet only as an export. Nothing would
come back from it, so it can't fall out of step. Two ways to export:

O12. The supporters list's CSV download, which exists already. Filter
by "accommodation approved" and "staying on Saturday night", download,
and send the hotel the names. The download gains columns for the
nights. This is the least work.

O13. A Google Sheet that the site keeps up to date, overwriting it each
time. It's always current without anyone downloading, but it's a new
connection to Google to build and look after.

I recommend O12. Either would show how many people are staying each
night and who they are, from which the cost against the budget follows.

O4 stays possible if staff would rather run accommodation in Airtable
from the start. The site would then know nothing of it, and the
broadcasts couldn't tell who is approved.

The form's links to Luma need one change too. `form_entry_luma` keeps
one event per form entry, and a PauseCon entry registers someone for up
to five.

The hotel assigns the rooms. We give it lists of names, for each
night. Beyond that, how we'll work with the hotel isn't known yet, so
the site keeps only what it must, being who is approved and the nights
and needs they gave, and keeps the rest loose. A request has a free
note for staff, and the export is a sheet that staff can add columns to
and rearrange as the hotel needs. The site never reads the sheet back.

## Staff pages

Events have a list on the staff site (`/staff/events`) but no page
each. Each event gets a page of its own. It shows who's going, with
their answers to the form's questions where they used our form, and a
button to email the people going, which opens a new broadcast with the
event's filter already set.

The PauseCon events each have this page. Accommodation has two lists
of its own: requests waiting for a decision, and people approved, with
their needs and nights.

Emailing everyone going to any of several events already works. The
supporters list's event filter takes more than one event, and a saved
filter can keep "anyone going to any part of PauseCon" for the next
broadcast.

## Emails

The broadcasts already have conditional blocks for "going to this
event". So one email to everyone at PauseCon can tell those not yet
going to Sunday about Sunday, and so on. They need two more conditions:

- has asked for accommodation, so an email can tell those who haven't
  that they can;
- their request is waiting, approved or declined, so the reminders can
  chase the right people;
- they're approved but haven't yet given their nights and needs, so
  they can be reminded to.

The supporters list needs the same as a filter, so a broadcast can go
to everyone whose request is approved.

The notes ask for reminders to each event, though less so than for the
invite. Luma sends its own reminder for each event, so the broadcasts
are for the extra ones, such as telling approved people the base's
address.

## Personal data

The plan collects new things about a person: the days they're coming,
the nights they're staying, their answers to the approval questions,
and staff's decision on them. Before anything is built,
this section will say what each does to `docs/data-protection.md`, to
the privacy policy and to erasure, and how long it's kept after
PauseCon is over.

The site doesn't ask about dietary or access needs. Lunch on Saturday,
Sunday and Monday at the conference venue is for whoever has signed up
for that part, so the count of those going is all the caterers need.
The second form's accommodation questions are its own, still to be
written.
