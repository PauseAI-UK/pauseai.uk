# The waiting room

Our WhatsApp community lets people in through a waiting room: a group where
newcomers say who they are and why they're interested, and an admin checks
they aren't a bot before adding them. Bots got in anyway and the community
was suspended. Every button for it now leads to `/whatsapp`, which says the
waiting room is down.

This plan moves the waiting room into a private chat with our WhatsApp
number. An LLM reads why someone wants to join, and the site sends the
community's link to those who look real, holding the rest for staff.

## How it works

1. **A button** for the community, anywhere on the site, leads to
   `/whatsapp?utm_source=…`, saying where it is (`footer`, `parents`, …).
2. **The page shows Turnstile first.** Once it passes, the server answers
   with a "Message us on WhatsApp" button: a `wa.me` link to our number,
   with a message typed for them, such as "Hi PauseAI UK, I'd like to join
   (parents)". Our number is in no page, so bots reading the site don't find
   it.
3. **They send it.** They wrote first, so we can reply freely for 24 hours
   with no template for Meta to approve, and replies to messages they start
   cost nothing. The number is real, as they messaged from it, and their
   WhatsApp profile name comes with it.
4. **Our number replies**, asking why they're interested, and for their full
   postcode and email if they like.
5. **An LLM reads their reply.** If it looks like a real person, the site
   sends the community's invite link at once, as an ordinary message. If
   not, it's held for staff.
6. **Staff see held replies** in the supporters area, under the Supporters
   permission, and let each one in (sending the link) or dismiss it.
   Dismissed is for good: a later message from that number goes nowhere.
7. **Joining is a yes to the newsletter by text**, as the CSV import of the
   community treats it now. The page and the first reply say so plainly,
   with STOP to stop it.

Someone who never replies gets no reminder.

**A join is the button's message, matched loosely.** WhatsApp puts the
typed message in their message box, where they can change it before
sending. So a first message with the button's code, such as `(parents)`,
or asking to join, starts the waiting room. Anything else that answers no
text of ours is emailed to staff, as any such message is now, so one that
was rewritten past matching isn't lost.

**Everyone who comes through becomes a supporter**, linked by their number
as the community's CSV import links its members, and by the email they
give, if any, to anyone we already have under it. What they give goes on
their record: profile name, email, postcode and where they came from.

**Half a postcode is the usual answer.** In the old waiting room, people
asked for "your postcode or the name of your MP" gave its first half
("E15") or named their MP, and nobody gave an email. A first half is kept
as any postcode is: supporters' places already place one roughly, through
postcodes.io's outcodes, as they do for paper sign-ups. The check pulls
out a first half as well as a full postcode, and an MP's name not at all.

**The check was tried** on twenty made-up replies shaped like the old
waiting room's: sincere ones long and short, in English and French, and
greetings, emoji, adverts, a crypto channel, gibberish and abuse. Claude
Haiku 5.5 at low effort judged all of them as a person would, four runs
out of four, and pulled out every full postcode and email.

**Missing details don't hold anyone up.** Someone who passes gets the link
at once, whatever else they gave. If there was no full postcode, a line
under the link asks for it, so we can tell them when there's a chance to
contact their MP. A later message with a postcode or email updates their
record.

**Staff change the community's link on the waiting room page**, under
the Supporters permission, and it takes effect at once: it's kept in the
database, not in Netlify's settings. The page says when it was last
changed and by whom, and the audit log keeps each change. It's reset when
there's a reason, such as spam in the community or the link seen in
public, not on a timetable.

**It starts unlinked, at `/whatsapp/beta`.** The waiting room is built
and tried there while every button still leads to `/whatsapp`, which says
the waiting room is down. Once it works, `/whatsapp` becomes it.

**The old waiting room group is gone.** No code knows it; only the docs
do, as where the community's CSV import gets its consent, and their words
change when this ships. The CSV import itself is left as it is for now.

**Messages after the first reply.** While held, a second message gets
one "Thanks, someone will check and get back to you soon", and joins what
staff see. Once they're in, nothing is said back: a postcode or email
updates their record, the message shows on the waiting room page, and
anything else that answers no text of ours is emailed to staff as now. A
second join message from someone already in gets the link again. Once
dismissed, nothing is said back and nothing reaches the LLM or staff;
their messages are kept for their record.

**Staff see the whole chat** on the person's waiting room entry and their
supporter page, drawn as a broadcast copy's conversation is
(`ChatWall` and `ChatBubble`, `app/(staff)/staff/_components/broadcasts/TextBubble.tsx`):
theirs at the left, ours at the right in green.

**The LLM is lenient.** Any sincere reply from a person passes, however
short: "worried about AI", "a friend told me about you". It holds what's
empty or junk: "hi" alone, adverts, links to other groups, gibberish. It
says why it held one, for staff. It's Claude Haiku, through the Anthropic
API the site already uses. If it can't be reached, the reply is held.

The WhatsApp API can't add anyone to a community, nor invite them to one:
it doesn't know communities at all, and groups it makes are capped at 8
people (Meta's Groups API docs). So the link is sent as a message, and the
community stays the admins', run from their phones.

## What people see

Mocked up: https://claude.ai/artifact/P8TCoTdXUwt1oX5ZnjvKYk

- **The `/whatsapp` page**: the Turnstile check, then the WhatsApp button,
  and what joining means for texts.
- **The chat**: their typed message, our question, their reply, the link.
- **Staff's waiting room page**, in the supporters area, with a count in
  the sidebar: Held, Let in, Dismissed and No reply. Each held reply shows
  the message, why the LLM held it, and Let in or Dismiss.
- **A daily email to staff** while anyone is held. The notifications plan
  (`plans/notifications.md`) takes this over once it's built.

## Personal data

- `docs/data-protection.md` gains a row: each person's number, profile
  name, their messages to the waiting room, the postcode and email they
  give, where they came from, the LLM's verdict and reason, and staff's
  decision. Lawful basis: their consent by joining, for the newsletter by
  text, and legitimate interests for checking they aren't a bot. Article
  9(2)(d) for the political opinion joining shows.
- The LLM is a new processor of their messages: the privacy policy names it.
- Erasure takes their messages and verdicts with the rest of them, and
  their number's hash stops the waiting room letting them in again.

## The tables

To be written next, and agreed before any migration.
