# PauseCon 2027: conferences, sign-up and accommodation

This plan is a draft. Open questions are marked Q and choices still to
make O, so they can be answered by ID.

## What PauseCon is

PauseCon is several days of events in London, about a month before the
march, from Saturday 27 February to Tuesday 2 March 2027. Each part is
its own Luma event, so that people browsing Luma find them:

- Saturday 27 February: training day.
- Sunday 28 February: canvassing and postering.
- Sunday 28 February, in the evening: a panel.
- Monday 1 March: to be decided.
- Tuesday 2 March: the Parliament lobby (`plans/parliament-lobbying.md`).

Around 300 people are expected at PauseCon, and the lobby is aiming
for 500 to 1,000. People need about two months' notice, so sign-ups
should open by the end of December.

## Conferences

A conference is a group of events, with accommodation. Conferences
get their own entry in the staff sidebar, and a page each. PauseCon
2027 is the first.

The tables, in the words the pages use:

- `conferences`: one row per conference, such as PauseCon 2027, with
  its name and dates.
- `conference_events`: one row per Luma event that's part of a
  conference, saying whether going to it needs approval (the panel
  does).
- `conference_applications`: one row per person who applies to a
  conference, for accommodation, an event that needs approval, or both
  (see "Applications", below).

For example, PauseCon 2027 is one row of `conferences`, with five rows
of `conference_events`, one of them the panel, marked as needing
approval. Jane Smith ticks the training day and the panel, and asks for
accommodation, so she has one row of `conference_applications`, waiting
for a decision.

What isn't stored: who's going to each event is Luma's, as the import
keeps it, so a conference's guests are worked out from its events'.

The Conferences page lists them. A conference's page shows its events
together, each linking to its own event page (#514), with how many are
going, and the applications: those waiting for a decision, those
approved, with their nights, and those declined. It has a button to
email everyone going to any of its events, and the supporters list
gains a conference filter for the same.

## The forms

Both forms are on our site. They're bespoke, as the march forms are
(`app/(march)/demonstrations/`): their own pages, fields and server
routes, calling the same shared pieces underneath. We build them as
very simple, plain mockups, and our designer then has an agent give
them their real design. The PauseCon domain redirects to the first.

### Form 1: signing up

Section 1, events:

1. Which events would you like to come to? Tick boxes, one for each of
   the five parts.

Section 2, about you:

2. Full name.
3. Email. "This is the email Luma will use for your event
   registrations. If you don't have a luma account, one will be created
   for you."
4. Mobile number.
5. Postcode. "We use this to match you to your MP and local canvassing
   - this is also used to find out if they live in the UK."
6. Will you need accommodation? Yes or no. "If your application is
   approved, we'll email you a separate form for the accommodation
   details."
7. I agree to follow the PauseAI code of conduct, with a link to it.
   Required.

Under these: "This event will be photographed. You may also have to
provide your own food."

Section 3, getting to know you, shown only to those who need
accommodation or tick the panel:

8. Are you 18 or over? Yes or no.
9. How have you been involved with PauseAI before, if at all?
10. Why are you concerned about the development of AI?
11. Why do you want to come to PauseCon?

When they send it, the site registers them on Luma for each event they
ticked that doesn't need approval, so Luma sends its own confirmation
and reminders. If they need accommodation or ticked the panel, it
makes their application.

### Form 2: accommodation details

Only for those approved with accommodation, by a link in their approval
email that's theirs alone, so it knows who they are:

12. Any accessibility needs?
13. What nights do you want to stay? Friday, Saturday, Sunday, Monday,
    and Tuesday (limited places, only if you can't get back after
    4pm).
14. Anyone you would like to stay with?
15. Please confirm that you are definitely going to come, as PauseAI
    will be booking your accommodation. A button: "I won't disappoint
    all of you".

And an optional donation, suggesting £100.

### Keeping the answers

Whoever runs PauseCon will want to change what the forms ask, and how,
often and at short notice. So the site keeps as columns only what it
acts on, and the rest as pairs of a question, in the words it was
asked, and its answer. The columns are:

- in `form_entries`, as for every form: name, email, mobile number and
  postcode;
- on the application: whether they need accommodation, whether they
  agreed to the code of conduct, its status (waiting, approved or
  declined), who decided and when, the nights, when they confirmed
  they're coming, when they confirmed the hotel, and a note for staff.

Questions 8 to 12 and 14 are pairs. All the forms' wording is in one
copy file, so changing a question is a small PR, with no migration,
that an agent can make in minutes and the organiser can check on the
deploy preview. Old answers still read under the question they were
asked.

O19. Questions staff edit. If PRs turn out too slow, staff could add,
reword and remove the questions on the staff site, and the forms show
them as they stand. It's much more work: an editor for questions, and
forms that build themselves from them.

Two shared pieces change, and any later form gets both:

- `form_entry_luma` keeps one event per form entry, and a PauseCon
  entry registers someone for up to five, so it takes a row per entry
  and event.
- `addLumaGuest()` sends answers to an event's registration questions,
  such as the lobby's postcode, as well as name and email
  (`plans/parliament-lobbying.md`, "Signing up").

## Applications

Staff decide each application on the conference's page. The main
things they go on are whether the person has volunteered with PauseAI
before, and whether they know what PauseAI is and what they're applying
for. People are expected to come to two or three of the parts to get a
bed, but the form doesn't enforce it, as there will be exceptions, such
as a speaker.

O1. Approving people we already know. Someone with a record of
volunteering on the site (a past event, a letter to their MP, a march)
could be approved automatically, or shown to staff with that record
beside their application. Showing it to staff is safer to begin with.

When an application is approved, the site registers them on Luma for
the panel, if they ticked it, and emails them. Its email links to form
2 if they need accommodation.

Staff can edit an application's columns on the conference's page, such
as someone's nights after they email to change them, or their
accommodation after a cancellation. Each edit goes in the audit log.

The hotel assigns the rooms. We give it lists of names for each night,
from the supporters list's CSV download, which exists already: staff
filter by the conference, "approved with accommodation" and a night.
The download gains columns for the nights. The site never reads a
sheet back, so nothing can fall out of step.

## The emails between them

1. Form 1 sent. Luma confirms each event that needs no approval. Those
   who applied get an email from us saying we've got their
   application and will get back to them.
2. A decision. The approved get an email saying so, with the link to
   form 2 if they need accommodation, and Luma confirms the panel if
   they ticked it. The declined get an email saying so, which says
   they're still welcome at the events that need no approval.
3. Form 2 not yet sent. Reminders to the approved who haven't filled
   it in.
4. Form 2 sent. An email confirming that they've got accommodation,
   and their nights, with the donation link.
5. The hotel known. Once the hotel is booked, an email to everyone
   with accommodation: here is the hotel, please confirm you want to be
   here. The site records each confirmation.
6. Before PauseCon. Broadcasts to those going, such as the base's
   address, and to those not yet going to some part, about it.

Emails 1, 2 and 4 are sent by the site when they happen, with their
words in the copy file. Emails 3, 5 and 6 are broadcasts, which need
these conditions, and the same as filters on the supporters list:

- going to any event of a conference;
- has applied, and the application is waiting, approved or declined;
- approved with accommodation but hasn't sent form 2;
- has accommodation but hasn't confirmed the hotel.

Email 5's confirmation is a link of the reader's own, like #515's link
to write to their MP, which records their yes on the application.

Being registered on five Luma events means five sets of Luma's
reminders, which last time was a pain, though getting the events into
people's calendars worked well.

O21. Luma's reminders off for PauseCon's events, and our own instead:
one broadcast before each day to those going to that day's events.
Fewer emails, in our words, but they're ours to schedule.

O22. Luma's reminders left on, as they cost nothing and people are
used to them.

I recommend O21, if Luma lets reminders be turned off for each event.

#517 plans broadcasts to an event's guests whatever lists they're on,
which these would use.

## Personal data

The forms collect the events someone is coming to, whether they're 18
or over, their answers about PauseAI and AI, their nights, who they'd
like to stay with, their accessibility needs, and staff's decision.
Accessibility needs are health data, which the law protects more
closely, so they need their own basis and the shortest keeping. Before
anything is built, this section will say what each does to
`docs/data-protection.md`, to the privacy policy and to erasure, and
how long it's kept after PauseCon.

## Open questions

Q25. The panel's approval. Someone who ticks the panel is registered
on Luma for it only once approved. Someone who finds the panel on
Luma, though, could RSVP there directly. Should the panel's Luma event
require approval in Luma too, so those go to staff as well?

Q26. The emails the site sends (1, 2 and 4). Is it right that the site
sends these itself the moment something happens, rather than staff
sending them as broadcasts?

Q27. Under 18. What happens to someone who says they're not 18 or
over: are they refused, or does staff decide?

Q28. The donation. Is it a link to the site's donate page, or a payment
in form 2 itself?

Q29. The confirmation button. Is pressing it what books their bed, and
what happens to someone approved who never presses it?

Q30. Accessibility needs. Who needs to see them (the hotel, the
venue?), and can they be deleted soon after PauseCon?

Q31. Mobile number. Is it required?
