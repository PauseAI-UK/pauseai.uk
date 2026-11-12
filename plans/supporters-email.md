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
  - `updateSubscriptions`: our opt-outs sent back. Opt-ins only from the
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

## Outstanding outside the code

- Postmark: approval for broadcast sending on the `broadcast` stream,
  and its unsubscribe handling set to Custom. Asked of Postmark's
  support on 11 November (ticket 11645689); they warned of longer
  waits than usual. pauseai.uk's DKIM and Return-Path were verified
  on 11 November.
- Postmark: the broadcast stream's webhooks (bounce, spam complaint,
  delivery), once the code is merged.
- DMARC reports (`rua=`) and Google Postmaster Tools, before the first
  send.

## Phases

### 1. Import from CiviCRM

CiviCRM is one source among ours, like Luma or our forms. Each source
is stored as it told us, opt-outs are stored apart, and
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
pull doesn't copy them back, and keeps the opt-outs they made, as every
erasure does.

**How it changes the answers:**

| CiviCRM says | Our answer |
|---|---|
| `newsletter` `subscribed` | yes to the newsletter by email |
| `newsletter` `unsubscribed` | an opt-out from the newsletter, in `opt_outs` from `civicrm` |
| `newsletter` `not_opted_in` | no yes from CiviCRM, but not an opt-out: a yes from another source still counts. Signups before June 2026 move to it when Global's email-law note is approved |
| `newsletter` `not_on_list` | nothing from CiviCRM |
| `volunteer_updates` | the same, for volunteering by email |
| no longer returned | nothing from CiviCRM, and they're no longer a member, so their Airtable record stops counting too |
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
includes events; events only; and volunteering, each by email and text,
and volunteering by call too, as a newsletter or an event isn't a call.
`contact_permission()` answers those, and from this phase the
supporter's page, the supporters list's filters, the staff home's
counts and the "Consents" in Broadcasts show them, each yes or opt-out
with where it came from, when, and the box's words. Where each yes
comes from:

| Source | Newsletter | Events only | Volunteering |
|---|---|---|---|
| March form | email, text | | |
| Email your MP | email | | |
| Paper sign-ups | email, and text with a number | through Luma | |
| Join form's "Keep me informed" (CiviCRM `newsletter`) | email | | |
| Join form's intent (CiviCRM `volunteer_updates` for email) | | | email, call (phase 1½) |
| Following the Luma calendar | | email | |
| The preferences page (phase 3) | email, text | email, text | email, text, call |

### 1½. Members from CiviCRM

Global is to stop keeping members in Airtable, and CiviCRM's `get` now
gives each contact's member fields
([pauseai-civicrm#1324](https://github.com/PauseAI/pauseai-civicrm/pull/1324)):
`first_name`, `last_name`, `city`, `postal_code`, `joined_date` (a day)
and `intent` (`act_now`, `volunteer`, `lead`, `none`, or `keep_informed`
for a few old records), each null when CiviCRM has none. The current
join form doesn't ask for intent, so its members have `none`. It gives
`phone` too, the contact's primary number, for calls only
([pauseai-civicrm#1325](https://github.com/PauseAI/pauseai-civicrm/pull/1325));
texts wait for PauseAI/legal-pack#13. On 11 November every field matched
Airtable's for each of the 1,625 contacts linked to a member, numbers
included.

**What a member is.** A UK chapter contact that CiviCRM's latest complete
pull returns, whether or not Airtable has them (2 on 11 November weren't
in our Airtable import). For now, also a member in Airtable whom CiviCRM
has never returned (64 on 10 November), read by the Airtable import as
now. Someone whose contacts have all gone isn't a member, whatever
Airtable says, as `contact_permission()`'s `members_kept` already has it.

**This phase's pull request.**

- The migration first renames what holds Airtable's members, so the
  names say where the rows come from: `members` to `airtable_members`,
  `members_erased` to `airtable_members_erased`,
  `supporter_links.member_id` to `airtable_member_id`, and the
  `supporter_*_member` views to `supporter_*_airtable`. Postgres renames
  a table in views but not in a function's body, so it redefines
  `contact_permission()` and `merge_supporters_by_phone()`, and renames
  view columns named `member_id`; afterwards `schema.sql` has neither
  old name. Running code may fail for the moment of the deploy, which
  is fine.
- `readContact()` reads the seven fields, and `civicrm_contacts` keeps
  them as CiviCRM gave them, with no `_since`: `first_name`, `last_name`,
  `city`, `postal_code`, `joined_date` (a date), `intent` (checked
  against the five values) and `phone`. A value we don't know throws, as
  a flag does.
- CiviCRM wins where both sources have a value. The CiviCRM source's
  name is its first and last names joined, as we only ever show it whole.
  A new `supporter_contact_civicrm` gives its city and postcode, so
  `supporter_place` and the supporter's MP use them. Its history entry
  becomes "Joined PauseAI" on `joined_date`, a day with no time, with
  what they want to do in plain words (none for `none`), in place of
  "Shared with us by CiviCRM", which only said when our pull first saw
  them. A contact's going adds an entry, "Stopped sharing their details
  with PauseAI UK" on `gone_at`. Its number joins the supporter's
  numbers, which still merge supporters and show on their page. The
  Airtable views give a member's name, number, place and "Joined
  PauseAI" only for one with no CiviCRM contact, so nobody shows two of
  each. Nothing shows the page someone joined on, as CiviCRM doesn't
  give it: the import stops reading Airtable's "Source page", and
  `source_page` goes.
- The Member badge (`supporters_summary.member`) is a CiviCRM contact
  not gone, or a member in Airtable whom CiviCRM has never returned.
- The supporter's page names each source as it is: CiviCRM's as
  "Member", Airtable's as "Airtable", in the sources and in where a
  consent's yes came from.
- Volunteering by phone becomes calls only. The yes for a call is a
  contact's number with the intent `volunteer` or `lead`, or a number and
  intent ("Volunteer" or "Lead") from Airtable for a member CiviCRM has
  never returned; Airtable's members from before 30 June 2026, whose form
  didn't ask, count as now. The `volunteer_updates` list doesn't decide
  it, as it's about email. There's no volunteering yes by text, as Global says texts
  need a permission no join form has asked for; the consent stays, so a
  later migration can bring it back once PauseAI/legal-pack#13 is
  decided. The consent's explanation on the supporter's page changes
  with it.
- Every new or changed word on the staff pages and in the privacy policy
  is a placeholder for approval.

**Data protection.** In `docs/data-protection.md`, the row for UK chapter
contacts in CiviCRM adds their name, city, postcode, when they joined,
what they said they wanted to do, and their number, for calls only, for
the purposes the members row gives, and loses "no name, number or postal
address". The members row becomes Airtable's, used only for members
CiviCRM doesn't return, until Global stops keeping them there. The privacy
policy needs no change, as the same controller gives us the same data,
from another of its systems; check that it names no system. Erasure is
unchanged: deleting a supporter's `civicrm_contacts` rows takes the new
fields with them, and `civicrm_erased` keeps the pull from copying them
back.

### 2. Send our opt-outs back

Staff lifting a hold's block on the blocked addresses page lifts the hold
in CiviCRM too, if the API gives a way to, so the two agree.

Each new opt-out of ours goes to `updateSubscriptions`, retried until
it has a result, unless CiviCRM told us of it:

| Our opt-out | Sent as |
|---|---|
| The newsletter by email | `unsubscribe` from `newsletter` |
| Volunteering by email | `unsubscribe` from `volunteer_updates` |
| All bulk email: a spam complaint, from anyone, or the preferences page, staff or a reply | `no_bulk_email` |
| Events by email, or one topic by text or call | nothing |

Texts and calls stopped altogether go as `do_not_sms` and
`do_not_phone`, with WhatsApp sending (`plans/supporters-phone.md`,
"Opt-outs"). Only opt-outs go: a yes on our side, from any box, stays
ours, and CiviCRM's lists stay its own.

Luma sends its calendar's invites and newsletters itself. The daily
sweep of its followers against `checkSuppression` waits for
legal-pack#9 ("Later, optional"). Only the preferences page removes
someone from the calendar (phase 3).

### 3. The preferences page

The designs are in the [contact preferences
mockups](https://claude.ai/artifact/5cNFkmmGXHSy4fNfrUo1ni): asking for
a link, the page, arriving from an unsubscribe link, and the page with
"No bulk emails" or "Do not email" set.

**Links.** The emailed link works for 7 days, as often as it's opened.
An email's unsubscribe link opens the same page, with one button in the
box at its top that stops the email's topic; a GET changes nothing, as
link scanners open links nobody clicked. That button works forever. The
rest of the page works for 30 days after the email went; after that the
page offers to email a fresh link.

Anyone can enter their email address and be emailed a link to a page
where they see and change what they get. Asking for the link takes
Turnstile, so the form can't be used to send our mail to anyone
(`docs/domain-concepts.md`, "Form entries").
Every unsubscribe link opens it too, and staff send it to anyone who
asks them to change their emails. It says clearly and simply what we
will and won't send them and why, whatever the source, CiviCRM's flags
and Global's lists included, and what each choice changes, Global's
mail too. It offers each of our topics by each of its ways, and stopping
everything. It says Luma's invites are separate (open question 1).

It describes what we know of Global's own emails from CiviCRM: the
PauseAI Newsletter, Critical Alerts (the urgent emails) and Local
Invitations. Stopping all bulk email sends `no_bulk_email`, which stops
all of them for that address, though Global's staff can still email
them one to one; `do_not_email` stops that too. Global has no page for
changing its emails one by one, so ours says to use the unsubscribe
link at the foot of their emails.

The page opens only from a link emailed to the address, so a tick there
is the address's owner saying yes. Each tick is a yes with the
preferences page as its source, with the topic and way, the date and
the box's words, kept beside the others. The latest wins, so it reopens
an older opt-out.

- Lifting "No bulk emails" goes as `allow_bulk_email` with the box's
  words, which turns Global's bulk email back on too, as the page says.
- An events-only email yes is ours alone: our events broadcasts use it,
  and it doesn't add them to the Luma calendar. Turning it off, or
  stopping all bulk email, removes them from the calendar at once, by
  Luma's Remove
  ([contacts](https://docs.luma.com/reference/post_v1-calendars-contacts-remove)),
  on production. Removed contacts can still register for events, and
  can follow again themselves.
- A volunteering yes is ours alone.
- A text or call yes is for a number the email link doesn't prove is
  theirs.

**A yes from someone with "No bulk emails".** When someone ticks the
email box on the march form, Email your MP, a paper sign-up form or the
Luma checkbox (once it's built: `plans/supporters-phone.md`, "Asking on
Luma") but has "No bulk emails" set, their entry is stored as
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

**Sending.** Postmark's broadcast stream, ID `broadcast`
([streams](https://postmarkapp.com/message-streams)), on the site's
Postmark server, hard-coded beside the transactional stream's
`outbound`, for about $200–300 a year
([pricing](https://postmarkapp.com/pricing)). It sends from
`hello@pauseai.uk`, and pauseai.uk is a verified sending domain in
Postmark, beside `letters.` and `notify.` (`docs/development.md`,
"Postmark"). Until Postmark approves broadcast sending, it refuses each
message, and the broadcast stops as any does. `hello@` is connected as a
staff Gmail, so the site reads its replies.

The broadcast stream has the webhooks the site's own emails have
(`lib/server/postmark-webhooks.ts`): delivery, for the delivered count;
a bounce, marking the message failed and, if hard, blocking the
address; and a spam complaint, which is an opt-out (Opt-outs).

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
opt-outs within a few days.

Replies are kept in `broadcast_replies`, each with the message it
answers, whatever the channel, so WhatsApp's replies join the same table
(`plans/supporters-phone.md`). For email it's the whole message, in
Netlify Blobs as the letters' replies are. Each reply has two buttons,
Record as an opt-out and Nothing to do, and waits to be looked at until one
is pressed; an automatic reply never waits. Record as an opt-out is staff
unsubscribing the person for them, as a reply asking to stop is an opt-out.
It offers a choice: what that email went under (the default), or all
bulk email, which goes to CiviCRM as `no_bulk_email`. Only the person
can undo either. Where staff see them:

- the broadcast's header, a fourth tile beside delivered, failed and
  stopped: how many replied, and in amber how many are still to look
  at, which lists those recipients;
- the Recipients table: a Replied tag, or an amber Reply to look at,
  those rows first;
- the Thread page: the reply under our email, with Reply, Opt out ▾ and Nothing to do, and
  in the History who dealt with it;
- the supporter's page: Replied in their Broadcasts table;
- the staff home's needs a person: how many replies are to look at.

**Answering replies.** Staff answer a reply to an email broadcast on its
Thread page, rather than in `hello@`'s Gmail; replies to texts reuse it
(`plans/supporters-phone.md`, step 6). The answer goes from the address the
broadcast went from, by Gmail, in the reply's thread (`In-Reply-To` and
`References`), so it shows in that mailbox's Sent and the person's
conversation. It's kept under the reply, with who sent it, and a reply
that answers it joins the same thread. Anyone with the `supporters`
permission can answer. Sending one settles the reply (a fourth outcome,
`answered`), unless it was already recorded as an opt-out.

Reading the mailbox mustn't take our own answer, now in the thread and in
Sent, for a reply to the broadcast: one from our own address, or whose
Message-ID is an answer we sent, is skipped. Nor is anything kept twice:
the thread is read again whenever a new message joins it, so each message
is kept once, by its Gmail ID, as replies are now.

The page: under a reply, Opt out ▾ (the shared menu: what the email went
under, or all bulk email) and Nothing to do, then the answer, folded to
one line, "Write a reply…", at the foot of the thread, which opens into a
draft shaped as the sent email will be, From, To, "Re:" subject, the
broadcasts' editor without merge fields, Send reply and Discard. Cmd+Enter
(Ctrl+Enter off a Mac) sends it, as in Gmail. Replying and opting out go
together: one recorded as an opt-out can still be answered, and one
answered can still be recorded as an opt-out. Built
(`lib/server/broadcast-answers.ts`).

**Which consents a broadcast goes to** (phase 1). A newsletter or
events broadcast goes to newsletter, events or both, and one to both
must be about events, which the writer says. "Newsletter or events
only" is one more choice in the writer's Said yes to and the list's
Consent filter, by email or by text, with a required tick that it's
about our events. No other pair: a broadcast to two topics must suit
both, and only an event invitation suits these two. Volunteering goes
on its own. Each message records which yeses it went under, and its
unsubscribe stops all of them.

**Checking suppression.** `checkSuppression` runs just before every
broadcast, on every address, including those from Luma or MP letters,
as the joint controller agreement (2.6(f)) requires. It drops `all` and
`bulk`, and each is kept as a block of ours. If CiviCRM doesn't answer,
nothing is sent unchecked: the broadcast waits, retrying with a growing
gap, staff are told once that it's waiting and why, and its page says
it's waiting for CiviCRM, and since when. The same goes when no pull
has completed for 24 hours. It sends by itself if CiviCRM answers
within three days of its scheduled time; otherwise it stops as any
broadcast does, listing who it didn't reach, and whoever scheduled it
is emailed. Three days is the limit for every broadcast, email or text,
fixed and set by nobody, as `plans/supporters-phone.md` describes for
texts: the scheduled page says quietly when it will stop.

**When it goes.** With the hourly `send-mailings` run, as mailings to
politicians do (from 06:18 UTC, at 18 minutes past), by Postmark's batch
sending. Transactional emails, such as a login link or a letter's
confirmation, don't check: they go even with "Do not email" set, so
checking could only delay them. Phase 1 has `contact_permission()` answer CiviCRM's flags for
broadcasts' consents; this phase makes `send()` refuse other one-to-one email to an address
with "Do not email". What the person just asked for is transactional and
still goes: a login link, a preferences link, a letter's confirmation,
and their MP's replies to a letter they sent, which to them is mail from
their MP that we pass on.

**A yes given another way**, such as at an event or in an email, isn't
recorded by staff: they point the person to the preferences page, where
the person ticks it themselves.

### 5. Personal broadcasts

More filters and lozenges in Broadcasts, so an email can carry such
things as events near the reader, the main events with how many have
signed up, and their MP. Deliberately not specified yet.

### 5½. Drop Airtable's members

Once CiviCRM returns every member, drop the Airtable import.

- Tell Global about the members CiviCRM doesn't return, in a comment on
  PauseAI/pauseai-civicrm#1175 with their Airtable record IDs (private
  there, never here): our members with no CiviCRM contact once the import
  has run on production. On 10 November there were 64: all in the UK in
  Airtable, agreed to chapter sharing, not excluded or merged, and joined
  by the June 2026 onboarding flow between July and October, most in
  September, while every newer member is returned.
- Once CiviCRM returns them, a member's "Keep me informed" stops counting
  for the newsletter, as CiviCRM's `newsletter` list answers for every
  member, and `contact_permission()` loses that rule.
- Then drop the import (`import-members`, `fetchMembers()`),
  `airtable_members`, `airtable_members_erased`,
  `supporter_links.airtable_member_id` and the Airtable views.
  `civicrm_erased` keeps erased people out from then on. The CiviCRM
  source is the member source, and the supporter's page no longer shows
  "Airtable" as one.

### 6. The weekly, scheduled each week

The weekly is scheduled automatically each week.

## Opt-outs

PECR wants a simple way to stop in every email. Google wants a visible
link and one-click headers from anyone sending 5,000 a day, which we do
from the start, and spam complaints below 0.1%, never reaching 0.3%
([sender guidelines](https://support.google.com/a/answer/81126)). As
for texts (`plans/supporters-phone.md`, "Opt-outs"), an opt-out reaches us
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
  it as an opt-out.
- Any other way, such as a word at an event. Staff record it, with how
  it was given.
- CiviCRM, by the hourly pull: an unsubscribe there, or a flag
  (phase 1).

Each opt-out is a row in `opt_outs` with its source (`link`,
`list-unsubscribe`, `postmark-complaint`, `reply`, `staff`, `civicrm`),
and what it stops: one topic, or every email. From then on
`contact_permission()` says no for it, `contact_unsubscribes` lists it
on the supporter's page, and every message is checked just before it's
sent, so one scheduled before the opt-out is skipped with the reason. It's
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
CiviCRM, kept after erasure; our opt-outs sent to Global, a disclosure to
a joint controller once the agreement is signed; email broadcasts, sent
through Postmark's broadcast stream; our join form as a new source; the
opt-outs staff record, with who recorded each and how it was given; and
every address and number we send to, from any source, sent to Global by
`checkSuppression` to check. The privacy policy should say we email
people who said yes, and how to stop, linking to the preferences page
as where to change your PauseAI UK contact preferences.

## Later, optional

- Ticks for Global's lists (the PauseAI Newsletter, Critical Alerts,
  Local Invitations) on the preferences page: Global's spec offers to
  add them to the API if our page shows them.

- Once legal-pack#9 is decided: a daily sweep of the Luma calendar's
  followers against `checkSuppression`, removing anyone blocked, as
  Global's spec asks for lists a provider sends on its own schedule. On
  11 November, 7 of 3,178 followers had "No bulk emails" or "Do not
  email" in CiviCRM.

- Delete members CiviCRM stops returning, as the API's spec asks: once a
  week has passed since a complete pull first left them out, delete their
  `civicrm_contacts` rows, and while the Airtable import lasts, their
  `members` rows, with the import skipping them. Phase 1 marks the
  contact gone, and their records stop counting at once.

- Discuss erasure with Global. When Global erases someone, CiviCRM
  keeps their address as a suppression record, so `checkSuppression`
  still blocks it, and their Airtable record goes, so our import
  removes the member. What we hold from our own sources, such as
  letters, Luma and our forms, stays until they ask us to delete it.
  Should either side tell the other of an erasure request?

## Open questions

1. Does removing someone from the Luma calendar stop organisers'
   invites to them? Luma says a removed contact is opted out of the
   calendar's invites and newsletters, but organisers send invites to
   most events, often to past guests, and how they pick them isn't
   known: a pasted list may not be checked. Until we know,
   the preferences page says Luma's invites are separate.
