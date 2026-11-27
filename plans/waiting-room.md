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

To be written once the questions below are answered, and agreed before
any migration.

## Open questions

1. **Telling a join from other messages.** Our number also gets replies to
   broadcasts. Is a join only a message that starts with the button's typed
   text? What if a supporter we already text writes "I'd like to join"?
2. **What the LLM judges.** What counts as a real person: any sincere
   sentence, or something about AI? Which model? If the LLM is down, is the
   reply held for staff?
3. **Missing details.** If the reply has a reason but no postcode or email,
   or only half a postcode, does the bot ask once more, or let them in
   without?
4. **Messages after the first reply.** What someone hears if they write
   again while held ("we're checking"), after they're in, or after being
   dismissed (nothing).
5. **Rotating the link.** Who resets the community's invite link, how
   often, and how the site learns the new one. Today that's an admin's
   phone, then `WHATSAPP_INVITE_URL` in Netlify and a redeploy.
6. **The old ways in.** Whether the waiting room group closes, and whether
   the CSV import of the community's members stays, for people added other
   ways.
