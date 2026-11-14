# Domain concepts

The things the site's features are built from, and how far each is
generalised. A new feature should use these, or grow one, rather than make
its own: a new kind of email is a new purpose of the one email concept, not
a second email system. The features themselves are listed in the README;
where code goes and how it's written is in `docs/code-structure.md`.

Each section says what the concept is, where it lives, how to add another
of its kind, and what it doesn't cover yet.

## A full history of everyone

We keep the whole history of our activity with everyone: every letter,
email, signature, meeting and status, for politicians and supporters
alike. A record is never deleted because it stopped being current. A
politician who leaves office, a person a source no longer lists or an event
taken off Luma is marked as such and kept, along with everything that points
at it. What came from an outside source says which one, so a page can say
"from Airtable" rather than present it as something staff set. The one
exception is erasure: a supporter who asks to be forgotten is removed
(`docs/data-protection.md`).

What a letter said is kept where we need it to do the job:

- A supporter's letter to their MP, and every message between them and the
  MP's office, are kept whole, as the site relays them ("Letters", below).
  They can show the supporter's political opinions and personal
  circumstances, so only staff with `supporters` see them, and erasure
  deletes them.
- Letters sent before the letters inbox have their text too, copied once
  from Airtable's copy or the one Bcc'd to the policy team ("Old letters",
  below).
- A letter PauseAI sends a politician, and their reply, are kept in full,
  since they're our own words and a public figure's answer in their public
  role.
- Every other thread with a politician in the policy team's mailboxes is
  kept in full too ("One-off emails", below).

## Notable people and politicians

Everyone we campaign at is a notable person (`notable_people`). For now
they're all politicians: MPs, peers, MSPs, members of the Senedd and the Northern
Ireland Assembly, and others (`HOUSES` in `lib/politician-filters.ts`).

A notable person has what all kinds share:

- a name as they're known in public, with any title that's part of it
  ("Lord McFall of Alcluith");
- a salutation, which follows "Dear" ("Sir Iain", "Lady Smith", "Bishop"):
  made by a rule from what their body lists (`lib/salutation.ts`), which
  staff can correct. Where the rule can't tell, as for a new MSP or member
  of the Senedd whose gender Wikidata doesn't know yet, it's their name,
  marked to check (`salutation_to_check`), and made again once it can.
  Where their body records their title (an MP's in Parliament's list name,
  as "Badenoch, Mrs Kemi"; every MLA's), that's how they asked to be
  addressed, so each import makes their salutation from it, over ours,
  unless staff have set ours by hand. Then it keeps ours, and reports the
  difference as a problem on the run, for staff to check. Gender is read
  only to choose Mr or Ms, never kept;
- an email, if we know it;
- notes;
- Airtable's markers (important target, personal connection), which staff
  turn on and off in the band at the top of their page;
- a status: `in_office`, `died`, `retired` or `left_office`.

A politician (`politicians`) adds a house, a constituency if they have one,
a party and a country. The child row joins its parent by a composite foreign
key `(id, kind)`, so it can only be the kind its parent says. Everything
else points at the parent. So a new kind of notable person, such as
journalists, is a new value of `kind` and a child table, and changes nothing
else. A politician who leaves office is marked, never deleted, so their
history stays.

Where they come from:

- **Each body's own list**, imported nightly
  (`lib/server/politician-import.ts`): Parliament's, both Houses, from its
  Members Data Platform; the Scottish Parliament's, the Senedd's and the
  Northern Ireland Assembly's, from their open data. Each politician keeps
  the ID their body gives them (`politicians.official_id`; the Commons and
  the Lords share Parliament's), and is matched by it, or the first time by
  name, and an MP by their seat. An import adds new members, updates names,
  parties, seats and emails, and marks those no longer listed as having left,
  with why, where Parliament says. It's held for staff to apply or discard if
  it would change more than 20 politicians at once, rename anyone, or give an
  MP a constituency that isn't the ONS's name for it, as no postcode would
  find them. Parliament's import also checks every constituency has one MP in
  office, keeps the test MPs in step, and, like each import, saves each
  address and domain the body lists, which say whose a one-off email is, then
  relinks the one-off emails ("One-off emails", below).
- **A politician's email** stays as it is while their body lists it, or lists
  none, or never listed it (a Lord's own address, found by staff); it moves to
  the one the body lists only once the body stops listing it. The House of
  Lords' shared inbox, which most Lords list as their only address, is never
  anyone's: a check constraint refuses it (`SHARED_INBOXES` in
  `lib/one-off.ts`). Staff set a Lord's email by hand.
- **Airtable's UK Parliamentarians**, which the policy team kept, is no
  longer read. Its salutations, markers and notes were copied before then;
  each politician who was in it keeps their record's ID (`airtable_id`).
  Nobody is deleted: a politician who leaves their body is marked as left.
- **Test MPs** are fixed, each found by a test postcode (`lib/test-mps.json`,
  ZZ99Z\*) and each standing for one case: an ordinary MP, one who has
  signed, one with no email, one whose email bounces. A new case that a
  person would see gets a new test MP.

Only an MP in office in the Commons is found by postcode. Writing to anyone
else would need a way to find them (a region for an MSP, a list for peers).

The politicians list and the top of a politician's page count their emails
each way. Both show the same two numbers, counted in SQL for every
politician at once (`lib/server/politician-email-counts.ts`):

- **Emails to them**: the letters to them that went, supporters' and
  PauseAI's, and each message on their one-off threads ("One-off emails",
  below) from anyone but their office.
- **Emails from them**: each message kept on a letter's thread that isn't
  ours, the supporter's or an automatic reply, and each one-off message from
  their office that isn't ours or, going by its subject, automatic. Their
  office is an address of theirs, one on a domain of their own, or any
  parliament's address. A letter marked answered (`replied_at`) with no
  message of the answer kept counts none.

The list sorts by them as `sort=emailsToThem` and `sort=emailsFromThem`.

The list's First activity and Last activity are the first and last time we
did something with a politician, or they with us (`POLITICIAN_ACTIVITY` in
`lib/server/politicians.ts`): a letter written to them, their reply to one,
their answer to an ask, on the day it was given if we know it, or a one-off
message that counts as an email to them or from them, above. So someone
whose only contact is a one-off thread has both dates, and the sort by
either finds them.

## Asks

Something we ask notable people to do whose answer we record: sign a
letter, come to an event (`asks`, `lib/asks.ts`). Each has a slug, a title,
a kind (`letter` or `event`), a date, a link to the letter or the
event, and who asks it. That's one or more of:

- supporters, in their letters or in person;
- PauseAI, in its own emails;
- ControlAI, for its own statement and letter.

Staff add, change and delete asks on `/staff/asks`, or from a mailing's Ask,
within these rules:

- The slug is made from the title and the date's month and year, and never
  changes.
- The kind is fixed once anyone has answered.
- An ask can be deleted only while no answer, campaign or mailing refers to
  it.
- The asks `lib/asks.ts` names (`NAMED_ASKS`: the Frontier AI letter and
  ControlAI's letter) can be changed there but never deleted, as campaigns,
  the public list of signatories and the ControlAI import depend on them.

A person's answer to an ask is a status (`ask_statuses`): one row per
person per ask, with a status, a date, a note, and who set it. Someone who
hasn't answered has no row. Each kind allows its own statuses
(`ask_kind_statuses`, mirrored by `ASK_STATUSES`): a letter allows `signed`,
`other` or `declined`, and an event `going`, `other` or `declined`. An
`other` answer's note says what it was,
such as "Tentatively said yes". A foreign key on `(ask_kind, status)`
refuses any status not in that table, and a new status is a row there.

Staff set statuses by hand, with a note, for every ask but two, which
imports set from controlai.org (`IMPORTED_ASKS`, `updated_by` `controlai`):
ControlAI's letter to the Prime Minister, from the names in its PDF
(`lib/server/controlai-import.ts`), and its UK campaign statement, from its
page's links to each supporter's page on their body's site, by the ID their
body gives them or the name in the page's address
(`lib/server/controlai-statement-import.ts`). As every sitting politician is
on our list, a link the statement's import matches to no one is a problem of
its run. Statuses with `updated_by` `airtable` were copied from Airtable's
records before the site kept answers itself. Staff change them like any
other.

`/staff/asks` lists the asks, newest first: who asks each, how many gave
each answer, how many were written to and how they were asked. An ask's own
page (`/staff/asks/[slug]`) says what was asked, in the words a politician's
page uses, then lists the campaigns and mailings that put it, by date,
beside its answers. It has no letters of its own. Its form is at
`/staff/asks/[slug]/edit`.

## Campaigns

One letter many supporters send, for an ask or for none (`campaigns`): sign
the letter to the PM, come to the Sobel bill's debate. Each is keyed by its
slug, which its page's URL and its letters use, and its row names its ask.
The rest is copy, in code (`campaigns` in `lib/content/email-your-mp.ts`):
its letter, subject and attachments. A campaign an MP can have done also
names the status of its ask that means they have. A test checks each
campaign in code has a row with the same title and ask. pauseai.info's old
campaigns have a row and no code.

The list in code is in priority order: a person writing to their MP is
shown the first campaign whose ask that MP hasn't met. So the last campaign
is one nobody has done, and there's always one to move on to.

A new campaign is an entry in that list, its row in a migration, its page
in `app/(site)/campaigns/<slug>/`, and a link in the nav.

Staff see a campaign as a mailing, from supporters rather than PauseAI.
`/staff/campaigns` lists them under the month of each one's most recent
letter, with a mailing's counts. A campaign's page
(`/staff/campaigns/[slug]`, `lib/server/campaigns.ts`) has:

- its header;
- how many answered its ask;
- "The letter", with each version of its text and how much people changed it;
- "Letters", the list its counts choose among.

A campaign in the code's list has one version, the code's text. One of
pauseai.info's old campaigns has a version for each commit of its form that
was live when a letter was written
(`FORM_VERSIONS` in `lib/content/pauseai-info-form.ts`).

## Letters

Every letter to a notable person is a row of `letters`: its kind, the
person, when it was made and sent, and its status. Any letter's status can
be `sending`, `sent`, `uncertain`, `not_sent`, `bounced` or
`spam_complaint`. A supporter's can also be `queued`, and PauseAI's
`scheduled`, `cancelled` or `skipped`. Everything that happened to a letter
is logged (`letter_events`), replies and automatic replies included. A child
row adds what its kind has, joined as notable people are:

- **A supporter's letter** (`letters_from_supporters`): the campaign and subject,
  and the form entry of the person who sent it (`entry_id`; "Form
  entries", below), which holds their name, email, address, postcode and
  consent. Each sender email can send one letter per campaign, except to a
  test MP. A letter goes through the letters inbox, and its row names the
  supporter's proxy (`proxy_id`; "Letters through the letters inbox", below).
  Two older kinds are kept, and nothing sends more of either:
  - **Letters sent by Postmark**, each from an address of its own on
    `letters.pauseai.uk` (`postmark_mailbox`), with the sender on Cc. A
    reply to that address is forwarded to the sender and the policy
    team (`forwardReply`, `lib/server/postmark-webhooks.ts`). A person's reply
    is also kept whole on the letter, as one read from Gmail is. It's kept
    from the whole message, which Postmark's inbound webhook carries when
    the server has `RawEmailEnabled` on. The kept reply's account is the
    letter's own address, and it has no Gmail IDs. Our forward of the reply,
    read from policy@, isn't kept again.
  - **Letters sent through pauseai.info's old form**, copied once from
    Airtable, each keyed by its record (`airtable_id`).

  Both kinds have their text in `letter`, copied from the mail they went
  as ("Old letters", below). A form letter also has, in `draft`, the form's text that was live
  when it was written. So its page shows what its writer changed, as the
  page of a letter through the letters inbox does.

- **PauseAI's letter** (`letters_from_pauseai`): one person's letter of a mailing
  (`mailings`), which may make an ask. A mailing was either copied from
  Airtable or written on the site.

  The letters sent before the site could send them were copied once from
  Airtable's Emails table. A copied letter has who it was to, when it went
  and whether it was personalised, and its text only if it was found in
  the mail ("Old letters", below). Each mailing in Airtable was a tick box,
  named by `mailings.airtable_field`, or with no box, the dates it was sent
  in (`airtable_sent_between`).

  A mailing written on the site (`lib/server/mailing-drafts.ts`) is a
  draft from the moment New mailing is pressed. A draft holds:
  - The politicians ticked for it on the politicians list, by ID
    (`StoredFilter`'s `picked`). That's a fixed list, which a later
    by-election doesn't change. When everyone a filter found was ticked, the
    draft also keeps that filter, the day and who it found, so the mailing
    can say who it's to as that group, plus or minus a few
    (`lib/mailing-picks.ts`). A draft made before ticks holds the list's
    filter instead, as its URL parameters, until its first tick.
  - Its letter, a document with merge fields and parts only some
    recipients get (`lib/mailing-doc.ts`).

  A draft is saved with a version number until it's scheduled. Scheduling
  fixes its recipients: each gets a scheduled PauseAI letter, which keeps
  the values its fields had. Those with no address, or a blocked one, are
  left out.

A letter's ask is its campaign's or its mailing's, never its own.

**A letter's history** is its events, shown on its page newest first,
each with what it recorded (`historyOf` and `LetterHistory` in
`app/(staff)/staff/_components/LetterHistory.tsx`; how they're laid out
is in `docs/style-guide.md`, "A history").

### Letters through the letters inbox

Supporters' letters go to MPs from the letters inbox, a Gmail account used
for nothing else (`LETTERS_INBOX`, `lib/server/letters-inbox.ts`). Each
side sees the other only as a proxy, a plus address on the inbox
(`proxies`, `lib/server/proxies.ts`):

- the MP gets the letter from
  `"Jane Smith (via PauseAI)" <letters+jane.smith@…>`;
- the supporter gets the MP's replies from
  `"Meg Hillier MP (via PauseAI)" <letters+meg.hillier.mp@…>`.

The MP's office never sees the supporter's address. A supporter's proxy is
keyed by their email address, so it's the same in every letter, and it's
named from the name on their first letter. An MP's proxy is named the first
time they're written to, and kept.

- **Sending** (`lib/server/mp-letters.ts`, `letter-sending.ts`): a letter
  that passes the form's checks is kept, `queued`, and never deleted for
  failing to send. The request tries to send at once, in two steps:
  1. The letter, from the supporter's proxy to the MP alone.
  2. The supporter's copy, from their proxy to them, with Reply-To the MP's
     proxy and a line above the letter saying what it is. So Reply and
     Reply all reach only our proxies. The copy is addressed to the
     supporter, not Bcc'd, as Outlook more readily files as junk the mail
     its reader is only Bcc'd on.

  What can't go waits, with its reason: the letters inbox isn't connected,
  it's at its daily limit (1,950 of Google's 2,000, `LETTERS_DAILY_LIMIT`),
  Gmail failed, or the MP's address is blocked. The sent page says the
  letter will go. The `send-mailings` job, every 15 minutes, works through the queue:
  relays first, then letters, oldest first, then copies.

  Each letter keeps the draft the form began with, rebuilt on the server
  (approximate if a deploy changed it since the form opened), and the share
  of its words that are the supporter's own. Its page shows only what they
  changed, with the paragraphs they left alone folded (`LetterChanges`).

- **Reading and relaying** (`lib/server/letters-inbox-reading.ts`,
  `relays.ts`): `read-gmail`, every 5 minutes, reads the letters inbox, Spam
  included, as all of its mail is ours. What it relays:
  - A message from the MP's office (Parliament's domain, or the address the
    letter went to) to the supporter's proxy goes to the supporter from the
    MP's proxy, in the thread of their copy.
  - A message from the supporter, to either proxy, goes to the MP from the
    supporter's proxy, naming the letter.
  - An automatic reply goes on either way too, keeping the marks that stop
    responders answering it.

  A relay is the same message, byte for byte, with only the headers ours
  (`relayMime`), and nobody the office copied in gets it. Only mail that
  Google found passes DMARC (or, with no policy, aligned SPF or DKIM, or
  DKIM by the domain's Google Workspace) is relayed. From an MP's own
  domain, DKIM by Caseworker MP, the casework service many offices send
  through, is enough too. That's read from the first `Authentication-Results` field in the
  message, which is Google's, each result from its own clause
  (`authenticated`): the fields below it, and much of what Google's own
  repeats, are the sender's to write.

  The letter a message is for is the first of these that gives one:
  1. the supporter's only letter to that MP;
  2. the letter the IDs it names belong to;
  3. the letter in its Gmail thread;
  4. a letter that a Case Ref in its subject was seen on;
  5. a letter whose subject is in its subject;
  6. the latest letter, as an uncertain match.

  Every message is kept whole (`letter_replies`, Netlify Blobs). Each relay
  is a row (`letter_relays`), recorded before it's sent, so a run that stops
  between the two is shown as uncertain rather than sent twice. A letter's
  relays are capped at 5 an hour and 20 a day (`RELAY_CAP`), so a loop of
  automatic replies stops.

  Each message is labelled in Gmail and archived, but for mail the read
  can't account for: an unknown proxy, a stranger, a forgery, one over the
  cap, or a bounce of nothing we sent or of an address our email didn't go
  to. That mail is labelled "Not
  understood" and left in the inbox. It's a problem of the run, which lists
  each message with a link to it in Gmail and emails the notification inbox
  once ("Email", below). Spam to no letter is only counted.

- **Bounces**: when the letter, or a relay to the MP, bounces hard, the
  site blocks the MP's address, emails the notification inbox, and tells
  the supporter, in our own words, in their copy's thread. Once staff
  unblock the address, or the MP's address changes, what bounced goes again
  and the supporter is told (`resendAfterFix`).

  That lasts a week (`RESEND_DAYS`), from when the letter was written, or
  the relay came. Past it, what bounced never goes again, whatever happens
  to the address, and the hourly run tells the supporter so, once
  (`tellOfNotResent`): a letter months old would otherwise go the day
  someone corrected an address.

  When the supporter's copy, or a relay to them, bounces, the site blocks
  their address and holds later relays to them, in case staff unblock it.
  A day on, if a relay is still held, the MP's office is told once that it
  can't be passed on, from the supporter's proxy in the thread of their
  reply (`lib/server/held-replies.ts`).

  A soft bounce is only noted.

### How a copy went

A broadcast's copy to a supporter, a mailing's letter to a politician and a
campaign's letter from a supporter are each one copy of something sent to
many. What became of each is said the same way, in states that each have a
meaning, a colour and a count:

| State        | Colour | Means                                                                                                                                   |
| ------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| scheduled    | grey   | still to go                                                                                                                             |
| sending      | grey   | going out now                                                                                                                           |
| sent         | grey   | it went, and nothing has come back                                                                                                      |
| delivered    | green  | the provider says it arrived (Postmark and WhatsApp say so; Gmail never does)                                                           |
| read         | green  | WhatsApp says they read it                                                                                                              |
| replied      | green  | they replied: a state like the others, a good one, not a second tag                                                                     |
| answered     | green  | a letter's politician has answered its ask, however they told us                                                                        |
| to check     | blue   | they replied and no one has dealt with it yet, for copies whose replies can be dealt with                                               |
| opted out    | red    | this copy made them stop: pressed Stop, replied "stop", marked it as spam, unsubscribed                                                 |
| marked spam  | red    | a politician's office marked our letter as spam                                                                                         |
| error        | red    | our side broke: the provider refused it, a send was cut off so we can't tell if it went, or we gave up                                  |
| didn't reach | amber  | their address or number turned out dead on this send: a bounce, or a number not on WhatsApp                                             |
| not sent     | grey   | not sent, as expected: they'd opted out before, their consent ended, the address was already blocked, there's no address, we stopped it |

The principles:

- **One state a copy.** A copy shows one tag, and is in one count. Where
  more than one applies, the first in this order wins: to check, opted
  out, marked spam, error, didn't reach, not sent, answered, replied, read,
  delivered, sent. So a reply to check is never hidden, and a letter that
  didn't go says so though its politician answered.
- **The colour says how it feels**: red bad, amber sad, green good, blue
  for staff to do, grey normal (`docs/style-guide.md`, "Status colours").
  A count's number is on its tags' colour, so pressing it lists tags all
  that colour.
- **The tag says why after a colon** where there's a why: "Not sent:
  consent ended", "Didn't reach: not on WhatsApp". The copy's own page
  keeps the whole story, with the provider's own words.
- **Went and didn't go.** On its page, the counts fall in two groups: those
  that went (sent, delivered, read, replied, answered, to check, opted out,
  marked spam) and those that didn't (error, didn't reach, not sent). A
  count of none isn't shown. A list of many shows only the red, amber and
  blue counts, and folds the rest into how many are fine.
- **Expected isn't bad.** A copy not sent for a reason we knew before it
  went (an earlier opt-out, a blocked address, no address) is grey, not
  red. Red is for what this send itself broke or caused.

The states, their colours and their words are one set (`lib/copy-states.ts`,
`staffCopy.copyStates`), and each copy's tag and the counts come from it
(`CopyStatus.tsx` and `CopyCounts.tsx` in
`app/(staff)/staff/_components/`). Each kind adds its own: a broadcast's
copies are delivered, read, opted out or to check, worked out in
`lib/server/broadcast-pages.ts`; a letter is answered or marked spam, and
has no "to check", as nothing marks a reply to it dealt with. A letter's
state is worked out twice, in TypeScript for its tag wherever it's shown
(`letterState`) and in SQL for counting and listing by state
(`letterStateSql`), and a test checks they agree for every status.

Gmail refusing a mailing's letter keeps no reason, so its tag says Gmail
refused it, and not Gmail's own words, as a broadcast's page can.

### Broadcasts to supporters

A broadcast is an email or a text to many supporters at once, and each
supporter's copy of it is a message (`broadcast_messages`). A broadcast is a
row of `mailings` with the audience `supporters`. To staff it's apart from a
mailing, in its own place: Broadcasts, at `/staff/broadcasts`, under
Supporters, behind the `supporters` permission. Mailings to politicians are
open to every staff member, so their pages, actions and the `send-mailings`
job all leave broadcasts out.

- **Channel and topic.** A broadcast has one channel and one topic, which
  together are its Consent: one topic, answered yes (`broadcastTerms` in
  `lib/broadcasts.ts`). "Not sure" isn't enough. One more choice goes to
  the newsletter's and events' yeses both ("Newsletter or events only",
  `alsoEvents`), as only an event invitation suits both: it can't be
  scheduled until staff tick that it's about our events. A draft is made in two
  ways:
  - New broadcast (`/staff/broadcasts/new`) is the writer with nothing in
    it yet but Said yes to. Choosing a Consent there makes the draft.
  - The supporters list's Broadcast button makes one too, when the list's
    Consent filter is answered yes.

  While a broadcast is a draft, the writer's Said yes to changes its
  Consent. It changes to the other channel only while the draft has no
  words of its own (`hasWords`), and that starts the draft afresh. Staff
  choose email or text, never the backend.

- **Who.** A broadcast goes to those the supporters list's filter finds. The
  filter is kept as its URL parameters, and there are no ticks. With no
  other filters, it's everyone who said yes. Narrow down, or Change who
  once it's narrowed, opens the list to choose for the draft. The Consent filter is locked there, as it's the
  draft's, and loading a saved filter keeps it.

  Scheduling doesn't fix who a broadcast goes to. Sending finds them when
  it starts: those the filter finds whom `contact_permission()` says yes
  for (`lib/server/broadcast-recipients.ts`), with a row of
  `broadcast_messages` for each. So it reaches whoever the filters find
  then. Until it's sent, the list of broadcasts and the broadcast's page
  count who the filters find now.

- **Fields and parts.** The fields are First name and Name. No field is one
  that every supporter has, so each has a fallback, and a broadcast can be
  scheduled with a field some recipients lack, unlike a mailing to
  politicians. A part of an email can be only for, or for all but, those who
  wrote to their MP in a campaign, or those who registered for one of our
  events, past or to come (`broadcastParts()`). Each field and part is a
  condition (`has:firstName`, `wrote:<campaign>`, `event:<id>`), and the
  preview has a button for each condition the words use.
- **A text's words** are a WhatsApp template (`whatsapp_templates`). It's
  either an approved template, chosen in the writer and read-only there, or
  new words, which staff send for approval from the foot of the writer.
  Until WhatsApp decides, the new words can't be changed, only withdrawn,
  and the text can't be scheduled. When words are sent for approval, and
  when WhatsApp decides, an email with the words goes to whoever sent them
  and to the notification inbox. A template has no parts that only some
  people get, as its words are the same for everyone. New words go to
  WhatsApp (`createTemplate`) as a marketing template in British English,
  named by its name and ID in WhatsApp's lower case (`meta_name`), each
  field a named parameter (`{{first_name}}`) with an example, and the
  footer every text has, "Reply STOP to stop these texts"
  (`TEMPLATE_FOOTER`), so any template can go under any topics. If
  WhatsApp doesn't take them, the
  draft is as it was, and says so. Withdrawn, they're deleted there too.
  WhatsApp's decision comes by its webhook, and each run of the sending asks
  it too while a template waits or a text is to go, in case a webhook went
  astray (`lib/server/whatsapp-templates.ts`). A rejection is put in plain
  words with what to do. Once approved, WhatsApp can pause or disable a
  template for its quality, which stops every text on it (`wait_reason`
  `template`), and approve it again.
- **Sending** (`lib/server/broadcast-sending.ts`). The 15-minute
  `send-mailings` run starts each broadcast that's due, as it does
  mailings, none overnight: a copy for each it goes to then, once to each
  address, with the topics whose yes it goes under and the Message-ID it
  goes with. A few copies are taken at a time, as `sending`, and checked
  just before they go: one whose answer is now no is skipped with why, and
  every address is checked with CiviCRM's `checkSuppression`, which drops
  anyone PauseAI mustn't bulk email ("Opt-outs", below), but for "No bulk
  emails" lifted on the contact preferences page and not yet sent to
  CiviCRM, which skips the copy without an opt-out. An address CiviCRM
  answers `unchecked` for, as it does for one that isn't a UK contact's
  until Global lets the check answer for everyone, follows our own records
  and goes. CiviCRM answers for every address it's asked about, so an
  answer that leaves one out is CiviCRM not answering ("Waiting for
  CiviCRM", below). Each copy is then marked as handed to its channel
  (`handed_at`) and goes, an email with
  its unsubscribe link token made then, only its hash kept; those a run has
  no time left for are put back, as are the rest when the channel answers that
  it can't send for now. Some of those pass by themselves: Gmail or
  Postmark busy, down, or at a limit or quota (`REFUSED_FOR_NOW` in
  `lib/server/email.ts`), as Gmail's daily sending limit, which can last
  most of a day; WhatsApp too fast, our number limited, the template
  paused, or WhatsApp unavailable (`WHATSAPP_ERRORS.later`). Others last
  till someone fixes the account (`fixNeeded`): its credentials refused or
  Gmail's access revoked, WhatsApp's token expired or the template disabled
  (`WHATSAPP_ERRORS.fix`). A copy its channel refuses for itself
  is failed alone, as is one whose send broke off with no answer, kept as
  never finished as it may have gone, and the rest go on. Once the channel
  can't send for now, or two copies fail in a row, no more of the broadcast
  goes for 25 minutes (`REST_MINUTES`, from `mailings.try_failed_at`),
  however often the sending is called, and its page says till when. The
  count of failed tries in a row (`mailings.failed_in_a_row`), the
  channel's refusals that need fixing among them, runs across rests and
  runs, and starts again when a copy goes; at five (`FAILURES_TO_STOP`) the
  broadcast stops, so whatever fails every copy fails five people, not
  everyone, and an account refused for good stops it within a couple of
  hours rather than stalling it for days. A "not now" that passes by itself
  never counts: the broadcast rests through it as long as it lasts, within
  its seven days, and goes on after. Once it has sent nothing for six hours
  that way (`mailings.held_back_since`), whoever scheduled it is told, once
  (`held_back_told`), with what the channel last said. Resume ends a rest
  and the count. A
  copy a stopped run left `sending` for
  half an hour is failed, not sent again, if it had been handed to its
  channel, as it may have gone; one the run had only taken never went, so
  it's put back to go. While copies
  are left, the run starts the background function as letters do ("Mailings
  to politicians"). Each channel has a sender, and one loop sends by either.
- **What sends a text**: WhatsApp's Cloud API
  (`lib/server/outside-services/whatsapp.ts`), from our number, read from
  the WhatsApp account, where its keys are set: on the live site alone, and
  a fixture build's fake (`lib/server/broadcast-channels.ts`). Anywhere
  else nothing sends a text, so scheduling one is refused and the pages say
  so. A copy is the text's template, its fields filled in for the person.
  Before a copy goes, its number is checked with CiviCRM's
  `checkSuppression`, and one with "Do not SMS" is skipped, as is a number
  WhatsApp has said isn't on it (`whatsapp_unreachable`). Texts go to as
  many people a day as Meta's messaging limit for our business allows
  (`whatsapp_business_manager_messaging_limit`, read from our number), 250
  to start with, or 250 if Meta doesn't say: the rest wait for the next day.
  Meta doesn't say how much of the limit is used, so the site counts those
  it texted in the last day, as nothing else sends from our number. The
  writer says how many more people it can text today and how many days the
  text would take, and one that would take more than seven can't be
  scheduled (`too-slow`). WhatsApp's answer to a send, or its webhook later, can
  refuse a copy: as the number isn't on WhatsApp, which skips it from then
  on; as the person stopped marketing messages, a stop ("Opt-outs"); or as
  they've had enough marketing messages lately, when it's held a day
  (`not_before`).
- **What sends an email** (`mailings.send_by`; `BROADCAST_SEND_BY` in
  `lib/broadcasts.ts`). An email is always from `hello@pauseai.uk`
  (`BROADCAST_SENDER`), where its replies are read. It goes by one of the
  channels mailings go by (`lib/server/mailing-channels.ts`), through
  `send()`, to its supporter by name, or to their address alone if they
  have none, with its files, its unsubscribe link at its foot and in its
  `List-Unsubscribe` and `List-Unsubscribe-Post` headers:
  - **Gmail**, `hello@`'s own connected Gmail, one a second, up to the
    account's daily limit (`GMAIL_DAILY_LIMIT`, 1,800, which leaves room
    under Google's 2,000 for answers to replies). At the limit the rest wait,
    and go over the following days; the broadcast's page says how far it's
    got. The writer says how many more `hello@` can send today and how many
    days the email would take, and one that would take more than seven
    (`SENDING_DAYS`) can't be scheduled (`too-slow`), nor one while `hello@`'s Gmail isn't
    connected. Its bounces are read from the mailbox, as a mailing's are.
  - **Postmark**'s broadcast stream, apart from the site's transactional
    mail, with no limit of ours. Postmark hasn't approved us for broadcasts,
    so it can't be chosen yet (`available`).
- **Waiting for CiviCRM.** Nothing goes unchecked. A broadcast
  waits while no CiviCRM pull has completed for a day, or CiviCRM doesn't
  answer its check; whoever scheduled it and the notification inbox are
  emailed once, and its page says since when and why, and when it stops if
  CiviCRM doesn't come back: three days on, or sooner if its seven run out
  first (`waitEndsAt`). It goes by itself
  when it can. A scheduled one's page says quietly when it would stop.
- **Stopping.** A broadcast that has waited for CiviCRM for three days
  (`WAIT_DAYS`), from when it first couldn't go, whether at its time or
  days into sending, or one still sending, at a day's limit of emails, seven
  days after its time (`SENDING_DAYS`, both in `lib/broadcast-days.ts`, which the
  pages' words take their numbers from), stops: its copies not yet gone
  are cancelled, and whoever scheduled it and the notification inbox are
  emailed why and how many it didn't reach (`wait_reason`: `civicrm`,
  `pull` or `limit`). Its seven days are the most it has, waiting or not:
  one still waiting for CiviCRM when they run out stops then, saying so
  (`late`), not that it was too large. A text stops too when WhatsApp
  pauses or disables its template (`template`), and any broadcast when its
  copies keep failing (`failing`, above). Resume sending, on its page, sets it going again
  (`resumeBroadcast`): its cancelled copies are to go again, or one that
  never started is scheduled again, from now, so it has its days again.
  One that stopped as its copies kept failing sends again those its channel
  refused too (`SEND_AGAIN`), but never one whose send broke off, which may
  have gone, nor one that bounced; the email saying it stopped counts them
  among those it didn't reach. Those go after the ones never tried, so the
  copies likeliest to fail again can't stop it before the rest have gone.
- **What Postmark reports**, of a copy it sent. Its delivery webhook marks a copy delivered;
  a hard bounce marks it failed and blocks the address; a spam complaint is
  an opt-out of every bulk email (`lib/server/delivery-problems.ts`).
- **What WhatsApp reports**, by its webhook, `/api/whatsapp`, signed with
  the Meta app's secret (`lib/server/whatsapp-webhooks.ts`): each text
  delivered, read or failed; a message to us, which answers the text it
  quotes, or else the newest sent to that number, and is kept as a reply,
  or is a stop of the topics that text went under if it says "stop" or
  "unsubscribe", in any case, which the site answers once, in the day
  WhatsApp takes words of ours: what it stopped, and a link to the contact
  preferences page for the number; or,
  answering no text, is emailed to the notification inbox; a stop or
  resume in WhatsApp's own setting for marketing messages; what it
  decided of a template, or its category; and anything about our number's
  quality or limit, a template's quality or our account, emailed to the
  notification inbox. Each is applied once, however often it's sent.
- **Replies** (`lib/server/broadcast-replies.ts`). The read of each
  connected Gmail matches a reply to its copy by the Message-ID it went
  with, before anything else in the mailbox sees it, and keeps it whole
  (`broadcast_replies`, the message in Netlify Blobs). A person's reply
  waits for staff, who record it as an opt-out, of what the copy went under
  or of every bulk email (every text, for a text's), or as nothing to do;
  an automatic one never waits. A reply to a text is its words, as
  WhatsApp's webhook gives them. The broadcast's page counts replies, and those to look at in
  amber, which come first among its recipients; the staff home says how
  many wait. A message from the mailbox's own address in the thread is an
  answer of ours sent from its Gmail, and isn't kept as a reply.
- **Answers** (`lib/server/broadcast-answers.ts`). Staff answer a reply on
  its Thread page: Reply, first of its buttons, opens a draft after it,
  which Send reply or Cmd+Enter (Ctrl+Enter off a Mac) sends. It goes by Gmail
  from the mailbox the reply came to, as the broadcast's name, in the
  reply's Gmail thread, with In-Reply-To and References naming the reply and
  our email (purpose `broadcast-answer`), so it's in that mailbox's Sent and
  the person's conversation. It's kept (`broadcast_answers`) with who sent
  it, recorded as sending before it goes and sent after, once for each
  draft, so pressing Send twice sends it once; one that fails is forgotten,
  so it can be sent again. Sending one settles the reply as `answered`,
  unless it's an opt-out, and an answered reply can still be recorded as
  one. Reading the mailbox skips our answer, as an email we sent
  (`email_sends`), and a reply to it joins the same copy, by its
  Message-ID. It's transactional, as it answers what the person wrote. An
  answer to a reply to a text goes by WhatsApp, as words of our own, which
  it takes only within a day of their message; after that the thread says
  so, and there's no Reply.
- **A message's page**, Thread (`/staff/broadcasts/<id>/<copy>`), shows one
  person's copy as they got it, and when it was sent, delivered and read,
  with each reply under it and its buttons, our answers, and who dealt with
  each.

### Mailings to politicians

A mailing written on the site goes from a staff member's own Gmail, one
letter at a time, as if they'd written each. It has no unsubscribe link and
no consent check, as it's to public figures in their public role.

Each staff member connects their own Gmail on their page (`/staff/me`,
`lib/accounts/gmail-accounts.ts`). A mailing's Sent from links there while
their Gmail isn't connected. Once a Gmail is connected, any staff member can
send a mailing from it. The Google Cloud project's consent screen is
Internal, so only accounts in PauseAI's Google Workspace, pauseai.info's as
well as pauseai.uk's, can grant access, and the site takes only the
logged-in staff member's own address. The refresh token is kept encrypted
(`GMAIL_TOKEN_KEY`), and deleted on disconnecting.

- **From name.** A mailing goes in a name of its own. With none, it goes in
  the name the Gmail sends as (the name of its primary "Send mail as"
  address), which Sent from shows until the field is edited. A mailing
  always goes from the account's own address. Gmail can send as an
  account's other "Send mail as" addresses too, but the API can't tell a
  Google Group's address from an alias, and replies to a Group's address
  don't reach the mailbox the site reads.
- **Scheduling** needs the Gmail the mailing is from to be connected, and
  no more recipients than one account sends in a day. The site sends at
  most 1,800 a day from an account, counting every mailing
  (`GMAIL_DAILY_LIMIT`). That's under Gmail's 2,000, so the person's own
  email still goes.
- **Sending** (`lib/server/mailing-sending.ts`): the `send-mailings`
  job, at 3, 18, 33 and 48 minutes past every hour, starts each scheduled
  mailing that's due. It starts none before 06:03 UTC. A mailing's time is
  one of those runs, chosen by its hour and minutes (`SENDING` in
  `lib/staff-time.ts`); one due at another time goes on the next run, and
  one due overnight at 06:03.

  Then the job sends the mailings' letters at Gmail's pace, one a second,
  marking each as it goes. A scheduled function has 30 seconds, so while
  letters are left it starts a background function, which calls the site
  again and again for up to 12 minutes. The next run takes up the rest.

  Each letter is checked just before it goes. One to a politician who is
  out of office, or whose address has been blocked since, is skipped, and
  the letter says why. The letters from an account that's at its limit, no
  longer connected, or that Gmail answers can't send for now, wait for the
  next run. One Gmail refuses is not sent. One that went but couldn't be
  marked sent is left `sending`, and marked uncertain after 15 minutes, for
  a person to check, rather than sent twice; so is a letter from the
  letters inbox.

- **A run that stops while sending** (`uncertainLetters` in
  `lib/server/letter-sending.ts`): a letter (of a mailing or from the
  letters inbox) or a supporter's copy is marked sending when a run takes
  it (`taken_at`, `copy_taken_at`), and sent once it has gone. A run that
  stops between the two leaves it sending. At the start of the next
  `send-mailings` run, one left sending for 15 minutes is marked
  `uncertain`, as relays are, and its history says to whom it may have
  gone. It isn't sent again, as it may have gone: a person checks. A mailing
  doesn't wait for an uncertain letter, so it finishes, and its page shows
  the letter in red.
- **Message-IDs.** Every letter of a mailing goes with a Message-ID of ours,
  whichever backend sends it, so a reply is matched by the IDs it names.
  Gmail can send a letter with a Message-ID of its own instead
  (`…@mail.gmail.com`). So after sending, the site asks Gmail which one the
  letter went with, and keeps that (`email_sends.rfc_message_id`). The
  letter's own copy in Sent is also known by Gmail's ID for it, and a bounce
  that names no letter we know is matched by the Gmail thread it's in.
  `send()` takes a backend: Postmark, or a connected Gmail.
- **Reading** (`lib/server/gmail-reading.ts`): the `read-gmail` job, every
  5 minutes, lists each mailbox's new messages since the last `historyId`,
  and fetches only their reply headers. It fetches whole only the messages
  in our letters' threads, and bounces. What it does with each:
  - A bounce, from mailer-daemon or postmaster, is recorded as Postmark's
    are, marked found in Gmail. A bounce from another server may not be in
    the thread, so the last three days' bounces are searched for too.
    Anyone can write to a mailbox as mailer-daemon, and a recorded bounce
    blocks its address. So a bounce is recorded only for an address we sent
    the email it names, or one in its Gmail thread; any other address it
    names is left alone.
  - An automatic reply is an event on the letter.
  - Any other message in the thread, the politician's reply or our answer,
    is kept whole, gzipped, in Netlify Blobs, with a row in
    `letter_replies`. The backup Worker copies them (`backup/README.md`).
    A copy of a message the letter already has, by its Message-ID, read
    from another mailbox, isn't kept again.
  - An email a politician starts afresh, answering no letter, is a one-off.

  A Gmail thread is in one place. Once a message of it is on a letter, every
  other message in it is the letter's too, whoever wrote it, and any kept as
  a one-off email moves onto the letter (`claimOneOffs`,
  `lib/server/letter-replies.ts`). Moving a message adds nothing to the
  letter's history, but for an automatic reply's event.

  Each run is in the import log, with what it found in each account, and
  staff can run it from its page under Scheduled jobs.

- **Threads.** Each PauseAI letter has a page with its whole thread
  (`/staff/mailings/<id>/letters/<letter>`), reached from the politician's
  history and the mailing's recipients. A letter whose text the page
  doesn't have, one copied from Airtable, has Copy Gmail search in its
  place (`lib/letter-links.ts`): a search for the letter by its
  Message-ID, to paste into Gmail wherever the mailbox it went from can be
  seen, a delegate's view included. It's a search because Gmail has no
  link into a delegated mailbox. A supporter's letter's page has the same. For a letter
  sent through the letters inbox, the search is for that inbox. For an
  older one, it's for the mailbox its sent email was found in, or else for
  its copy in `POLICY_INBOX`.

### Old letters

The letters written before the site could send them were read once from
Joseph's and policy@'s mail, so each one's text, diff and replies show on its
page. What was read was joined to the letters copied from Airtable, or added
as letters of mailings made for it, each with a key in `old_letters_key`
(DeepMind's sends, the documentary's, and others). Replies were kept on their
letters, and the rest as one-off emails.

- **What's stored.**
  - For a mailing: its template in `imported_text`, in `body`'s format, its
    subject and who it went from.
  - For each letter that fits the template: its greeting and own paragraph, in
    `merge_values`. For one that doesn't: its whole text, in `own_text`.
  - For a letter's sent email: an `email_sends` row with `imported`, its real
    date, Message-ID and Gmail thread, so the site's regular read joins later
    replies and bounces to it. As the row keeps its date, it doesn't count against
    `GMAIL_DAILY_LIMIT`.
- **Letters whose text we can't read.** The August 2025 DeepMind letters went from
  Joseph's personal Gmail, which the site can't read. Their template is the "join
  40" mailing's, and each letter's own paragraph is that of the person's latest
  letter before it. The mailing is marked `imported_text_approximate`, and a
  letter's page says it's not exactly what they received. The one such email found
  matches that. Replies quoting others say "join 40" until 7 August and "join 50"
  from the 8th, so a letter's number goes by its date. The mailing says it's from
  Joseph, with no address.

## One-off emails

Threads with a politician that aren't a letter of a campaign or mailing: Joseph's
own emails, a volunteer copying policy@, an MP writing to us.
`lib/server/one-off-emails.ts` keeps each message whole, in Netlify Blobs with a
row in `one_off_messages`, in its thread (`one_off_threads`). Staff read them, and
can't change them, on Correspondence (`/staff/emails`), in the navigation under
Politicians, and on the politician's and the supporter's pages. On Correspondence,
staff without `supporters` don't see supporters' letters or a thread with someone
else in it.

- **What counts** (`lib/one-off.ts`): a message counts if it has:
  - an address a politician has or has had (past ones come from the audit log);
  - an address on a politician's own domain; or
  - an address on a parliament's domain.

  Whose it is, the politicians a thread shows under, goes by the politician book
  (`lib/server/politician-book.ts`). An address is a politician's if it's:
  - their email, or one they had;
  - one in `politician_addresses`: listed for them by their body, added by
    staff (such as a personal Gmail), or their office's;
  - on a domain of their own (`politician_domains`); or
  - a parliament address in one of the forms their name or seat makes
    (`addressForms`): `meg.hillier.mp@`, `meghilliermp@`, `officeofmeghillier@`,
    `meg.hillier.casework@`, `mel.stride.centraldevon@`, `romford.mp@`,
    `kate.forbes.msp@`, and plain `first.last@` at the Senedd and the Northern
    Ireland Assembly. At parliament.uk and parliament.scot a name needs its mark,
    as staff have `first.last@` too. A form two politicians make is no one's.

  Each body's nightly import saves each address it lists for a member, but one
  two members list, and each domain it lists, if only one politician has it and
  it isn't shared: a party's, social media's, a mail provider's or the public
  sector's, whatever its ending. An address the body stops listing stays, as a
  past one. Its last step is relinking (below).

  An office's address is a parliament address that's no politician's but reads
  as a person's own (`first.last@`), seen only in threads with one politician,
  such as their caseworker's. Relinking works these out again each time, by the
  book without them.

- **Relinking** (`lib/server/one-off-relink.ts`) works out every thread's
  politicians afresh from its messages' addresses, the addresses and names they
  quote, and the book as it is, and whether it has someone else in it. It runs
  at the end of each body's import (and its button), and when staff add or
  remove an address, or set a Lord's email. A message's quotes are stored as it's kept (`quoted_addresses`,
  `quoted_names`); for one kept before, relinking reads them from its blob, as
  many as it can in its time, and a thread with any still unread loses no one.
  Outlook quotes a colleague in Parliament by name alone ("HILLIER, Meg"), so a
  quoted name with no address links the politician it names. A thread through
  the House of Lords' shared inbox, which the House forwards to the Lord its
  subject names ("For Baroness Verma: …"), links that Lord, when the name is
  one sitting Lord's, with or without their territorial part (`lordFor`,
  `lordNamed` in `lib/one-off.ts`); a name that's no one's, or more than one
  Lord's, links no one.

- **Aliases.** A politician's email, in the band at the top of their page,
  opens a bubble of every other address and domain that's theirs and where each
  came from, with the forms their name and seat make, those staff added last.
  A Lord's own email is set there too. Staff add an address there by hand: it's logged and every thread relinked at once. The next regular read of
  Gmail searches policy@ and joseph@ for it (up to 50 messages each) and keeps
  what it would have kept, as it passed over that mail before the address was
  known (`searched_at`). That's done at the start of the read, before the
  mailboxes, which can take most of a minute, and not while staff wait, so
  Gmail's limit a minute can't cut it short: if Gmail refuses, or its few
  seconds run out, the search carries on next time. Staff can remove an address
  they added, or one guessed to be their office's, which is then kept as
  `rejected` so it isn't guessed again; either way, the threads it alone linked
  lose them.

- **Forwards.** A forward is shown as the messages it carries, each rebuilt from
  its quoted headers and marked so, oldest first, before the forward's own note
  (`lib/email-parsing/forwards.ts`). One the thread holds whole isn't rebuilt.
  This is worked out as the page is shown, from the kept message, so every
  forward gets better as the parser does.

  A message is kept once, by its Message-ID, and threaded across mailboxes by
  In-Reply-To and References, as each mailbox has its own Gmail thread IDs. A
  thread that counts is kept whole, within the mailbox it was found in: what came
  before the message that counts and what comes after, whoever wrote it. A message
  in a letter's thread is the letter's instead ("Mailings to politicians", above).
  A message we sent, Postmark's included, isn't kept.

- **Quotes.** The From, Sent, To and Cc of a forwarded or quoted message also say
  a thread is with a politician. Volunteers forward their emails to us, so policy@
  and the group's archive, which are shared mail, are searched this way. Joseph's
  other mail isn't. It's found by its headers alone, so that the rest of his mail,
  apart from the threads found, stays private.
- **New threads.** The regular read keeps policy@'s and joseph@'s threads by the
  same rule (`keepsPoliticianThreads`). With each message it keeps, it fetches the
  rest of the Gmail thread. `/staff/me` says so once those mailboxes are connected.
  Everyone else copies policy@ into their own emails with politicians.
- **Mail that matches nothing,** in policy@ and the group's archive, isn't kept
  unless its thread comes to be kept. Only its Gmail ID is (`unmatched_mail`). The
  site uses the ID to read the message's sender and subject again from Gmail, and
  lists them in an email to the notification inbox. That email goes at most once a
  day, whether or not the last try's email went (`tried_at`). It lists the oldest
  100 at a time and says how many more wait.
- **Who sees what.** Staff without `supporters` see the name and text of a thread
  only if everyone on it, its senders and its To and Cc, is a politician, on a
  parliament's domain, or at PauseAI (`threadsWithSomeoneElse()`). Anyone else on
  a thread hides it from them.

## Form entries

One person filling in one of our forms once (`form_entries`): their name,
email, phone, address, city and postcode as they gave them, the box to hear
from us (`contact_consent`), where they came from (`utm_source`) and when.
`form` says which form: `email-your-mp`, `march-2026-11`, `paper-signup`
("Paper sign-ups", below), or `web-form` for pauseai.info's old letter form.
What only some forms make hangs off the entry, one to one. A letter's sender,
for one, is the entry its `letters_from_supporters` row points at.

A new form needs:

- a value in the `CHECK` on `form`;
- a label in the staff interface's `sources`;
- if it makes more than an entry, a child table pointing at `form_entries`,
  as `form_entry_luma` holds what Luma said to a form that registers people
  for an event.

What a form's box said when someone ticked it is its wording in git at the
entry's `created_at`.

A public form that takes an email address must check one of two things:

- that a person is filling it in, with Turnstile, as the letter form has
  (`lib/server/outside-services/turnstile.ts`); or
- that the address is theirs, with a link emailed to it that must be clicked
  before the entry counts.

Otherwise a bot can sign up thousands of addresses, and every yes and every
email that follows is false. Only the emailed link stops a person signing up
someone else. A form that emails the address it's given, such as one asking
for a link, needs Turnstile as well, so it can't be used to send our mail to
anyone. A honeypot alone isn't enough: the march sign-up has only that.

**Paper sign-ups** (`paper-signup`) come from a CSV of forms collected while
flyering, which staff import at `/staff/supporters/import`. The file itself
isn't kept: the page reads it in the browser, and sends it to the server only to
preview and import it. Each import is a row of `signup_uploads`: the file's name,
the date collected, where collected (`note`), the event, and how many it imported
and held back. `signup_upload_entries` ties each entry to its import, with what
the import did for that person as it did it:

- whether it made a new entry or found one already there;
- how they were already a supporter;
- whether they were already going, or what Luma said.

The import's where collected is the entry's line in a supporter's history, and
the import's own page is under Past imports.

`lib/signup-upload.ts` reads the file. It's liberal about separators, encodings,
how a heading is spelt and ways of saying yes, and about nothing else. A column
whose heading isn't on its list is ignored, so a doubt in a file is settled
before it's imported. A row is held back, with nothing kept, if it has:

- no name;
- a bad email or phone;
- a yes or no the reading can't make out;
- a blocked email;
- an email that's on another row of the file.

The entry is dated midday on the date collected. That date is also what makes an
import safe to repeat: an email with a paper entry of that date gets no other.
Every entry has its box ticked, as signing the paper form is joining the mailing
list. So it's a yes to PauseAI UK by email, and to calls and texts for a number
given. The form has no mailing list box, and a file's column for one is ignored.

Staff may link one column of yes and blank to one event to come. A yes then
registers the person on Luma, who emails them, unless they're already going. The
preview shows what importing will do for each person, and importing checks
that's still so.

## Supporters

One row per person we know of (`supporters`). `supporter_links` ties the
supporter to each record about them in a source: a Luma user
(`luma_user_id`), a form entry (`form_entry_id`) or a CiviCRM contact
(`civicrm_contact_id`).
Records are matched by trimmed, lowercased email and nothing more, so
`jane+luma@` and `jane@` are two people. The supporter holds no
name, email, phone or place of its own: those come from the linked
records, newest first.

`linkSupporters()` (`lib/server/supporters.ts`) only adds links. It runs at
the end of each Luma and CiviCRM import and when a form entry is kept, and
it's set-based, so running it again does nothing. Then supporters who gave
the same UK mobile number (`+447…` as `phone_number()` writes it) are made
one person, whatever their emails. `merge_supporters_by_phone()` moves the
newer supporter's links, messages and notes to the older, and deletes the
newer. `supporter_merges` keeps the deleted one's ID, so its old page,
`/staff/supporters/<id>`, redirects to the supporter it went into. Landlines
and numbers abroad aren't matched, as households and offices share them.

Each source (`lib/server/supporter-sources.ts`) gives three views in one
shape, made in the migrations:

- `supporter_source_<name>` (`source_id`, `email`, `name`, `seen_at`), for
  the matcher;
- `supporter_activity_<name>` (`source_id`, `at`, `kind`, `title`, `detail`,
  `href`, `status`), for the history;
- `supporter_contact_<name>` (`source_id`, `at`, `phone`, `postcode`,
  `latitude`, `longitude`, `city`), for contact details and places.

`supporter_identity`, `supporter_activity` and `supporter_contact` union
them by supporter. Luma's activity is three arms of `supporter_activity`
itself, as Postgres can't narrow a union inside a join to one supporter.
`supporters_summary` is one row per supporter.

The list reads `supporters_listed`, which is two things together:
`supporters_list`, a materialized view of every supporter's summary and
place, and anyone added since, worked out as the list is read.
`refreshSupportersList()` refreshes the materialized view at the end of each
import that links supporters, and after an erasure. So a supporter's counts,
tags and place in the list are as of the last import, up to an hour old. The
exception is whether they're a Luma contact: an opt-out from the calendar,
or its end, is looked up as the list is read (`optedOutOfLuma()`). A
supporter's own page is always as they are now.

When a supporter was first seen is the earliest `seen_at` of their records
(`supporter_first_seen`). `refreshSupporterFacts()`
(`lib/server/supporter-facts.ts`), which `linkSupporters()` runs, keeps it
on the supporter (`supporters.first_seen_at`). So the staff home counts new
supporters by it without working it out each time.

Only staff with the `supporters` permission see supporters
(`/staff/supporters`), and each download of a list of them (supporters,
their blocked addresses) is an audit log entry.

Where they come from:

- **Luma.** The import (`lib/server/luma-import.ts`) runs every 5 minutes
  and copies:
  - every public event on our calendar, into `luma_events`;
  - each registered guest, into `luma_guests` (phone, a postcode answer,
    `utm_source`; never Luma's invited-only rows);
  - each of our own events' hosts, into `luma_event_hosts`. They come from
    Luma's details of the event, as its list of events has no hosts. Every
    past event's details are read once, and those of each event still to
    come every hour until its day is over;
  - every Luma user (guest, host or contact), into `luma_people`, with when
    they joined the calendar as a contact and when a read of the contacts
    last listed them.

  Luma's own IDs are the keys, and only the import writes these tables. The
  public events pages read Luma live.

  A run fetches for about 20 seconds. It reads what's changed first and
  backfills the rest over later runs, and it records how many events are
  still waiting, so the first copy of the calendar takes a few runs. It
  leaves 50 of Luma's 200 requests a minute for the site's own fetches, and
  stops early if Luma answers 429. Working out every supporter's facts and
  the supporters list again takes a few seconds with many supporters. So a
  run that changed nothing does it only if no run has in the last hour.

  The import is the one thing that changes Luma's calendar, and only on
  production. An upcoming event with no tags gets the calendar's tags that
  its name, city and region clearly say (`lib/event-tags.ts`). Where they
  don't, the notification inbox is asked, once. The import makes no new
  tags.

- **Our forms.** Each form entry is a record ("Form entries", above). Its
  source in `supporter_identity`, `supporter_activity` and
  `supporter_contact` is its form, so staff see which form it was. A letter
  is activity of the entry that sent it. pauseai.info's old form got its
  consent box on 23 September 2026, so an entry from before then counts as
  a no.
- **CiviCRM.** Global's UK chapter contacts, pulled hourly ("CiviCRM",
  below), are the members: a member is a contact the latest complete pull
  returns. Each gives its name, city, postcode, number, the day it joined
  PauseAI and what it said it wanted to do. A contact that's gone gives
  none of them, and its history says when it left. Staff see the source as
  "Member". CiviCRM returns the UK members whom we may hold: those who
  joined before July 2026, and those who shared their details with PauseAI
  UK. From 30 June to 4 October 2026 the join form ticked the share box for
  everyone with its required privacy checkbox, so a signup from then counts
  only if they also ticked "Keep me informed" or chose to volunteer or
  lead. Since then the form asks the question on its own.

**Where they are.** The `supporter_place` view gives each supporter's
best-known place, with its coordinates and country. It's the first of these
they have:

1. their newest postcode;
2. the newest city they gave themselves (never Luma's, whose cities are its
   events');
3. the newest event they registered for that isn't a big day or online.

Each postcode and town is looked up at postcodes.io once, at the end of each
Luma import (`lib/server/supporter-places.ts`), and a big import catches up
over a few runs. Postcodes are kept in `postcode_places`, each with its
constituency, and towns in `named_places`. A postcode's first half alone
("SE15") says roughly where someone is but not their constituency, so it
gives no MP.

The list's Near filter reads the place. A supporter's MP is the one for
their postcode's constituency. The supporter's page shows the cities they
gave (`givenPlaces()` in `lib/supporter-place.ts`).

**Erasure.** When someone asks to be forgotten, staff erase the supporter
from their page (`lib/server/erasure.ts`), under the request's reference.
For each source, what that source holds goes:

- A form entry, with its letter, the letter's events and the copies of
  replies forwarded to the sender. Its row in the send log keeps only that
  a letter went to that MP. For a letter from the letters inbox, the
  supporter's proxy goes too, with every message kept and its blob, and its
  mail in the inbox is moved to Trash.
- A Luma user, with their registrations and contact.
- A member's record.
- Every one-off email with their address on it, and its blob.

What stays is what exists to stop us mailing the address: `email_problems`,
`email_blocks` and `opt_outs`. Some IDs are kept too, so that what was erased
doesn't come back:

- The Luma user's ID goes in `luma_erased`, which the import skips. A new
  Luma account later is a new supporter.
- Their CiviCRM contact IDs go in `civicrm_erased`, in the same way.
- A one-off email's Gmail ID and hashed Message-ID go in `one_off_erased`,
  so that reading its thread again doesn't keep it again.

The audit log entry carries the supporter's ID and the reference, never a
name or address.

An erasure doesn't reach these from here, and has to go to each by hand
(`docs/data-protection.md`):

- Luma's own records;
- the copies of letters and replies in the policy team's Gmail inbox;
- letters sent through the earlier form, in Airtable ("Web form emails");
- Global's own copy of a member, in CiviCRM.

A new source is a table of its own, a column and a widened `CHECK` on
`supporter_links`, its three views and its arms of the union views, a
badge, and its part of erasure.

## Events and their owners

Our events are Luma's, as the import copies them every 5 minutes
(`luma_events`). The staff interface's events page (`/staff/events`) lists
our own as a table on two tabs: Future, soonest first, and Past, latest
first. The table says how many are going, and is sorted and filtered there
(`lib/staff-events-list.ts`). An event is still to come until midnight in
London on its day, however late it began (`stillToCome()`), so it's on
Future all that day.

From Group by, a chip in the filter bar, what either tab and its filters
find can show in lists rather than the table (`group`, kept by saved filters
and Clear filters). There are two groupings:

- By the owner's address, with the events that have no owner first. That
  list is in red while one of its events still needs an owner.
- By Luma tag, a list for each, so an event with two tags is in both: the
  places first, then Big events, Online and those with no tag.

Staff who see supporters see each event's hosts too, by name, each linked
to their supporter, and can search by the hosts' names and emails. A host's
supporter page lists the events they hosted, beside those they registered
for. Each hosted event is dated when the import first found them a host of
it. For a host found on the event's first read, it's dated when the event
was made on Luma, as Luma doesn't say when someone became a host.

Each event can have one owner on staff
(`event_owners`, `lib/server/staff-events.ts`), kept apart from
`luma_events` as only the import writes that. Any staff member can make
anyone with a staff account an event's owner, from the page, but can't
take an owner away. One email goes to the new owner, whoever chose them,
copied to the owner before. It says who gave the event to them and from
whom, and the page says whom it emailed.

At the end of each import, every event still to come with no owner gets one
by the rules in `lib/event-owners.ts`, written there for now: by the place
in its city or Luma tags, or else a default owner. Each owner is emailed
once, listing the events they were given. Someone the rules name who has no
staff account gets nothing. The event then stays with no owner, and the page
shows that as an error until someone takes it (not once it's past, or taken
off Luma). When a staff account is removed, its events lose their owner, and
the next import gives them owners by the rules again.

Each event can have a link to its Google Doc too (`event_docs`). Any staff
member can set, change or clear it on the page, and it can only be a link to
Google Docs or Drive. No one is emailed about it, but the audit log keeps
who changed it.

## Opt-outs

Each time an address or number stopped a topic by a way, and when it
opted back in, if it has (`opt_outs`, `lib/server/opt-outs.ts`). Keyed by
address, not supporter, because an unsubscribe can arrive before we know
whose address it is; the supporter pages join it to every address a
supporter has. An address is opted out of a topic by a way while it has an
open row, one at most for each. A row is named for what was stopped, the
topic and the way (the consents, below), not for what told us, so an
address has one opt-out in force for each whoever reported it, and its
source says who did. Three things tell us:

- Luma's `calendar.person.unsubscribed` webhook (`/api/luma/webhook`,
  `lib/server/luma-webhooks.ts`), at once, keyed by Luma's `Webhook-Id`
  so a redelivery changes nothing: a stop to events by email, as the
  calendar's emails are about events. Luma doesn't say whether it was an
  unsubscribe, a block or a spam report. `calendar.person.subscribed`
  closes the row, but Luma sends it for a new follower, not for one coming
  back. Unsubscribing from one of the calendar's emails, marking one as
  spam, or being removed or blocked by us takes someone off the calendar's
  list; following it again puts them back as they were, with the date they
  first joined. Unfollowing changes neither. We checked this with a staff
  member's own Luma account against `/v1/calendars/contacts/list` in
  October 2026.
- The end of each of the Luma import's full passes over the calendar's
  contacts, one after another, ten pages a run (`recordContactsPass`). A
  contact it doesn't list is opted out, as `luma-contacts`, from when it
  noticed, unless they already are; an open opt-out of Luma's begun before
  it listed them again is closed. One from our contact preferences page or an
  email's unsubscribe link stays open, and the pass takes anyone it still
  lists with one off the calendar again (`stillOnCalendar`), as taking them
  off may have failed. That catches what the webhook doesn't: returns,
  removals, blocks, and anyone who left before the webhook was set up on
  22 Oct 2026. So someone who leaves, comes back and leaves again within a
  pass has one opt-out, not two: the second unsubscribe finds the first
  still open.
- The CiviCRM import, hourly (`recordCivicrmLists`, "CiviCRM", below): a
  contact `unsubscribed` from CiviCRM's `newsletter` or `volunteer_updates`
  list is a stop to the newsletter or volunteering by email, as `civicrm`,
  from when the pull saw it. On the list again later, which only the
  person can do there, closes an opt-out begun before.
- A copy of a broadcast's unsubscribe link (`link`), and a mail app's own
  Unsubscribe button, by the copy's `List-Unsubscribe-Post` header
  (`list-unsubscribe`, `/api/unsubscribe/<token>`): an opt-out of what the
  copy went under ("The contact preferences page", below).
- A spam complaint (`postmark-complaint`), from anyone, about any email:
  an opt-out of every bulk email, beside the block it makes ("Email",
  below).
- A reply staff record as one (`reply`), of what its copy went under or of
  every bulk email ("Broadcasts to supporters", above), and anything else
  a person tells staff, recorded under their consents on their page with
  how they said it (`staff`). Both name who recorded it.
- The contact preferences page (`preferences`).
- CiviCRM's suppression check just before a broadcast (`civicrm-check`):
  an address PauseAI mustn't bulk email, or email at all.

An opt-out is of one topic by one way, or, by email, of every bulk email
(`bulk`, as CiviCRM's "No bulk emails") or of all email but what the person
just asked for (`all`, as its "Do not email"). Those two stop every topic
of the address.

An opt-out is only ever a real stop, told us by its own sender. Leaving a
box unticked isn't one, nor is CiviCRM's `not_opted_in`: neither undoes a
yes from another source.

Each opt-out of ours that CiviCRM takes goes to its `updateSubscriptions`
too (`lib/server/civicrm-updates.ts`), so Global's records and mail honour
it: the newsletter by email as an unsubscribe from `newsletter`,
volunteering by email from `volunteer_updates`, and every bulk email as
`no_bulk_email`. One CiviCRM told us of doesn't go back, and events, or a
topic by text or call, go nowhere. Each is queued with the opt-out, in
`civicrm_updates`, and sent by the hourly CiviCRM import before it pulls,
tried again each hour until CiviCRM answers it. Only opt-outs go, and the
one opt-in the person makes themselves: lifting "No bulk emails" on the
contact preferences page, as `allow_bulk_email`, beside its words. A yes on our
side stays ours.

A new source is a name in the `CHECK` on `source`, and whatever records it.

### The contact preferences page

`/contact-preferences` (`lib/server/email-settings.ts`) is where anyone sees and
changes what PauseAI UK sends them, and why. Someone asks for a link by
their address, past Turnstile; one goes only to an address we have, after
the page has answered, and the page says the same either way, so neither
its words nor how long it takes says whose addresses we hold. An address
gets one link in 2 minutes and 5 in a day at most. A link works for 7 days. Every copy of a
broadcast has its own link (`/contact-preferences/m/<token>`), which opens the
page with one button that opts out of what the copy went under: following
the link changes nothing, as mail scanners follow links nobody clicked. The
button works forever; the rest of the page for 30 days after the copy went,
then it offers a fresh link. The answer to a stop in WhatsApp has a link
for the number alone, working for 30 days: the page then has that number's
texts and calls, with no email, PauseAI Global's emails or Stop everything,
and once it's run out it says to reply STOP, as there's no address to send
a fresh one to.

The page opens only from a link emailed to the address, or texted to the number, so a box ticked
there is its owner saying yes: a yes from the page (`preference_choices`),
with the words beside it, which wins over an older opt-out. An untick is
an opt-out from the page. Texts and calls are for the numbers of whoever has
the address: a box is ticked where any number says yes, ticking it is a yes
for each number, unticking it an opt-out for each, and leaving it changes
none. Turning off events by email, or every bulk email, takes the
address off our Luma calendar too, on the live site. "No bulk emails" holds
all of its email, which the person can lift there, beside a plain sentence
of what that does; "Do not email" only Global can lift. Stop everything is
an opt-out of every bulk email, and of every text and every call to each of
the numbers (`all` by text and by call), so no yes, now or later, gets
past it till Restart; the page locks their boxes meanwhile.

Someone with "No bulk emails" who ticks a box to hear from us, on the march
form, Email your MP or a paper sign-up form, is emailed how to lift it,
saying where they signed up (`sendBulkNotice`): once a sign-up, and once
in 30 days however many they make. Nobody with "Do not email" is. A notice
that fails is reported, and the sign-up goes on. The paper import's preview marks who will be, and shows the
email.

### CiviCRM

Global's CRM, CiviCRM, is one of our sources (`civicrm_contacts`,
`lib/server/civicrm-import.ts`): every UK chapter contact its chapter
contacts API returns (`lib/server/outside-services/civicrm.ts`, with
`CIVICRM_CHAPTER_KEY`;
[its spec](https://github.com/PauseAI/pauseai-civicrm/blob/main/docs/chapter-contacts-api.md)
is in PauseAI/pauseai-civicrm, which is private), as it told us. The hourly import pulls them all, 500 a page by
contact ID, and keeps each one's contact ID, Airtable ID and address; its
member details (`first_name`, `last_name`, `city`, `postal_code`,
`joined_date`, a day, `intent`, and `phone`), each null when CiviCRM has none; its flags (`on_hold`,
`no_bulk_email`, `do_not_email`, `do_not_phone`, `do_not_sms`); and its
status on the two UK lists, `newsletter` and `volunteer_updates`. CiviCRM
gives no dates but the day they joined, so each flag's and list's `_since`
is when a pull saw it change, and one the same as `first_seen_at` is as it
was when we first saw the contact. A
contact links to a supporter by its address, a new one if nobody has it,
as every source does.

A contact a complete pull doesn't return has left the UK chapter, often by
saying no to sharing with us, though Global doesn't say why: it may have
moved abroad, been deleted or been merged into another contact. It's marked
`gone_at`, its details and lists stop counting, and its history says it left, unless another contact
of the supporter's is still returned, as after a merge. If a pull returns more than
5% fewer contacts than were there, nobody is marked gone, as that's more
likely CiviCRM's mistake, and the run says so, to tell Global. A new hold
blocks the address (`email_blocks`, "Email", below), as a problem of the
kind `hold`, which staff can lift with a note on the blocked addresses page;
only a new hold blocks it again. CiviCRM lifting the hold lifts the block
too, unless another contact with the address is still on hold, and what
waited for the address goes, as when staff unblock it. The chapter contacts
API has no way to lift a hold, so staff lifting a block leaves the hold
there.

Two more of its actions are used: `updateSubscriptions`, for our opt-outs
("Opt-outs", above), and `checkSuppression`, which says whether PauseAI may
email each of some addresses at all, whoever has them, just before a
broadcast's copies go ("Broadcasts to supporters", above).

### Whether we'd contact someone

One place decides whether we may contact an email address or a phone
number about each topic by each way, and why: `contact_permission()`
(`netlify/database/migrations/0100_consents.sql`, where each reason is
explained), read through the `email_permissions` and `phone_permissions`
views and `contact_permissions`, both of them. Everything that asks reads
those: the supporter's page and the list's Consent, Email and Phone
columns, through `permissionsFor()` in `lib/server/contact-permissions.ts`;
the list's Consent filter; and who a broadcast goes to. Their stops are
read through the `contact_unsubscribes` view, by the list's Unsubscribed
filter and the staff home's count of new opt-outs. Nothing else reads `opt_outs` to answer it, and
`tests/checks/opt-outs.test.ts` fails if code outside
`lib/server/opt-outs.ts` and erasure does.

An address or a number does two jobs, kept apart. It says which records
are one person, so every one is kept and shown, whatever its answers. And
it's a way to reach someone, which needs a yes: the answer is for one
consent and one address, so someone who gave Luma one number and the join
form another has an answer for each.

A consent is a topic, what we'd send, by a way (`CONSENTS` in
`lib/contact-permissions.ts`): email to an address, or a text (WhatsApp too)
or a call to a number. The topics:

- **Newsletter**, the PauseAI UK newsletter, which includes events: a box
  ticked on one of our forms, for email, and for texts on the march's,
  which says "by email, text and phone"; a paper sign-up, where writing an
  address or a number down is joining; and CiviCRM's `newsletter` list, for
  email.
- **Events only**: following the Luma calendar, which registering for an
  event does too, for email. A number given at a Luma registration has the
  answer of the account that gave it, for texts; a number given on a form
  for "text updates on the day" is a yes for texts until the day ends
  (`day_texts`).
- **Volunteering**: CiviCRM's `volunteer_updates` list, for email; and a
  member's number, for calls and texts, if they chose to volunteer or lead when
  joining, or joined before 30 June 2026 on the Tally form, which didn't
  ask: a contact's number and intent from CiviCRM.

Each answer is yes or no, with a reason from a short list, when, and which
source said so. First, whatever stops every topic by the way: a blocked
address (`email_blocks`, below), then CiviCRM's "Do not email" and "No bulk
emails" for email, "Do not SMS" for texts and "Do not phone" for calls, on
any contact with the address or number, or of a member who gave the number;
and our own stop of every text or every call to the number (`all`), from
Stop everything, WhatsApp's setting or a text it refused. Then the
latest thing the person said about the consent, a stop or a yes, a stop
winning a tie, so a box ticked after an unsubscribe opens it again. Last,
if they said nothing that counts, why not: a box left unticked, never
opted in in CiviCRM, never followed the calendar, gone from the chapter.
A consent the address or number has had nothing to do with has no row.
A box ticked on the contact preferences page is a yes (`chose`), and an opt-out
of every bulk email or all email is the stop "No bulk emails" or "Do not
email" is; CiviCRM's "No bulk emails" stops nothing once the person lifted
it there since we saw it, unless CiviCRM refused the lift.

The supporter's page shows each yes or stop with where it came from and
when. The list shows an Email or Phone column only
with the Consent filter by that channel, and in it the addresses or
numbers whose answer the filter finds; a download, vCards too, has the
same. The supporter's page shows every address and number, marking a
number no consent lets us use. A broadcast's copies are checked by it just
before they go.

## Email

Everything the site sends, to anyone (`lib/server/email.ts`). Every email
goes through `send()` with its purpose: `letter`, `letter-copy`, `relay`,
`supporter-notice`, `office-notice`, `forwarded-reply`, `staff-login`,
`staff-alert`, `staff-report`, `mailing`, `mailing-test`, `broadcast`,
`preferences-link`, `bulk-notice` or `broadcast-answer`. Each try is
logged (`email_sends`): when, why, to whom, whether it went, its subject,
its From address, and which backend sent it. The backend is Postmark or a
connected Gmail, either a staff member's or the letters inbox ("Mailings to
politicians" and "Letters through the letters inbox", above). An `imported`
row is a letter Joseph sent, read from his Sent mail.

Every email has its words as HTML as well as text, so a mail app shows it in
its own font, wrapped to its window, where it would show a text-only one in
a fixed-width font or in lines broken at a set width. A letter, its copy and
a mailing, and an answer to a reply, have HTML of their own, from the
editor's document. For any other,
written only as text (a notice, a login link, an alert), `send()` makes it
from the text (`lib/plain-email-html.ts`): a paragraph for each block of
lines, a bulleted list of lines that start "- ", each web address a link.
The text itself goes unchanged beside it. Postmark is told to leave those links as
written (`TrackLinks`), so a login link never goes through Postmark's
address. A relay is its sender's message, as it came.

Admins read the log at `/staff/sent-emails` (`lib/server/sent-emails.ts`), a
page with no visible heading, as the menu names it. A row shows:

- someone outside PauseAI by their name, linked to their page. They're
  found through the row's letter, or by the address if only one person has
  it;
- its outcome, with a bounce or a spam complaint from `email_problems`;
- a link to its letter and its campaign or mailing.

A row never shows the email's text. An admin without `supporters` sees only
the kinds with no supporter's details on them
(`SENT_EMAILS_WITHOUT_SUPPORTERS`), and a line saying the rest aren't shown.

Every address an email is to, Cc'd or Bcc'd to has a name with it: the
person's own name on their own address, `"Jane Smith"
<jane.smith@example.com>`, and their name with "(via PauseAI)" on a proxy
(`nameLine` and `proxyLine` in `lib/server/proxies.ts`). The exception is
staff: we don't know a staff account's name, nor a shared inbox's, so a
login link, an alert or an event owner's email goes to the address alone.

When something needs a person, the site emails the notification inbox,
`NOTIFICATION_INBOX` (`notifyStaff` in `lib/server/notifications.ts`), once
each time it happens, with a link to where to deal with it:

- an MP's address bouncing a letter or relay, or anything else blocking the
  address of a politician in office (`lib/server/delivery-problems.ts`);
- once a day at most, the politicians in office whose addresses bounced a
  mailing's letter, or complained of it, since the last (`reportMailingBounces`);
- mail in the letters inbox it can't relay (`lib/server/gmail-reading.ts`);
- a job failing, or having a problem, that its run before didn't (`alertIfNew` in
  `lib/server/import-runs.ts`; "Imports", below);
- a Gmail account the read every 5 minutes couldn't read, after a run that could
  (`lib/server/gmail-reading.ts`); one Google disconnected has its own;
- a body's import held, when none was (`lib/server/politician-import.ts`);
- Google disconnecting a Gmail account (`lib/accounts/gmail-accounts.ts`);
- letters to MPs waiting over three hours to go, until those it named
  have gone (`LATE_HOURS` in `lib/server/letter-sending.ts`);
- once a day at most, a report of the supporters' copies that bounced
  since the last, each address's domain and what its server said, and
  how many replies to them are held (`lib/server/held-replies.ts`), to
  see whether the form should check addresses harder;
- an error outside an import's run, when it's new and at most once a day
  while it goes on, and a spam check refusing letter after letter
  ("Errors", below).

Others are told where they happen, above: an event to tag ("Supporters"),
mail that matches nothing ("One-off emails") and a WhatsApp template sent or
decided on ("Broadcasts to supporters").

The backup Worker emails its own problems, to its `ALERT_TO`
(`backup/README.md`).

When an email bounces or its recipient marks it as spam, the problem is
recorded against the address (`email_problems`). A hard bounce or a
complaint blocks the address (`email_blocks`), and `send()` won't send to a
blocked address, for any purpose. Staff see blocked addresses on two pages
over the same tables, split by whether the address is a politician's now:

- politicians' blocked addresses, on Addresses to fix
  (`/staff/politicians/addresses-to-fix`), and on the politician's page;
- every other (supporters', staff's and unknown ones), on Bounced emails
  (`/staff/supporters/bounced-emails`), for staff with `supporters`.

The two pages' first addresses, `/staff/politicians/blocked-emails` and
`/staff/supporters/blocked-emails`, redirect to them, as emails to staff
linked there (`next.config.ts`).

Staff can unblock an address that bounced, which asks Postmark to send to it
again, on both its streams (`unsuppress`). The transactional stream refusing
stops the unblock; the broadcast stream refusing doesn't, as a Postmark
server without that stream has nothing suppressed on it, though Postmark
failing does. A complaint can't be unblocked.

What a bounce means depends on the email's purpose, so each purpose can
have a hook (`lib/server/delivery-problems.ts`). A letter's hook marks the
letter bounced and emails staff. A purpose without a hook needs nothing
beyond the block.

A new kind of email is a new purpose: add it to `Purpose` and to the
`email_sends` CHECK in a migration, and a hook if a bounce should change
anything. If the email is about one record, as a letter is, `email_sends`
needs a column pointing at that kind of record, as `letter_id` does.

An address with "Do not email", in CiviCRM or as an opt-out of all email,
gets only what the person just asked for or did: a login link, a link to
the contact preferences page, a letter's copy and their MP's replies to it, which
to them is mail from their MP that we pass on, and the like (`TRANSACTIONAL`
in `lib/server/email.ts`); `send()` refuses any other. A broadcast's copies
go by `send()` too, each logged as `broadcast` with its copy ("Broadcasts
to supporters", above).

## Imports

A job that copies data in from outside:

- each body's members: Parliament's, the Scottish Parliament's, the
  Senedd's and the Northern Ireland Assembly's;
- the ControlAI letter, and ControlAI's statement;
- the Luma import;
- the CiviCRM import;
- the Gmail reading.

Two more jobs don't import but run on a schedule all the same: the
15-minute sending and the nightly tidying (`JOBS` in `lib/import-runs.ts`). Whatever a
scheduled job does, it goes here, despite the name
(`docs/code-structure.md`).

Each job runs on a schedule or when staff press its button, and every run is
recorded (`import_runs`):

- when it ran;
- who started it (`nightly` or a staff email);
- how it ended, and why it failed, if it did;
- its problems: what went wrong along the way without stopping it
  (`lib/server/problems.ts`). Each is a fixed sentence, with any count or
  list as its error;
- the job's own account of what it found.

A run with problems is amber, "Problems", and lists them under its line.
Staff are emailed about a failure, or about a problem the run before didn't
have. So a job that keeps going wrong the same way says so once, until a run
goes right (`lib/server/import-runs.ts`). A problem with an alert of its
own, such as a Gmail account Google disconnected, is marked told, so the
run's email leaves it out. A run can be held for staff to decide on, as a
body's import that would change too much is.

`/staff/scheduled-jobs` shows each job's newest run on a card. Each job's own
page (`/staff/scheduled-jobs/<slug>`, `importPath()` in `lib/import-runs.ts`)
has its button and every run it keeps (`lib/server/log-retention.ts`, run
nightly):

- for a 5-minute, 15-minute or hourly job, a week of runs, and a month of those that
  failed or had problems;
- for a nightly job, a month of runs;
- for every job, its newest run and a held run.

One run of a job goes at a time, whoever starts it, its schedule or a staff
member's press (`runJob()` in `lib/server/jobs.ts`). A run marks the job
running (`job_presses`) until it ends, or for 5 minutes if it dies, and the
job's page says so. A run started meanwhile doesn't go, and keeps no run, as
it did nothing.

Each run is a request to the site, which Netlify stops at 30 seconds. So a
job with more to do than that, as the Luma import has, works for its budget
(`JOBS`) and leaves the rest for the next run.

A job's page shows its runs under a heading for each day (`lib/run-log.ts`).
A job that runs every 5 or 15 minutes or hourly makes many runs a day,
nearly all alike. So its page shows them in three ways:

- runs that found nothing are gathered together;
- routine runs (of the Luma import and the Gmail reading) are counts;
- anything else, a failure above all, shows whole.

How a page lays that out is in the style guide ("A job's log").

A new job needs:

- its name, page slug and schedule in `JOBS` (`lib/import-runs.ts`);
- its name in the `import_runs` CHECK;
- a result type, and how a run shows (`Run.tsx`);
- a function that does it inside `asRun()`, which keeps the run, named in
  `lib/server/jobs.ts`;
- its title (`jobTitles`), icon and description (`ImportJob.tsx`);
- if it runs on a schedule, a scheduled function in
  `netlify/functions/<job>/` (`netlify/scheduled.ts`), whose schedule a test
  checks against `JOBS`.

A job that has more to do than a run allows, as the Luma import has, keeps
its place and says in its result what's left.

## Errors

What goes wrong outside a job's run is kept, so that it reaches someone
(`errors_seen`, `lib/server/errors-seen.ts`). A job's failures and problems
are its run's ("Imports", above), not these. Three things are kept:

- **An error the server throws** in a page, a route handler, a Server
  Action or the proxy. Next hands each to `onRequestError`
  (`instrumentation.ts`,
  https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation).
- **A problem reported outside a run**: code that catches an error and
  carries on calls `problem()` (`lib/server/problems.ts`), which in a form
  or a webhook has no run to keep it on. It's kept by its sentence, with
  the error's words. One whose own alert has gone (`told`) isn't.
- **An error in a visitor's browser**, which the server never sees. An
  error page (`app/global-error.tsx`, with `components/layout/useErrorTold.ts`)
  posts what lost the visitor the page, and a listener
  (`components/layout/ErrorReporter.tsx`, in the root layout) anything else
  thrown from our own scripts, to `/api/browser-error`
  (`lib/browser-errors.ts`).

**One row an error.** Two happenings are the same error when their key
matches: what was running (its kind), where (the route's pattern, never
the request's path, which can hold an ID or a token; for a browser's, the
page's path with each part that's an ID or a number stood for), the
error's class, and its words with what varies taken out, so "No politician
4127" and "No politician 4128" are one (`lib/error-key.ts`). A Postgres
error is known by its code and constraint, and nothing of its message,
which can quote the value it refused. The key is coarse on purpose: two
bugs sharing a row are found a day apart, but one bug making a row each
time would fill the list and the inbox. A row counts its happenings, and
keeps the newest as it was thrown, with its stack trace and, for a
browser's, the browser's name and version.

**Who's told.** The notification inbox is emailed about a new error, and
at most once a day while it goes on, saying how many more times. The row
is taken before the email is sent, so two requests failing at once send
one. At most `SERVER_EMAILS_AN_HOUR` go in an hour, then one saying there
are many, then none until the hour is up. An email holds the error's words
with what varies taken out, never as thrown, as what's sent to Gmail can't
be erased from here. What a browser throws that doesn't lose the page is
kept and never emailed about, as much of it isn't ours (extensions, in-app
browsers), unless its words have earned an email
(`BROWSER_WORDS_EMAILED`). Nothing is kept in development, where the error
is on the screen, and nothing is emailed where `NOTIFICATION_INBOX` isn't
set. Next answers a missing page, a redirect, and a Server Action posted
by a browser on an older deploy itself, without calling the hook, so none
of those is kept.

**What a browser posts is whatever anyone sends.** So the route takes
only a page of the site's own (the browser's `Sec-Fetch-Site`), caps the
body and cuts each field short; only `NEW_BROWSER_ERRORS_AN_HOUR` new
errors from browsers are kept in an hour, though one already kept is still
counted; their emails have an hour's limit of their own
(`BROWSER_EMAILS_AN_HOUR`), so junk can't use up the server's and hide a
real error; and an email about one says which page, and quotes none of it.
A page tells of each error once, and of `REPORTS_A_PAGE` at most.

**What people see.** Admins see every error at `/staff/errors`, the one
seen most recently first, and each on its own page, with the latest as it
was thrown. An admin marks one done from its page, which moves it from the
To do tab to Done, saying who and when; happening again moves it back.
Emails about it go on as before: marking it done changes neither when the
next is due nor what it says. Visitors and staff alike see Next's own error page in place of
a page that threw, the one it shows when a site has none
(`app/global-error.tsx`): it says only that the page couldn't load, and,
for an error on the server, Next's digest of it, as Next keeps a server
error's words from the browser. The nightly tidying
deletes an error not seen for a month (`lib/server/log-retention.ts`), so
one that's fixed drops off by itself.

Not covered yet: the site being down, or a scheduled job that stops
running, which keep nothing and need a monitor outside the site; a check
that refuses everyone without throwing, such as a broken spam check on
letters to MPs; and
mapping a browser's minified stack trace back to the source.

## Saved filters

A saved filter is a staff list's filters under a name, for everyone who can
open that list (`saved_filters`, `lib/server/saved-filters.ts`, and
`ui/SavedFilters` for how it looks). Politicians, Supporters, Events and the
audit log have them. Anyone who can open a list can update, rename or delete
any of its saved filters. The audit log records each change by the filter's
ID and list, never its name or parameters, which can name a supporter.

Every admin sees the audit log's saved filters, including an admin who may
not see supporters. A filter's name or search can name a supporter, though
entries about supporters stay hidden from that admin whichever filter is on.

A saved filter holds the list's URL parameters (`savedParams()`,
`lib/saved-filters.ts`): the search and every filter, the tab and the sort.
It never holds the page, or who a mailing or broadcast is being chosen for.
The lists that have saved filters aren't `FILTER_LISTS`, which is the lists
a mailing can be to.

Filters live in the URL, so loading one is a link to its parameters and
`saved=<id>`, which every link in the bar keeps. Nothing is held in the
browser: each page compares its URL with the filter it names, ignoring
order and blanks, to know whether it's been edited. An ID that's unknown,
deleted or another list's loads nothing.

A saved filter can hold a value that no longer exists (`filterProblems()`).
The list leaves that value out, the page says so over the list, and it
doesn't count as an edit. Saving an edit to the filter takes the value out
for good.

Erasing a supporter takes their exact names, emails, phone numbers and
postcode, ignoring case, out of every saved filter's name and typed
parameters (`docs/data-protection.md`).

## The audit log

Every change made by staff, or by something acting on its own, records who,
what and the details (`audit_log`, `lib/server/audit.ts`). The actor is a
staff email, or the name of what did it: `sync`, `controlai`, `postmark`,
`send-mailings`, `google`. Admins read the log at `/staff/audit-log`,
searched and filtered by who, what and how recent, and sorted by date, who
or what. A new kind of change logs itself the same way, inside the same
transaction as the change. An entry is kept for a month. One that's part of
a politician's history is kept while the politician is
(`lib/server/log-retention.ts`).

### What is logged, and when

The rule: **every change to a record about a person or a politician is
logged once, against that record, by whoever or whatever made it**, in the
same transaction. So the record's own page can tell its history
(`politicianHistory` in `lib/server/politicians.ts`; a supporter's
history comes from the records themselves). A job that changes many
records logs one summary entry for the run, and one entry per record it
changed.

Reading is logged only where the data is personal and leaves the site: each
download of a list of supporters or their blocked addresses. Nothing else
about reading is logged.

| Action                                                                                                                | Actor                                | When                                                                                                                                                            | Details name                                                                           |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `add politician`                                                                                                      | a body's import                      | A body's import adds a politician                                                                                                                               | `id`, and their details                                                                |
| `edit politician`                                                                                                     | a body's import, `sync`, staff       | An import changes a politician's details, or marks them left; staff change a salutation, marker or a Lord's email; earlier, the copy from Airtable changed them | `id`, `name`, and each field `changed`, before and after; a leaver's `date` and `note` |
| `remove politician`, `delete politician`                                                                              | `sync`, staff                        | Earlier: the politician sync found a record no longer in Airtable; staff deleted one gone                                                                       | `id`, `name`                                                                           |
| `set status`                                                                                                          | staff, `controlai`                   | A status set or cleared, by hand or by an import of ControlAI's letter or statement                                                                             | `politicianId`, `ask`, `status`, `date`, `note`                                        |
| `apply politician import`, `hold politician import`, `apply held politician import`, `discard held politician import` | a body's import, staff               | Each import's outcome, and each decision on a held one                                                                                                          | the `job`, and counts, or the run's `id`                                               |
| `import ControlAI letter`                                                                                             | `controlai`                          | A read of the letter that set or cleared any status                                                                                                             | counts                                                                                 |
| `add ask`, `edit ask`, `delete ask`                                                                                   | staff                                | The asks pages                                                                                                                                                  | `slug`, and the ask's fields                                                           |
| `add note`, `edit note`, `delete note`                                                                                | staff                                | A note on a politician or a supporter                                                                                                                           | `noteId`, and whose it is                                                              |
| `save filter`, `update filter`, `rename filter`, `delete filter`                                                      | staff                                | A saved filter on a staff list                                                                                                                                  | `id`, `list`                                                                           |
| `create mailing`, `schedule mailing`, `reschedule mailing`, `stop mailing`, `delete mailing`                          | staff                                | A mailing written on the site                                                                                                                                   | `id`, and `recipients`, `dueAt` or what it `was`                                       |
| `start mailing`, `finish mailing`                                                                                     | `send-mailings`                      | The hourly job starts a scheduled mailing, and sends its last letter                                                                                            | `id`                                                                                   |
| `create broadcast`, `change broadcast consent`, `schedule broadcast`, `stop broadcast`, `resume broadcast`            | staff                                | A broadcast to supporters                                                                                                                                       | `id`, and `channel`, `topic`, `recipients` or what it `was`                            |
| `submit broadcast template`, `withdraw broadcast template`                                                            | staff                                | A text's words sent to WhatsApp for approval, or taken back                                                                                                     | `id`, and the template's `name`                                                        |
| `set event owner`, `set event doc`                                                                                    | staff, `sync`                        | An event's owner or Google Doc set on the events page, or an owner given by the rules                                                                           | `eventId`, `owner` or `url`, `previous`                                                |
| `import sign-ups`                                                                                                     | staff                                | A file of paper sign-ups imported                                                                                                                               | `uploadId`, `imported`, `heldBack`                                                     |
| `block address`, `unblock address`                                                                                    | `postmark`, staff                    | A bounce or complaint blocks an address; staff unblock it                                                                                                       | `address`, and the `kind` or the `note`                                                |
| `add staff account`, `set staff permissions`, `remove staff account`, `end staff sessions`                            | staff, or the address on first login | The accounts page, a first login, and sessions ended from the accounts page or `/staff/me`                                                                      | `email`, the permissions `from` and `to`, or `sessions`                                |
| `connect gmail`, `disconnect gmail`                                                                                   | staff, `google`                      | A Gmail connected or disconnected on `/staff/me`, or by Google                                                                                                  | `email`, and `why`                                                                     |
| `download supporters`, `download blocked emails`                                                                      | staff                                | A list of supporters, or of blocked addresses with theirs, is downloaded, as CSV, JSON or vCard                                                                 | the list's `filters` in words, the `format`, how many `rows`                           |
| `erase supporter`                                                                                                     | staff                                | A supporter is erased                                                                                                                                           | `id`, the request's `reference`, and what went                                         |

Earlier entries keep their own names (`EarlierAuditDetails` in
`lib/audit-events.ts`):

- from before asks and the politician sync: a status set by `campaign`, or
  with `airtable` as its actor, `apply MP sync` and the rest, and
  `import signatories from Airtable`;
- `import web form letters` and `copy PauseAI emails`, from the one-off
  imports of pauseai.info's web form letters and of PauseAI's emails from
  Airtable;
- `view supporter` (`id`), from when each opening of a supporter's page was
  logged;
- `download letters`, from when letters had a download of their own.

Details don't name a supporter. A supporter is given by `id`, and an erasure
by its reference, so the log stays after the person is gone. A blocked
address may be a supporter's, and a download's filters may name one. A
politician's details are public, so theirs are logged in full.

An admin without `supporters` sees the log, and its download, without these
entries (`WITHOUT_SUPPORTERS` in `lib/server/audit.ts`), and with a line
saying so:

- entries about a supporter or a broadcast;
- downloads;
- entries about an address that isn't a politician's.

A new kind of change that names a supporter's details needs adding there.

A new kind of change adds a row to the table above and logs itself the same
way. If it
changes a politician, it names `id` or `politicianId` so `politicianHistory`
finds it. If it blocks or frees an address, it names `address`.

## Staff

Anyone with a pauseai.uk email address can log in, with a link sent to
that address (`lib/accounts/auth.ts`, `staff-login.ts`). A session
lasts a day. With "Keep me signed in" it lasts 30 days, renewed on use.
Anyone at pauseai.uk can be staff, paid or volunteer. The mailbox decides
who can log in: a leaver's Google account is suspended or deleted, so no
login link reaches them. That relies on a suspended or deleted Google
account not receiving mail, and on a leaver's mail not being forwarded or
aliased to someone else, who could then log in as them.

The first login gives an address a staff account (`staff_accounts`) with
no permissions, added by `login`. Admins give permissions on
`/staff/accounts`, where they can also add someone before their first
login. To limit someone who's staying, take away their permissions rather
than removing the account: after Remove, logging in again makes a new
account with none.

An account opens the pages about politicians, events and imports
(politicians, an MP's page, asks, mailings, Correspondence, Politicians' blocked
emails, events, imports). Permissions open more
(`lib/accounts/permissions.ts`):

- `supporters` opens every page with a member of the public's details
  (supporters, broadcasts, campaigns and their letters, who wrote to which
  MP, Bounced emails, Import sign-ups).
- `admin` opens the accounts page, the audit log and the sent emails. It
  doesn't include `supporters`.

Some pages show less without `supporters`:

- the events page has no hosts;
- Correspondence hides a thread with someone else in it;
- the sent emails and the audit log leave out what's about a supporter;
- on an MP's page, the letters come from a query that doesn't select their
  senders, so none reach the browser.

`admin@pauseai.uk` starts with an account and the admin permission, as an
ordinary row the migration adds. Removing an account ends its sessions. The
last admin can't be removed or lose admin.

The accounts page shows, for each account:

- when it was added and by whom (or by its login);
- when it last logged in and was last seen (`last_login_at` and
  `last_seen_at`, kept on the account, as sessions are deleted when they
  end);
- its open sessions, which an admin can end.

Anyone logged in on more than one device sees how many under Log out. A
staff member's address in the navigation links to their own page
(`/staff/me`). It has their sessions, where they can end them all, and
their Gmail, which they connect there to send mailings from ("Mailings to
politicians", above).

Each page in the navigation, and so each page under it, has the permission
`lib/staff-sections.ts` gives it, and asks for it in `requireStaff()`: an
account (the default) or a permission.
`tests/checks/staff-auth.test.ts` checks the two agree, and the
`permissions` storyboard section checks that, with no permissions, no page
holds a supporter's name or email. Every change to an account is an audit
log entry.

A new permission is a name in `PERMISSIONS` and the table's `CHECK`, and the
pages it opens given it in `STAFF_SECTIONS`.

A link in the navigation shows a "new" tag for 3 days after that person
first sees it (a dot on the folded rail). That goes for any page added to
`STAFF_SECTIONS`, with nothing else to do. `staff_nav_seen` has a row for
each account and page, with when they first saw it, and the signed-in layout
adds a row for each page an account has none for
(`lib/accounts/nav-seen.ts`). A new account has no rows, so its pages
are marked as long since seen, except a page whose entry gives the day it
went live (`added`): that's marked as seen then, so for its first days it's
new to a new account too, and to a fresh development database, whose
accounts start with no rows. A permission gained opens pages that are new
to that person. The layout is kept between pages, so the tag goes at the
next full page load.

A page to try out that can't do its job yet, such as Broadcasts with no
backend for sending, shows a "draft" tag instead, for everyone.

## The public site's content

The rest of the site is content more than data: people's stories, local
groups and their pages, press coverage, blog posts, the board
(`lib/content/`). Events are the exception: Luma's calendar is the source
of truth, and the public pages read it live; the copy the import keeps is
for the staff interface, not for them.
