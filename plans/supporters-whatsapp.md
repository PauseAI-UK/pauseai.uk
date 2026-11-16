# WhatsApp to supporters

This plan is for broadcasts to supporters by text, on the Broadcasts
pages at `/staff/broadcasts`. A broadcast is by email or by text, and
each supporter's copy is a message. A broadcast by text is called a text
for short, and is sent by WhatsApp. What's left:

1. Groundwork: consent, opt-outs and opt-ins.
2. The WhatsApp backend.

## Now

- We have about 750 numbers. Roughly 470 are members', from the join
  form by CiviCRM, Tally-era ones included. Global shares them for calls
  only: texts wait for
  [legal-pack#13](https://github.com/PauseAI/legal-pack/issues/13)
  (open question 6). Roughly 320 are from Luma, nearly all from the
  November march and PauseCon 2025, and allow texts only. More come from
  our march form, live since 28 October, whose box allows calls and
  texts.

## Rules

- We only message someone in a way they said yes to. The ICO treats
  SMS and app messages as electronic mail, and the soft opt-in doesn't
  cover political campaigning
  ([ICO](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/)).
- A yes to texts allows WhatsApp. Meta accepts an opt-in that names us
  without naming WhatsApp
  ([opt-in](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in)).

## Opt-outs

PECR wants a simple way to stop in every message (ICO, above), and Meta
wants every request to stop honoured, however it's made
([policy](https://whatsappbusiness.com/policy/)).

Blocking or reporting us in WhatsApp isn't reported to us. Messages to
that person stop being delivered, and a number never delivered to is
skipped after a few tries, as one not on WhatsApp is.

## 1. Groundwork

### Asking on Luma

Luma's phone field doesn't say what a number is for, and each event can
make it off, optional or required. PauseCon required one and nearly
everyone gave it. The march made it optional and about one in six gave
one. Most events don't ask. So a Luma number allows only that event's
reminders.

The proposal, to decide with Joseph, is to ask for a number on every
event, with a checkbox that gives the same permission as joining as a
member: the weekly email, texts about events, and
calls from volunteers. Existing Luma contacts are asked by a calendar
newsletter linking to a page on pauseai.uk. We measure how many tick it
on each event, and if it's few, ask for less, starting with the weekly
and event messages.

### Steps

1. `mailings.channel` loses `whatsapp`, leaving `email` and `text`.
   Nothing uses it, and no row on the live site has it.
2. The Luma checkbox, which the import reads as it reads the postcode
   question.
3. A number that isn't a mobile is skipped from then on, as one WhatsApp
   says isn't on it is.
4. A new source for `volunteering`, as a new member's number is unsure
   (open question 4).
5. Texts and calls again after "Do not SMS" or "Do not phone". We send
   CiviCRM those flags only for Stop everything, but nothing of ours can
   lift them: Global's API has no change that clears them. So after Stop
   everything and Restart, a number in CiviCRM never gets our texts or
   calls again, and the contact preferences page locks its boxes, saying
   only Global can lift it (`numberHolds`). Ask Global to add
   `allow_sms` and `allow_phone` to `updateSubscriptions`, on the same
   terms as `allow_bulk_email`: only from the person ticking a box, with
   its words, and refused after a newer stop. Then Restart, and a text or
   call box ticked on the page, send them, as lifting "No bulk emails"
   does, and the page unlocks those boxes, with words saying it turns
   Global's texts or calls back on too. Until Global has it, those
   numbers stay as they are (open question 7).

## 2. The WhatsApp backend

### The daily limit

- Raise the limit from 250 a day, which WhatsApp Manager still shows.
  A verified account can message 2,000 people a day
  ([limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)).
  After verifying a business, Meta approves or denies the rise to
  2,000 by the quality of our messages, and Business info says
  "WhatsApp needs more information". WhatsApp Manager asks us to "Start
  high-quality business-initiated conversations", and counts those
  started with different people in the last seven days. So we send a
  few small texts first, under 200 messages each, then go back to that
  step and click it. For "needs more information" Meta's docs give two
  other ways (limits, above): an admin confirms their identity with a
  government ID, in the Security Centre
  ([ID](https://www.facebook.com/business/help/587323819101032)), or
  we send 2,000 delivered messages to different numbers in 30 days,
  which is more numbers than we have. At 250 a day, a text to all 750
  numbers takes three of the seven days it may send for
  (`SENDING_DAYS`).

Start gently: staff, then volunteers, then one local group, each
text under 200 messages until the limit has risen. Keep
the first templates useful and expected, such as an event reminder, and
watch their quality rating, which drops with blocks, reports and
unread messages
([quality](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-quality)).
Saying in every text how to stop means people stop rather than block us.

### Steps

To research: a link button on every text to the person's contact
preferences page (`/preferences/<token>`), so they can stop one topic
rather than every text, as an email's link lets them. A template may have
up to two URL buttons, whose address ends in one value per send, beside
quick replies if each kind is grouped together
([components](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components)).
Open: whether two buttons show well on phones and WhatsApp desktop (which
can't show a quick reply beside another kind), and a link token per text
copy, which texts don't have yet.

1. The WhatsApp backend in `lib/server/outside-services/whatsapp.server.ts`
   sends by the Cloud API's `/messages` for now. Marketing messages are to
   go through the Marketing Messages API (`/marketing_messages`), whose
   terms are signed, as the Cloud API stops sending them on
   13 October 2027
   ([overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/overview.md)).
   Meta charges for each delivered message, by category
   ([rate card](https://whatsappbusiness.com/products/platform-pricing/)).
   A marketing message to a UK number is £0.0458, by the rates in pounds
   of 1 October 2026, so a text to all 750 numbers is about £34.
2. Maybe, the same number in the WhatsApp Business app too, so staff can
   read and answer texts on a phone. Meta calls this coexistence
   ([onboarding Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)).
   A number already in the Business app is connected to the Cloud API
   and keeps working in the app. "WhatsApp keeps messaging history
   between both apps in sync": one-to-one chats are mirrored both ways,
   and the last six months can be imported. What it costs:
   - it's set up through Embedded Signup, and "You must already be a
     Solution Partner or Tech Provider", so PauseAI would become a Tech
     Provider or go through a partner that offers it;
   - the number sends at a fixed 20 messages a second;
   - in the app, disappearing messages, view once, live location and
     broadcast lists are turned off, and linked devices are unlinked, to
     be linked again (not WhatsApp for Windows);
   - texts sent from the app are free and outside the 24-hour window,
     and those by the API are charged as above.

   The page lists no countries it excludes. Whether to do it is an open
   question (below).

## Calls

Calls aren't built here. Volunteers make calls, as local groups do now, from
numbers staff give them. A number isn't given out when it has a stop
for calls, which comes two ways:

- **The TPS**, which covers live calls only. We may call a number on it
  only if that person told PauseAI UK by name that they're happy to be
  called, and we have a record of it
  ([ICO](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-live-calls/how-do-we-comply-with-the-rules-on-live-marketing-calls/)).
  The join form is Stichting PauseAI's, so a volunteer's number may not
  meet that. Check each number by an API, such as
  [Data Soap](https://www.datasoap.co.uk/developer/validation-api)'s,
  before it's given out and before each round of calls, as a new
  registration takes up to 28 days to count.
- **Asking not to be called**, usually on a call. The volunteer or staff
  record it, with how it was given. It's kept after erasure.

Before anyone calls, there's a "Can I call this person?" check, on the
supporter's page and on the numbers given out. At that moment it checks
our own stops, the TPS, and CiviCRM's "Do not phone" by
`checkSuppression`. It says yes or no, and why.

## Data protection

Record in `docs/data-protection.md`:

- the new opt-in sources;
- with calls, the TPS checker as a processor.

## Not in this plan

SMS, WhatsApp groups and Communities, attachments, messages to
politicians, and a calling tool.

## Open questions

1. What should the checkbox say? A person writes it, and the same words
   go on Luma and our forms. It must name PauseAI UK and say messages
   and calls.
2. How does a volunteer who isn't staff record a stop for calls: by
   telling staff, or on a page of the numbers they were given?
3. A person with a WhatsApp username can hide their number, and Meta's
   webhooks then give only an ID for them that's particular to us. Do we
   store that ID against the number when we send, so a later stop can be
   matched?
4. Once the join form stops asking intent, where do we learn who wants
   to volunteer: Global's `volunteer_updates` list, our own join form,
   or something else?
5. Should the number also be in the WhatsApp Business app, by
   coexistence (step 2 of "2. The WhatsApp backend"), so staff can answer on a
   phone, at the cost of becoming a Tech Provider or using a partner?
6. Can members' numbers, from CiviCRM, get texts? Global shares them
   for calls about volunteering, and for practical texts about
   something the person registered for, such as an event's time and
   place, but no other texts, as no join form asked
   ([legal-pack#13](https://github.com/PauseAI/legal-pack/issues/13)).
   Until then, a text reaches Luma's and our march form's numbers.
7. If Global won't add `allow_sms` and `allow_phone` (step 5 of
   "1. Groundwork"), should a box ticked on our page win over CiviCRM's
   "Do not SMS" for our own texts, as we'd decide alone? That means our
   own override in `contact_permission()`, and in the check before each
   text, which skips a number with "Do not SMS".
