# Politicians without Airtable

Politicians' details come every night from the official sources, the
little that no source has is kept on the site, and the syncs from
Airtable's "UK Politicians" base are switched off.

Phase 1 makes the site the place politicians are kept, with fresh data
from the official sources; phase 2 removes what's left of Airtable. Each
is one pull request.

## What replaces each Airtable field

The nightly `sync-politicians` job copies the politicians from base
`appBInVvIm6opJ1Ob` (`lib/server/politician-sync.ts`).

| Airtable                                                | Replaced by                                              |
| ------------------------------------------------------- | -------------------------------------------------------- |
| Name, body, constituency, party, country, email, status | The official sources, every night                        |
| Salutation                                              | Made by rule from the sources' name fields               |
| Notes, Recommended                                      | A note in their history                                  |
| Important target, Personal connection                   | Staff: no source can know them                           |
| Signed Frontier AI Letter, Edinburgh conference         | Their asks' answers, which staff already record          |
| Signed DeepMind Letter                                  | Nothing; the letter was in 2025, so it's kept            |
| ControlAI Signatory                                     | ControlAI's own page, every night                        |
| Emails table                                            | Mailings sent from the site; the history is kept         |
| Test records                                            | The site's own test politicians                          |
| Web form emails, Go to Parliament                       | Nothing; both were imported once already                 |

## What staff edit

Almost nothing, as the sources cover nearly every field:

- Important target and personal connection, two ticks. They're
  judgements, so no source has them.
- A salutation, only to correct one made from the sources.
- A Lord's email (below).

No politician is added by hand (none has ever been outside the five bodies),
and no status is edited: the imports keep both.

An address that's wrong in the official list is corrected with the
staff addresses that already exist (`politician_addresses`). Asks'
answers and notes are already edited on the site.

## The politician's band

- **Marks**, a fact after Email in the band at the top of a politician's
  page, holds what are now tags beside their name: important target and
  personal connection, each one switched on or off there, and test,
  shown but not editable. On the politicians list they stay tags.
- **Salutation**, a fact of its own beside Email, labelled, with its mark
  when it's waiting to be checked, which leads to Writing to them: the
  section at the foot of the page that was Email addresses, now with a form
  for the salutation and a Lord's email over the addresses.
- **No longer in Airtable** goes with Airtable. It has no counterpart
  for the official sources: someone who drops off a body's list has
  left it, so the sync sets their status (died, retired, no longer in
  office) with the date and reason, and that shows in Status. Supporters'
  "No longer shared with us by CiviCRM" stays, as a supporter can leave
  CiviCRM while still being ours.
- The corner's "Source: Airtable", and its link to edit there, becomes
  the official source, linking to the politician's profile on it, such
  as `members.parliament.uk/member/{id}`.

## Official sources

Each politician stores the ID their legislature gives them, so someone
who leaves and comes back, or moves from one house to another, stays
one record. No other keys are stored: the official ID is enough to find
a politician elsewhere when it's needed, as a new MSP's gender is found
in Wikidata (see Salutations).

| Body                | Source                                                                                              | ID                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Commons and Lords   | [Members API](https://members-api.parliament.uk/)                                                   | `id`, the same in both Houses (Baroness May is 8 in both)        |
| Scottish Parliament | [data.parliament.scot](https://data.parliament.scot/api/members)                                    | `PersonID`                                                       |
| NI Assembly         | [data.niassembly.gov.uk](https://data.niassembly.gov.uk/members.asmx)                               | `PersonId`                                                       |
| Senedd              | [`GetCouncillorsByWard`](https://business.senedd.wales/mgwebservice.asmx/GetCouncillorsByWard), XML | `councillorid`, the same across terms (Huw Irranca-Davies, 5053) |

All four give each member's name, party, constituency and email.

- Parliament's Members Data Platform gives each House's sitting members,
  with their addresses, gender and list name, in one answer
  (`house=Commons|Membership=current/Addresses/`): two requests in all,
  rather than one a member from the Members API, which gives only why a
  membership ended.
- The Scottish Parliament gives emails and parties from separate
  endpoints, keyed by `PersonID`.
- The NI Assembly gives emails from `GetAllMemberContactDetails_JSON`,
  in a field spelt `EmaiAddress`. Its `MemberPrefix` and
  `MemberLastName` fields make a salutation, such as "Dr Aiken".
- The Senedd lists members under their constituency (`wardtitle`), with
  their terms of office. On 13 November it answered a plain request with
  all 96 members of the Senedd elected in May 2026, one entry each, each
  with an email on `senedd.wales`, across its 16 constituencies. It had
  refused one with a 403 on 7 November. On 13 November it still refused
  curl's default User-Agent with a 403, but answered one of our own, which
  likely explains the 7 November refusal. So the import sends a User-Agent
  of its own, and is assumed to work from Netlify, to be revisited if it
  doesn't. It lists only the current term,
  so someone who leaves drops off it. Its names have no title and it
  has no gender (`fullusername` is "Steve Bayliss MS"), so a salutation
  needs a title or gender from elsewhere. We hold 60 members, from the
  Senedd before May's election.

- Politicians' own domains come with each body's sync. An email address
  on one of those domains shows whose office a thread is from
  (`docs/domain-concepts.md`). A domain counts only if it belongs to one
  politician, and social media and party sites are skipped. The Scottish
  Parliament's `websites` and `emailaddresses` endpoints have them. Up to
  53 of its 129 current members list a site that isn't parliament.scot's,
  and that count includes party sites, social media and malformed links.
  The Senedd's `additionalcontactinfo` has few, and most of those are
  social media. The NI Assembly's contact details have only its own
  domains.

## Salutations

Made by a rule from each source's name fields, with no LLM:

- **MPs:** the title in `nameListAs` ("Abbott, Ms Diane") and the
  surname, "Ms Abbott". Sir and Dame take the first name, "Sir Mark".
  With no title, Mr or Ms from `gender`.
- **Lords:** `nameDisplayAs` without the place, "Lord Smith of Finsbury"
  becoming "Lord Smith", and Baroness becoming Lady. Bishops are
  "Bishop" and archbishops "Archbishop"; earls, viscounts and the like
  are "Lord" and their title's name, "Lord Kinnoull".
- **NI Assembly:** `MemberPrefix` and `MemberLastName`, "Dr Aiken".
- **Scottish Parliament and Senedd:** Mr or Ms and the surname, from
  their gender in Wikidata (P21). Neither source gives a title or a
  gender: the Scottish Parliament's `GenderTypeID` is 3 for every
  current member. Wikidata is found by ID, never by name: an MSP by
  their TheyWorkForYou ID (P2171), looked up when they're added in
  TheyWorkForYou's
  [people data](https://github.com/mysociety/parlparse/blob/master/members/people.json),
  which links it to their `PersonID`, and a Senedd member by their Senedd ID (P4651),
  their `councillorid`. Our MSPs' salutations also have names in the
  wrong case, such as "Mr Mcarthur", which the official names fix.
- **Anyone whose gender isn't male or female:** their title if they
  have one, otherwise Mx, for staff to check.
- **Gender isn't stored, or edited:** it's read only to make the
  salutation, which is what staff see and correct. A salutation says
  more than gender can (Dr, Sir, Lady, Mx), and not keeping gender
  keeps a sensitive field out of the database.
- **Anyone whose gender isn't known:** their full name, "Jane Smith",
  never a guess. Today every sitting member has one (Parliament gives
  all 650 MPs', and Wikidata every MSP's and Senedd member's), but a
  newly elected member may reach Wikidata or TheyWorkForYou's data days
  or weeks after their body lists them. Their salutation is marked to
  check, which shows on their page and on the staff home page, and each
  night the import looks again: once it finds their gender, it makes
  their salutation by the rule, unless staff have set one by then.

On 13 November, Wikidata had a gender for all 129 current MSPs and all
96 Senedd members this way. Of those Airtable also had, it agreed with
all 126 MSPs and all 27 Senedd members. One MSP's Wikidata gender is
neither male nor female, and Airtable has them as "Dr". Wikidata's own
link from TheyWorkForYou's data covers far fewer (52 MSPs, 30 Senedd
members), so it isn't the way in.

On 13 November, the rule agreed with Airtable for 636 of 650 MPs and 314
of 323 of our Lords. Where they differed, the rule was mostly right:
Airtable had five MPs' genders wrong, left off five Dr, Sir or Dame
titles, cut two double-barrelled surnames short and misspelt one name.
The rest were the bishops, an earl and a viscount, which the rule above
now covers, and "Mrs Brackenridge", which may be her own choice.

The rule makes the salutation of each politician added. Where it
differs from one we hold, the difference is listed once for staff, who
take the rule's or keep ours.

The rule's tests cover every case above with the real names: each
title, no title with each gender, Sir and Dame, double-barrelled and
two-word surnames, accented names, Lords with and without a place, a
baroness, bishops and an archbishop, an earl, a viscount, and each
body's own fields.

## What the first imports will find

On 13 November, our sitting politicians against the official lists:

- **Scottish Parliament:** all 129 emails match.
- **Commons:** 643 of 650 match. Two have a council or department
  address rather than their MP one (a Camden council address, and a
  DCMS private office), one an old-style `parliament.uk` address, and
  two our `parliament.uk` one where Parliament lists their own site's.
  Two have none listed.
- **NI Assembly:** 85 of 90 match. Four MLAs we hold have been replaced
  since, and their replacements are missing. One minister's listed
  address is his department's.
- **Senedd:** we hold the Senedd before May's election. 33 of our 60
  aren't members now, and 36 members are missing. The 27 re-elected all
  have old addresses (`Adam.Price@senedd.wales` where the Senedd lists
  `adam.price-ms@senedd.wales`, and some on `senedd.cymru`).
- **Lords:** as below. 16 sitting Lords have a Gmail, BT, AOL, Yahoo,
  Hotmail or Outlook address, which may be right: Lords have no office.
  One retired Lord's address bounced.

No email is malformed or shared by two politicians.

Phase 1 fixes the clearly wrong ones:

- A migration replaces the wrong emails with the ones the bodies list:
  the 27 re-elected Senedd members' old addresses, Dame Angela Eagle's
  old-style one, Sagal Abdi-Wali's Camden council address and Ian
  Murray's DCMS private office. Each replaced address goes in
  `politician_addresses` as a past one, still linking threads. It
  matches each politician by their old address, so on a database
  without them (a preview's, the tests') it changes nothing. These are
  public figures' addresses in their public role, so they can be in the
  repo.
- The import does the rest, as it does every night: the 33 Senedd
  members who aren't members now and the four replaced MLAs are marked
  as having left office, and the 36 Senedd members and four MLAs
  missing are added.

After the migration, the emails we hold that their body doesn't list
are ones to keep, such as an MP's `parliament.uk` address where
Parliament lists their own site's, so the import's rule for emails
(below) needs no exception for a first run.

## Phases

### 1. Every politician from the official sources

Fresh data for all four bodies, without waiting on anything else.

- Add each body's ID to `politicians`, unique within the body. Match
  the politicians we have to the official lists once, by name, body and
  constituency, and list any that don't match so staff can match them
  by hand.
- One import per source, each a scheduled job of its own, with its own
  row on the Import page and its own runs in the import log:
  - `import-parliament`, the Commons and Lords from the Members API. It
    replaces the `check-mps` job (`lib/server/mp-check.ts`), which
    already reads the API every night only to compare: now it applies
    what it finds.
  - `import-scottish-parliament`, `import-senedd` and
    `import-ni-assembly`, from theirs. `import-senedd` sends a User-Agent
    of our own, as the Senedd refuses curl's default with a 403 (above).
- Each updates its members' names, parties, constituencies, emails and
  status, with the reason a membership ended, and adds new members with
  a salutation made by rule (above).
- Each has its own mark beside it on the Import page and the scheduled
  jobs, as Parliament's portcullis already does (`ImportIcon.tsx`):
  drawn plainly in the body's colours, not its official emblem, after
  checking each body's terms for its logo, as Parliament restricts its
  crowned portcullis. The politician's band shows their body's mark by
  the source in its corner.
- Every address a body lists goes in `politician_addresses`, except
  shared ones. An address it stops listing stays there, as a past one.
  A politician's email is kept as below, for every body.
- Every sitting Lord is added, with their email as below.
- A large change is held for someone to check, as now: it shows on the
  staff home page, the notification inbox is emailed about it, and it
  can be applied on the Import page.
- The Airtable sync comes off the nightly schedule, so from then on the
  site's data is the one that's kept up to date, and Airtable's goes
  stale. It stays as a button on the Import page, run by hand if staff
  have changed something in Airtable since, and it copies only what the
  official sources don't have: salutations, ticks and notes.
- So staff edit those on the site from the start: the band changes as
  above, with Marks, important target and personal connection switched
  on and off there, and the official source in the corner. Staff
  correct a salutation and set a Lord's email in Writing to them.
- **ControlAI's statement.** Read
  [controlai.org/statement](https://controlai.org/statement) every
  night, with the statuses owned by `controlai`, as `import-controlai`
  already does for ControlAI's letter to the PM
  (`lib/server/controlai-import.ts`). Each supporter on the page links
  to their official profile, so most can be matched by ID: on 28
  October, 141 linked to `members.parliament.uk/member/{id}` and 26 to
  `aims.niassembly.gov.uk` with a `per=` ID. The 14 Scottish and 5
  Senedd links contain a name, so those are matched by name. If the
  page has too few names, nothing is changed, as with the letter. It's
  still growing: on 13 November, 145 linked to Parliament. With every
  sitting MP, Lord, MSP, MLA and Senedd member on our list, every
  supporter should match someone, so one who doesn't is a fault,
  reported in the run like the letter's problems, not passed over.

#### Postcodes still find every MP

Email your MP finds an MP from a postcode: postcodes.io gives the
postcode's constituency code, `lib/constituencies.ts` turns it into the
ONS's official name, and the MP is the one in office whose
`constituency` is exactly that name (`lib/server/find-mp.ts`). So
`import-parliament` must store exactly the ONS names. On 13 November,
all 650 of the Members API's constituency names (`membershipFrom`)
were the ONS's exactly, Ynys Môn and Montgomeryshire and Glyndŵr
included, and every ONS constituency had one MP. The API gives no ONS
code to match by instead.

To keep it so:

- `import-parliament` writes an MP's constituency only if it's an
  official name (`isOfficialName`). One that isn't holds the run for
  someone to check, as the MP check reports it now, rather than leaving
  an MP no postcode finds.
- After every run, it checks each of the 650 constituencies has exactly
  one MP in office: none is reported as a vacancy (a death or
  resignation before a by-election, which Parliament shows too), two as
  a fault.
- A test runs a postcode for every one of the 650 codes against
  fixture data built from the Members API's names, and expects each to
  find its MP. Others cover the spellings that differ from
  postcodes.io's, a vacancy, a by-election winner, and an MP whose seat
  changes name.
- After the boundary review, `lib/constituencies.json` is replaced from
  the ONS's new list before the import first reads the new seats.

### 2. Remove Airtable

Once phase 1 has run for a few weeks and nobody has needed the button:

- Each politician's Airtable notes become one note in their history,
  with a line saying Recommended if it was ticked. The note is written
  by "Airtable" and dated the day Airtable is switched off. Then
  `notable_people.notes` and the Notes from Airtable card go.
- Remove the sync, its button, its rows on the Import page and the token's access
  to the base. `AIRTABLE_TOKEN` stays, as the members import reads its
  own base with it. Politicians keep their `airtable_id`.
- Link the threads sent to the shared inbox to the Lord each is for
  (below).

## Lords' addresses

One-off emails link to politicians by more than their email: Parliament's lists, the forms their name makes, their offices', and addresses staff add (`docs/domain-concepts.md`, "One-off emails"). The sync adds to Parliament's lists in `politician_addresses`.

### Where our Lords' emails came from

We hold 380 Lords, all from Airtable, each with an email of their own. On 13
November, compared with the Members API's contact details:

| Our email                                             | Lords | In office |
| ----------------------------------------------------- | ----- | --------- |
| One Parliament lists for them                         | 295   | 295       |
| Parliament lists none for them (it drops past Lords') | 57    | 1         |
| Not the one Parliament lists for them                 | 16    | 16        |
| Parliament lists only the shared inbox                | 12    | 12        |

So nearly all came from Parliament, and 28 sitting Lords' were found
elsewhere. No other source has more: Wikidata has an email for no sitting Lord,
and WriteToThem's Lords come from mySociety's own database, which isn't
published.

### The shared inbox

478 of the 815 sitting Lords list only `contactholmember@parliament.uk`, which
the House forwards to the Lord named. Lords disregard more than a handful of
messages from one person, or of much the same words, within a couple of days
([WriteToThem](https://github.com/mysociety/writetothem/blob/master/templates/website/problem-lords-similar.html)),
so a mailing through it would be wasted. Other Lords share a few addresses among
them too.

The shared inbox is never stored: not as a Lord's email, and not in
`politician_addresses`, where one thread would link to all 478. A Lord with only
that has no email.

It's hard-coded, not left to the import noticing that several Lords share it: a
constant names `contactholmember@parliament.uk` as a shared inbox, and a check
constraint on `notable_people.email` and `politician_addresses.address` refuses
it, so neither the import, a migration, nor staff setting a Lord's email can
store it. The staff form says why. Other addresses several politicians list are
still kept out by the import, as now.

### A politician's email

The same for every body, not just the Lords:

- A politician already on our list keeps their email. If their body lists a
  different one, that goes in `politician_addresses` as theirs too, so threads
  from it link to them, as every address there does (`docs/domain-concepts.md`,
  "One-off emails"), but letters keep going to ours.
- Except where ours is one the body listed and has since dropped: then the
  address it lists now becomes their email, and ours stays in
  `politician_addresses` as a past one, still linking.
- A politician new to our list gets the address their body lists, or no email.
- Staff can set or change a Lord's email, for one found elsewhere.

### Lords with only the shared inbox

14 one-off threads went to the shared inbox, so they link to no one. The House
asks for the Lord's name in the subject, and all 14 have it: "For Baroness
Verma: Request to co-sign…". In phase 2, a thread to or from the shared inbox
whose subject starts "For" and a Lord's name links to that Lord, matched
against every sitting Lord, now that they're all on our list. A name that
matches no Lord, or more than one, links to no one and is listed for staff to
link by hand. The tests use these subjects' forms: Lord, Baroness, with and
without a place, "Re:" and "Fwd:" in front, and a name that matches none.

### Afterwards: letters with no sent email

Some one-off threads are really a letter's sent email, kept as a one-off because
its address wasn't known. Hillier's letters of 12 June, 8 July and 25 July 2025
have no sent email, and threads to `meghilliermp@` start on those days. Across
all politicians, 15 letters with no sent email fall within a day of a thread
this would link.

The wider book helps the import's matching, but moving those threads onto their
letters is a separate pull request, as the import is a one-off run by a
button.

## Open questions

None. Nobody sends mailings from Airtable now that they're sent from
the site, so phase 1 can take its sync off the schedule.
