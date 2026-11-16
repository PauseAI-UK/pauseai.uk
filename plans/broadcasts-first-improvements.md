# Broadcasts: first improvements

Broadcasts (`/staff/broadcasts`) sends email by Gmail or Postmark and
texts by WhatsApp, takes replies and handles unsubscribes, all tested in
production. What's left is below.

## First send to the real list

Once it's gone well, UK staff stop sending from CiviCRM, and all UK bulk
email goes from pauseai.uk.

## More people saying yes

- **The Luma checkbox.** Luma's phone field doesn't say what a number is
  for, so a Luma number now allows only that event's reminders. Ask for
  a number on every event, with a checkbox that gives what joining as a
  member gives: the weekly email, texts about events and calls from
  volunteers (to decide with Joseph). The import reads it as it reads the
  postcode question. Existing Luma contacts are asked by a calendar
  newsletter linking to a page on pauseai.uk. If someone ticks it with
  "No bulk emails" set, the import emails them a link to the preferences
  page to lift it, as the site's forms and the paper import do.
  Registering for an event isn't a yes by itself: the charities' soft
  opt-in (PECR regulation 22(3A)) is for registered charities, and Safe
  AI Alliance Ltd isn't one.
- **Our own join form** on pauseai.uk, with a "PauseAI UK can email me"
  box, still passing new members to Global. pauseai.uk brought in 351
  of the 427 UK signups in October.
- **A postcode question** on every Luma event, for events near the
  reader and their MP.
- **Members' numbers** from CiviCRM get texts only once
  [legal-pack#13](https://github.com/PauseAI/legal-pack/issues/13)
  allows it. Until then texts reach Luma's numbers and our march form's.

## Smaller steps

- `mailings.channel` loses `whatsapp`, leaving `email` and `text`.
- A number that isn't a mobile is skipped from then on, as one not on
  WhatsApp is.
- A new source for `volunteering`, as a new member's number is unsure.
- The contact preferences page says Luma's invites are separate, until
  we know whether removing someone from the Luma calendar stops
  organisers' invites to them.

## Personal emails

More filters and lozenges, so an email can carry events near the
reader, the main events with how many have signed up, and their MP. Not
specified yet. Then the weekly is scheduled automatically each week.

## WhatsApp

- **The daily limit.** Raise it from 250 to 2,000
  ([limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)).
  Send a few small texts first, under 200 each (staff, then volunteers,
  then one local group), then ask again in WhatsApp Manager, or have an
  admin confirm their ID in the
  [Security Centre](https://www.facebook.com/business/help/587323819101032).
  Watch the templates' quality rating
  ([quality](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-quality)).
- **The Marketing Messages API.** Move from the Cloud API's `/messages`
  before it stops sending marketing messages on 13 October 2027
  ([overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/overview.md)).
- **A preferences link button** on every text, to stop one topic
  rather than all texts. To research: how two buttons show on phones and
  WhatsApp desktop, and a link token per text copy
  ([components](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components)).
- **Maybe coexistence**: the same number in the WhatsApp Business app,
  so staff can answer on a phone
  ([onboarding](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)).
  It needs PauseAI to become a Tech Provider or use a partner, and turns
  off some app features.

## Calls

Volunteers make calls from numbers staff give them. Before a number is
given out, a "Can I call this person?" check, on the supporter's page
and the numbers given out, says yes or no and why, by our own stops,
CiviCRM's "Do not phone" (`checkSuppression`) and the TPS, checked by
an API such as
[Data Soap](https://www.datasoap.co.uk/developer/validation-api)'s
before each round of calls
([ICO](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-live-calls/how-do-we-comply-with-the-rules-on-live-marketing-calls/)).
A request not to be called is recorded with how it was given, and kept
after erasure.

## Data protection

Record in `docs/data-protection.md` the new opt-in sources, and the TPS
checker as a processor.

## Later, optional

- Ticks for Global's lists on the preferences page.
- Once legal-pack#9 is decided, a daily sweep of the Luma calendar's
  followers against `checkSuppression`.
- Delete `civicrm_contacts` rows a week after CiviCRM stops returning
  them.
- Agree with Global whether each side tells the other of an erasure
  request.

## Open questions

1. What does the checkbox say? A person writes it. It names PauseAI UK
   and says messages and calls.
2. How does a volunteer who isn't staff record a stop for calls?
3. For someone who hides their number behind a WhatsApp username, do we
   store Meta's ID for them, so a later stop can be matched?
4. Where do we learn who wants to volunteer, once the join form stops
   asking?
5. Coexistence, or not?
