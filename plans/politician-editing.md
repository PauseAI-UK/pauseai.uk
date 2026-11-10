# Politicians without Airtable

Politicians' details are updated every night from the official sources,
staff edit everything else on the site, and the syncs from Airtable's
"UK Politicians" base are switched off. This is one pull request, after
the separate one that links one-off emails by more addresses (see "More
addresses for each politician").

Most of it can be built now. Switching Airtable off waits until Joseph
sends mailings from the site rather than Airtable.

## What replaces each Airtable field

The nightly `sync-politicians` job copies two tables from base
`appBInVvIm6opJ1Ob`: the politicians (`lib/server/politician-sync.ts`)
and the Emails table (`lib/server/emails-sync.ts`). Two one-off imports
also read that base (`lib/server/outside-services/airtable.ts`).

| Airtable                                                | Replaced by                                       |
| ------------------------------------------------------- | ------------------------------------------------- |
| Name, body, constituency, party, country, email, status | The official sources, every night                 |
| Salutation                                              | Staff, with a new politician's drafted by an LLM  |
| Notes, Recommended                                      | A note in their history, from Airtable            |
| Important target, Personal connection                   | Staff                                             |
| Signed Frontier AI Letter, Edinburgh conference         | Staff                                             |
| Signed DeepMind Letter                                  | Nothing; the letter was in 2025, so it's kept     |
| ControlAI Signatory                                     | ControlAI's own page, every night                 |
| Emails table                                            | Mailings sent from the site; the history is kept  |
| Test records                                            | The site's own test politicians                   |
| Web form emails, Go to Parliament                       | Nothing; both were imported once already          |

The members import reads a different base, Stichting PauseAI's
"Members & Actions", and isn't affected.

## Official sources

Each politician stores the ID their legislature gives them, so someone
who leaves and comes back, or moves from one house to another, stays
one record. Alongside it, a column for each standard key that other
sources use, so a politician can be matched to them without a name
lookup: a Wikipedia article title, a TheyWorkForYou person ID, and
whatever else turns up (Wikidata, Democracy Club). TheyWorkForYou's
[people data](https://www.theyworkforyou.com/api/) already links its
MPs, Lords, MSPs and MLAs to their Wikipedia articles and official IDs,
so it can fill those columns in one pass.

| Body                | Source                                                                                              | ID                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Commons and Lords   | [Members API](https://members-api.parliament.uk/)                                                   | `id`, the same in both Houses (Baroness May is 8 in both)        |
| Scottish Parliament | [data.parliament.scot](https://data.parliament.scot/api/members)                                    | `PersonID`                                                       |
| NI Assembly         | [data.niassembly.gov.uk](https://data.niassembly.gov.uk/members.asmx)                               | `PersonId`                                                       |
| Senedd              | [`GetCouncillorsByWard`](https://business.senedd.wales/mgwebservice.asmx/GetCouncillorsByWard), XML | `councillorid`, the same across terms (Huw Irranca-Davies, 5053) |

All four give each member's name, party, constituency and email.

- The Members API is already read for sitting MPs and their emails
  (`lib/parliament.ts`), for the nightly check against Airtable
  (`lib/server/mp-check.ts`). It also gives the reason a membership
  ended. Its `nameAddressAs` field is mostly empty, so it can't give
  salutations.
- Joseph made the salutations in Airtable with an LLM: for each
  politician it searched for information about the person and chose the
  salutation from what it found. The site can do the same for a new
  politician, but from a fixed source rather than a web search: their
  Wikipedia article, found by the key above, has the title, honorifics
  and peerage the salutation depends on. Staff check and correct it.
- The Scottish Parliament gives emails and parties from separate
  endpoints, keyed by `PersonID`.
- The NI Assembly gives emails from `GetAllMemberContactDetails_JSON`,
  in a field spelt `EmaiAddress`. Its `MemberPrefix` and
  `MemberLastName` fields make a salutation, such as "Dr Aiken".
- The Senedd lists members under their constituency (`wardtitle`), with
  their terms of office. It worked in a browser, but refused our
  requests with a 403.

- Politicians' own domains, which show whose office a thread with an email
  address on one is from (`plans/mp-correspondence.md`), come with each
  body's sync. A domain counts only if it belongs to one politician, and
  social media and party sites are skipped. The Scottish Parliament's
  `websites` and `emailaddresses` endpoints have them: up to 53 of its 129
  current members list a site that isn't parliament.scot's, a count that
  includes party sites, social media and malformed links. The Senedd's
  `additionalcontactinfo` has few, mostly social media. The NI Assembly's contact details have only its own domains.

## Steps

1. Add each body's ID to `politicians`, unique within the body, and a
   column per standard key (Wikipedia title, TheyWorkForYou person ID).
   Match the politicians we have to the official lists once, by name,
   body and constituency, and list any that don't match so staff can
   match them by hand. Fill the standard keys from TheyWorkForYou's
   data, which links each person to their official ID.
2. Replace the Airtable copy in `sync-politicians` with a nightly update
   from the official sources, folding in the checks in `mp-check.ts`. It
   adds new members, marks those who have left with the reason, and
   updates names, parties, constituencies and emails. Every address a
   body lists goes in `politician_addresses`, leaving out shared ones, and
   an address it stops listing stays there, as a past one. A large change is
   held for someone to check, as now: it shows on the staff home page
   and can be applied on the Import page. The site also emails
   `POLICY_INBOX` about it, as it does for a bounce.
3. Let staff edit a politician's salutation and markers (important
   target, personal connection), and add people who aren't in any
   official list (house `other`). A change of their office status needs
   the date it happened and a note. A new politician's salutation is
   drafted by an LLM from their Wikipedia article, as Joseph's were in
   Airtable, and marked as a draft until staff have checked it; without
   an article, it's made from the name.
4. The asks page shows how many politicians received a letter about
   each ask, from a mailing or a campaign.
5. Read ControlAI's statement every night from
   [controlai.org/statement](https://controlai.org/statement), with the
   statuses owned by `controlai`, as `import-controlai` already does for
   ControlAI's letter to the PM (`lib/server/controlai-import.ts`). Each
   supporter on the page links to their official profile, so most can
   be matched by ID: on 28 October, 141 linked to
   `members.parliament.uk/member/{id}` and 26 to
   `aims.niassembly.gov.uk` with a `per=` ID. The 14 Scottish and 5
   Senedd links contain a name, so those are matched by name. If the
   page has too few names, nothing is changed, as with the letter.
6. Switch off Airtable: remove the syncs, the one-off imports, their
   rows on the Import page and the base's token. Politicians keep their
   `airtable_id`. Each politician's Airtable notes, with a line saying
   Recommended if it was ticked, become one note in their history,
   written by "Airtable" and dated the day it's switched off; then
   `notable_people.notes` and the Notes from Airtable card go.

## More addresses for each politician

Staff expect a one-off email from a politician's office to show under that
politician, but a thread only links when an address on it exactly matches one
we hold. On 7 November 2026, 121 of the 277 one-off threads had no politician.

For example, Dame Meg Hillier's record and Parliament's list both say
`meg.hillier.mp@parliament.uk`, but her mail uses `meghilliermp@parliament.uk`.
All 11 of her unlinked threads have that address. A thread on a parliament
domain is kept without naming anyone, so they're kept but not filed under her.

This comes first, in its own pull request, as it doesn't depend on the official
sources or on Airtable. The official sources' sync then adds to the same table.

### What it would link

| Added in this order                      | Threads linked, of the 121 |
| ---------------------------------------- | -------------------------- |
| Quoted addresses we already hold         | 21                         |
| The address pattern                      | 50                         |
| The staff action, on 4 staff addresses   | About 78                   |
| The official lists, with the sync        | About 82                   |

These are counts of threads that have the evidence. They were judged by address
and subject, not by reading the mail. One link looks doubtful, and two threads
would link two politicians, which looks right.

The 39 left:

- 14 are "For Lord X" threads to `contactholmember@parliament.uk`, for Lords we
  don't have (see "Lords with a shared address").
- 18 are from staff of a member nothing in the data identifies, including one
  sent to an old MSP address. Staff can link these by hand.
- 7 have no single politician: bounces, committees, and security and room
  bookings.

### The first pull request

1. **`politician_addresses`:** each row is an address, a politician and where it
   came from: past, official list, pattern or staff. Two politicians can share
   an address, as two sharing a member of staff do. `politicianBook` reads it in
   place of the audit log's edits, alongside `notable_people.email`. Letters
   still go only to `notable_people.email`, so nothing here changes who gets one.
2. **Quoted addresses always count:** `keepIfPoliticianThread` only looks at
   quotes when the headers don't count, and `keepThreadMate` not at all, so a
   reply on a parliament domain quoting a letter to a known address isn't linked.
   For example, a reply from Andrew Rosindell's `romford.mp@parliament.uk` quoting
   his `andrew.rosindell.mp@parliament.uk`.
3. **The address pattern:** an address on a parliament's domain links, and is
   recorded, if its local part has a member's marker and names exactly one
   politician in office in that house:

   | Form             | Example                                |
   | ---------------- | -------------------------------------- |
   | `<name>mp`       | `meghilliermp@parliament.uk`           |
   | `<name>.mp`      | `ian.murray.mp@parliament.uk`          |
   | `<name>.msp`     | `kate.forbes.msp@parliament.scot`      |
   | `<seat>.mp`      | `romford.mp@parliament.uk`             |
   | `<name>.<seat>`  | `mel.stride.centraldevon@parliament.uk` |
   | `<name>.casework` | `carla.denyer.casework@parliament.uk` |
   | `<name>.private` | no public example                      |
   | `officeof<name>` | `officeofapsanabegum@parliament.uk`    |

   A plain `first.last@` doesn't count, as that's how staff addresses look, so
   someone who shares a politician's name isn't taken for them. Against 1,539
   addresses we know the owner of, the pattern named the right person for 749,
   the wrong person for none, and made no guess for 790.
4. **The staff action:** on a thread, staff say an address is a politician's or
   their office's. That records it and links every thread with it. Staff can
   also remove an address or a thread's link, for a wrong one. This covers
   caseworkers: 28 threads rest on 4 staff addresses, for Iqbal Mohamed (20) and
   Lord Tarassenko (8). The politician's page lists their addresses. It needs a
   storyboard flow.
5. **Linking old threads:** `read-gmail` only sees new mail, so adding an address
   links existing threads too. Header addresses are already in
   `one_off_messages.addresses`, so that's one query. Quoted addresses aren't
   stored, so they get a column, set as a message is kept and filled once from
   the kept mail in Blobs, with no Gmail reads. Three more things go with it:
   - **The pattern over old threads:** it also runs once over every address
     already stored, headers and quotes. Otherwise Hillier's 11 threads stay
     unlinked, as no new address arrives for them.
   - **`someone_else`:** this hides a thread from staff without `supporters`, and
     is set as a message is kept. It's worked out again from the thread's senders
     whenever an address is added or removed, so a thread only shows once none of
     its senders is someone else, and hides again if one becomes so. Today it
     changes none of the 98 flagged threads: the pattern and staff addresses are
     on parliaments' domains, which already count, and the lists add no sender. It
     matters for an address staff add on another domain, such as an assistant's
     Gmail.
   - **A removed link stays removed:** it's recorded, so relinking, or a new
     message in the thread, doesn't add it back.
6. **Data protection:** staff addresses are personal data, so the docs need a
   line on them.

To check while building: whether replies to letters match through the book. The
one-off pages and the old letters import do, so they widen with it.

### Rules we measured and left out

- **Linking staff addresses automatically:** tested by hiding each thread and
  using an address's other linked threads, this gave 13 right, 1 wrong and 2
  ambiguous. One address rests on a single thread, and staff change jobs. So a
  person says whose they are.
- **Greetings:** "Dear Keir" to a member of staff called Keir matched Sir Keir
  Starmer, and on threads already linked, 6 of 12 greetings named someone else.
- **Display names:** "Meg Hillier MP" beside an address links nothing that the
  rules above don't, and a member of staff can share a politician's name.

### What the official lists add

Comparing the lists with our records, joined by name, there are 126 addresses we
don't hold, 78 of them on parliaments' domains. They include Ian Murray's
`ian.murray.mp@parliament.uk` (our record has a ministerial address), Baroness
Hale of Richmond's `haleb@parliament.uk` (ours is at the Supreme Court), Kate
Forbes's `kate.forbes.msp@parliament.scot`, Lord Tarassenko's
`tarassenkol@parliament.uk` and Sean Woodcock's
`sean.woodcock.casework@parliament.uk`, which Parliament lists as his
constituency office.

Only 4 threads need the lists and nothing else: Hale's 2, Forbes's and
Tarassenko's. Parliament doesn't list `meghilliermp@`.

### Shared addresses

The lists aren't all one person's addresses. 478 of the 815 sitting Lords list
`contactholmember@parliament.uk`, and other Lords share a few among them. An
address several politicians list stays out of the book: with it, one thread
would link to all 478.

The sync can't then put that address in `notable_people.email` without deciding
what those Lords' letters use, as letters would go to the shared inbox.

### Lords with a shared address

We hold 380 Lords, none with this address. Linking the 14 threads needs those
Lords on our list and a rule reading the name from the subject, as "For Baroness
Verma: Request to co-sign…" does. All 14 have that form, but with those Lords not
on our list, the rule hasn't been tested.

### Threads already linked

The 156 linked threads, with 164 links, were checked on 7 November 2026 for signs
of a wrong politician. Nothing needs fixing in bulk, so wrong ones are left to the
staff action.

| How the politician is on the thread | Links |
| ----------------------------------- | ----- |
| They wrote                          | 69    |
| We wrote to them                    | 77    |
| Cc only                             | 4     |
| Only in quoted mail                 | 14    |

- The official lists give none of the addresses on these threads to someone else,
  and the quoted, list and pattern rules name no one else on them.
- 6 links rest on a politician's own domain alone, all from their own office,
  such as `casework@tulipsiddiq.com`.
- The only threads with several politicians are 4 linked to the 3 test
  politicians, through `test@pauseai.uk`.
- 2 links look odd without naming the wrong person: Gmail's "Send Mail as"
  confirmation for `test@pauseai.uk` is linked to the test politicians, and a
  moderator's spam report quoting David Lammy's office is linked to him.

This used addresses and subjects, not the mail. It can't catch an address on no
list that belongs to someone else, and the 14 quoted links weren't opened.

### Afterwards: letters with no sent email

Some one-off threads are really a letter's sent email, kept as a one-off because
its address wasn't known. Hillier's letters of 12 June, 8 July and 25 July 2025
have no sent email, and threads to `meghilliermp@` start on those days. Across
all politicians, 15 letters with no sent email fall within a day of a thread
this would link.

The wider book helps the import's matching, but moving those threads onto their
letters is a separate pull request, as the import is now a one-off run by a
button.

## Open questions

1. If the Senedd refuses requests from Netlify as well, we could ask
   the Senedd to allow us, use another source such as TheyWorkForYou,
   or let staff keep its 96 members up to date by hand. On 7 November it
   answered a request from a development container, with a plain custom
   User-Agent, so the refusal may be down to how we asked. That's not yet
   tried from Netlify.
2. Which standard keys to store beyond Wikipedia and TheyWorkForYou,
   and whether to make the salutation from Wikipedia alone or let the
   LLM search as Joseph's did.
3. Does the sync add all 815 Lords, or only those with their own address?
   That decides whether the 14 "For Lord X" threads can link.
4. Should the address pattern link automatically, or only suggest a link for
   staff to confirm? It's written above as automatic, as it named no one wrongly
   when tested.
