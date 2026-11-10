# Email to supporters

The UK weekly, and smaller broadcasts such as one to a local group, sent
from pauseai.uk instead of CiviCRM, so each email can be personal, with
events near the reader and their MP. It uses the Broadcasts pages at
`/staff/broadcasts`, and comes in six phases, a pull request each.

## Now

- Staff write the weekly in CiviCRM and send it from `hello@pauseai.uk`
  to the UK list, about 1,260 people. Apart from the lead story it's
  mostly Luma events, which the site could fill in.
- `contact_permission()` can only answer "Not sure" for a member's
  `pauseai-updates` email, as we can't see who unsubscribed in CiviCRM.
- Global's chapter contacts API is live at `https://crm.pauseai.info/`,
  and we have a UK key, in Netlify as `CIVICRM_CHAPTER_KEY`. Its spec is
  [PauseAI/pauseai-civicrm#1175](https://github.com/PauseAI/pauseai-civicrm/issues/1175).
  It has three actions:
  - `get`: every UK chapter contact's address, Airtable ID, email and
    phone flags, and status on the two UK lists, `newsletter` (our
    `pauseai-updates`) and `volunteer_updates`. Someone who leaves the
    chapter just stops being returned.
  - `checkSuppression`: whether email to any address, or calls and
    texts to any number, are blocked anywhere in PauseAI.
  - `updateSubscriptions`: our stops sent back. Opt-ins only from the
    person ticking a box themselves, with the box's words.

## Sending rule

We send a broadcast to an address only if `contact_permission()` says
yes for its topic (phase 1) and `checkSuppression` allows it just before
sending (phase 4). If no pull has completed for 24 hours, nothing sends:
a broadcast that has started stops, and whoever scheduled it is emailed
why. Each broadcast goes once per address.

We send through Postmark, not CiviCRM, as we also email people who
aren't CRM contacts. Once phase 4 is done, UK staff stop sending from
CiviCRM, and all UK bulk email goes from pauseai.uk.

## Phases

### 1. Import from CiviCRM

CiviCRM is one source among ours, like Luma or our forms. Each source
is stored as it told us, stops are stored apart, and
`contact_permission()` brings them together for each address or
number. The latest thing the person said wins.

**What we import.** Every hour, `get` with `CIVICRM_CHAPTER_KEY`, 500
contacts a page by contact ID, and between pulls a lookup for each new
address. For each UK chapter contact: its contact ID, Airtable ID and
email; the flags `on_hold`, `no_bulk_email`, `do_not_email`,
`do_not_phone` and `do_not_sms`; and its status on `newsletter` and
`volunteer_updates`. No name, number or postal address. The pull is a
job like the other imports, so a failed one emails the notification
inbox.

**What we store.** A table of every contact returned, matched to a
member or not, keyed by contact ID, with when we first saw it, when
each flag or status last changed, and when it stopped being returned.
CiviCRM gives no dates, so those are when we saw the change, and what
the first pull finds counts as from before it. A contact joins the
supporter by address, and a member by Airtable ID. Erasing a supporter
deletes their rows, keeps the contact ID in `civicrm_erased` so the
pull doesn't copy them back, and keeps the stops they made, as every
erasure does.

**How it changes the answers:**

| CiviCRM says | Our answer |
|---|---|
| `newsletter` `subscribed` | yes to the newsletter by email |
| `newsletter` `unsubscribed` | a stop to the newsletter, in `opt_outs` from `civicrm` |
| `newsletter` `not_opted_in` | no yes from CiviCRM, but not a stop: a yes from another source still counts. CiviCRM refuses our `resubscribe` for them, and only its own opt-in page lifts it. Signups before June 2026 move to it when Global's email-law note is approved |
| `newsletter` `not_on_list` | nothing from CiviCRM |
| `volunteer_updates` | the same, for volunteering by email |
| no longer returned | nothing from CiviCRM. Our members come from our Airtable import, as now, and CiviCRM doesn't remove them |
| `on_hold` | a block, shown as from CiviCRM, which staff can lift with a note; only a new hold blocks again |
| `no_bulk_email` | no bulk email of any topic; transactional and one-to-one email still go. Only the person lifts it, on the preferences page |
| `do_not_email` | no email at all but transactional; we never lift it |
| `do_not_phone` | no calls; we never lift it |
| `do_not_sms` | no texts, by WhatsApp or SMS; we never lift it |

The phone flags reach a member's number through their Airtable ID, for
the supporter's page; `checkSuppression` on each number is what counts
before calls and texts. Calls and texts become separate consents, so
each flag stops only its own. Unsubscribing from volunteering emails
doesn't stop volunteering calls or texts, but the "Can I call this
person?" check shows it, with its date.

**The consents.** Today's topics (`luma-calendar`, `pauseai-updates`,
`site-forms`, `volunteering` and `march-day`, by email or phone) are
replaced by three that say what we'd send: the UK newsletter, which
includes events; events only; and volunteering, each by email, text and
call. `contact_permission()` answers those, and from this phase the
supporter's page, the supporters list's filters, the staff home's
counts and the "Consents" in Broadcasts show them, each yes or stop
with where it came from, when, and the box's words. Where each yes
comes from:

| Source | Newsletter | Events only | Volunteering |
|---|---|---|---|
| March form | email, text | | |
| Email your MP | email | | |
| Paper sign-ups | email, and text with a number | through Luma | |
| Join form's "Keep me informed" (CiviCRM `newsletter`) | email | | |
| Join form's intent (CiviCRM `volunteer_updates` for email) | | | email, text, call |
| Following the Luma calendar | | email | |
| The preferences page (phase 3) | email, text, call | email, text, call | email, text, call |

### 2. Send our stops back

Each new newsletter stop in `opt_outs`, and each spam complaint as
`no_bulk_email`, goes to `updateSubscriptions`, retried until it has a
result. Our newsletter and CiviCRM's `newsletter` are one list, so a
newsletter yes on our side goes too, as `resubscribe` with the box's
words: a tick on the march form, Email your MP or the preferences page
(phase 3), or a paper sign-up, where writing an email address down is
asking for the newsletter. CiviCRM refuses it for an address that isn't
a UK chapter contact, which changes nothing on our side.

Luma sends its calendar's invites and newsletters itself, so its
followers are kept to the same stops. The Luma import removes from the
calendar, by Luma's Remove
([contacts](https://docs.luma.com/reference/post_v1-calendars-contacts-remove)),
anyone with "No bulk emails" or "Do not email": from the pull for UK
chapter contacts, and for other followers from `checkSuppression`, once
a day and when it first sees them. A stop of all bulk email on our side,
from the preferences page or a spam complaint, removes them at once.
Removed contacts can still register for events, and can follow again
themselves. A newsletter unsubscribe alone doesn't remove them, as
following the calendar is their events yes. Whether removed contacts
still appear in Luma's contacts list, and whether a registered guest's
reminders still go, needs testing.

### 3. The preferences page

Anyone can enter their email address and be emailed a link to a page
where they see and change what they get.
Every unsubscribe link opens it too, and staff send it to anyone who
asks them to change their emails. It says clearly and simply what we
will and won't send them and why, whatever the source, CiviCRM's flags
and Global's lists included, and what each choice changes, Global's
mail too. It offers each of our topics by each way, and stopping
everything. It says Luma's invites are separate (open question 1).

It describes what we know of Global's own emails from CiviCRM: the
PauseAI Newsletter, Critical Alerts (the urgent emails) and Local
Invitations. Stopping all bulk email sends `no_bulk_email`, which stops
all of them for that address, though Global's staff can still email
them one to one; `do_not_email` stops that too. If Global has a page
for changing its emails one by one, ours links to it; find out while
building this.

The page opens only from a link emailed to the address, so a tick there
is the address's owner saying yes. Each tick is a yes with the
preferences page as its source, with the topic and way, the date and
the box's words, kept beside the others. The latest wins, so it reopens
an older stop.

- A newsletter email yes goes to CiviCRM as `resubscribe` (phase 2). A
  refusal, such as `not_opted_in`, changes nothing on our side, and the
  page doesn't mention it.
- Lifting "No bulk emails" goes as `allow_bulk_email` with the box's
  words, which turns Global's bulk email back on too, as the page says.
- An events-only email yes is ours alone: our events broadcasts use it,
  and it doesn't add them to the Luma calendar. Turning it off removes
  them from the calendar.
- A volunteering yes is ours alone.
- A text or call yes is for a number the email link doesn't prove is
  theirs.

**A yes from someone with "No bulk emails".** When someone ticks the
email box on the march form, Email your MP, a paper sign-up form or the
Luma checkbox but has "No bulk emails" set, their entry is stored as
usual, and we email them a link to the preferences page to lift it,
saying where they signed up. The site's forms send it at once, the Luma
import when it reads the tick, and the paper import on import. It isn't
bulk email: it goes only because they just ticked the box, once per
sign-up with no reminders, and says only what happened and how to
settle it, as the ICO fined Flybe for emailing people who had opted out
to ask them to opt back in. Nobody with "Do not email" gets it. Each of
these flows, the page included, is in the storyboard.

The paper import always sends it, to each new entry with "No bulk
emails", as signing the form is joining the list; staff don't choose.
Its preview makes that very clear before Import: how many will get it,
each one's row marked, and the email itself as they'll see it. The
email says when and where they signed up, from the import's date
collected and "Where collected", so that field's hint says it's shown
to them, and the preview of the email changes as it's typed. Anyone
with "Do not email" is marked as not hearing from us. A repeated import
sends nothing, as its entries are already there.

### 4. Email broadcasts from pauseai.uk

**Sending.** Postmark's broadcast stream
([streams](https://postmarkapp.com/message-streams)), on the site's
Postmark server but apart from its transactional stream, for about
$200–300 a year ([pricing](https://postmarkapp.com/pricing)). Postmark
reviews new broadcast senders, so apply early. It sends from
`hello@pauseai.uk`, so pauseai.uk itself becomes a sending domain in
Postmark, beside `letters.` and `notify.` (`docs/development.md`,
"Postmark"). That needs two DNS records, neither of which exists yet:
Postmark's DKIM key as a TXT record, and `pm-bounces.pauseai.uk` as a
CNAME to `pm.mtasv.net` for the Return-Path. With both, DKIM and SPF
align with the From address for DMARC. The SPF record needs no change.

The broadcast stream has the webhooks the site's own emails have
(`lib/server/postmark-webhooks.ts`): delivery, for the delivered count;
a bounce, marking the message failed and, if hard, blocking the
address; and a spam complaint, which is a stop (Opt-outs).

Before the first send, set up Google Postmaster Tools and DMARC
reports, so we can see our spam rate. pauseai.uk's DMARC is `p=none`,
with no reports.

**Replies.** `hello@pauseai.uk` is a Workspace account, so replies
arrive in its inbox as now. It's connected as a staff Gmail is, and the
site reads it (`read-gmail`): each reply is matched to its broadcast by
`In-Reply-To` before the one-off emails see it, and kept whole on the
message's page. Keeping only who and when, or forwarding the text to an
inbox, isn't enough: the old letters' Postmark replies were kept that
way, and their text is on no page. Someone looks at replies that may be
stops within a few days.

**Which consents a broadcast goes to** (phase 1). A newsletter or
events broadcast goes to newsletter, events or both, and one to both
must be about events, which the writer says. Volunteering goes on its
own. Each message records which yeses it went under, and its
unsubscribe stops all of them.

**Checking suppression.** `checkSuppression` runs just before every
broadcast, on every address, including those from Luma or MP letters,
as the joint controller agreement (2.6(f)) requires. It drops `all` and
`bulk`, and each is kept as a block of ours. If CiviCRM doesn't answer,
nothing is sent unchecked: the broadcast waits, retrying with a growing
gap, staff are told once that it's waiting and why, and its page says
it's waiting for CiviCRM, and since when. It sends by itself if CiviCRM
answers within the broadcast's time to send; otherwise it stops as any
broadcast does, listing who it didn't reach, and whoever scheduled it
is emailed. Transactional emails, such as a login link or a letter's
confirmation, don't check: they go even with "Do not email" set, so
checking could only delay them.

**A yes given another way**, such as at an event or in an email. Staff
record it on the supporter's page: which emails it's for, when and how
it was given, and who recorded it. It's a yes from then on, but not
over a stop.

### 5. Personal broadcasts

More filters and lozenges in Broadcasts, so an email can carry such
things as events near the reader, the main events with how many have
signed up, and their MP. Deliberately not specified yet.

### 6. The weekly, scheduled each week

The weekly is scheduled automatically each week.

## Opt-outs

PECR wants a simple way to stop in every email. Google wants a visible
link and one-click headers from anyone sending 5,000 a day, which we do
from the start, and spam complaints below 0.1%, never reaching 0.3%
([sender guidelines](https://support.google.com/a/answer/81126)). As
for texts (`plans/supporters-phone.md`, "Opt-outs"), a stop reaches us
every way a person might make it, and each is honoured at once:

- The unsubscribe link in every email. It stops at once, then opens the
  preferences page, which shows what was stopped, what they'll still
  get and why (such as events emails, because they follow our Luma
  calendar), and lets them change any of it.
- The `List-Unsubscribe` and `List-Unsubscribe-Post` headers in every
  email, which mail apps show as their own Unsubscribe button and
  honour with one POST, no page.
- A spam complaint, by Postmark's webhook, which stops all bulk email
  from us and is sent to Global as `no_bulk_email`.
- A reply saying unsubscribe, or anything less clear such as "please
  stop", shown to staff on the message's page with a button to record
  it as a stop.
- Any other way, such as a word at an event. Staff record it, with how
  it was given.
- CiviCRM, by the hourly pull: an unsubscribe there, or a flag
  (phase 1).

Each stop is a row in `opt_outs` with its source (`link`,
`list-unsubscribe`, `postmark-complaint`, `reply`, `staff`, `civicrm`),
and what it stops: one topic, or every email. From then on
`contact_permission()` says no for it, `contact_unsubscribes` lists it
on the supporter's page, and every message is checked just before it's
sent, so one scheduled before the stop is skipped with the reason. It's
kept after erasure. Only the person can reopen one, by ticking a box
later, on the preferences page or one of our forms, whose words are
kept; "No bulk emails" only on the preferences page. Nothing a staff
member records can reopen one.

## Getting more people to say yes

- Our own join form on pauseai.uk, with a "PauseAI UK can email me"
  box, still passing new members to Global. pauseai.uk brought in 351
  of the 427 UK signups in October.
- The Luma checkbox (`plans/supporters-phone.md`) covers the weekly.
  Registering for an event isn't a yes on its own: the charities' soft
  opt-in (PECR regulation 22(3A)) is for registered charities, and Safe
  AI Alliance Ltd isn't one.
- A postcode question on every Luma event, for events near the reader
  and their MP.

## Data protection

Record in `docs/data-protection.md`: the chapter contacts read from
CiviCRM, kept after erasure; our stops sent to Global, a disclosure to
a joint controller once the agreement is signed; email broadcasts, sent
through Postmark's broadcast stream; our join form as a new source; the
yeses staff record, with who recorded each and how it was given; and
every address and number we send to, from any source, sent to Global by
`checkSuppression` to check. The privacy policy should say we email
people who said yes, and how to stop, linking to the preferences page
as where to change your PauseAI UK email settings.

## Later, optional

- Tell Global about the 64 members CiviCRM doesn't return. On 10
  November all were in the UK in Airtable, had agreed to chapter
  sharing, weren't excluded or merged, and joined by the June 2026
  onboarding flow between July and October, most in September, while
  every newer member is returned.
- Discuss erasure with Global. When Global erases someone, CiviCRM
  keeps their address as a suppression record, so `checkSuppression`
  still blocks it, and their Airtable record goes, so our import
  removes the member. What we hold from our own sources, such as
  letters, Luma and our forms, stays until they ask us to delete it.
  Should either side tell the other of an erasure request?

## Open questions

1. Does removing someone from the Luma calendar stop organisers'
   invites to them? Organisers send Luma invites to most events, often
   to past guests, and how they pick them isn't known. Until we know,
   the preferences page says Luma's invites are separate.
