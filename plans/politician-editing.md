# Politicians without Airtable

Politicians' details are updated every night from the official sources,
staff edit everything else on the site, and the syncs from Airtable's
"UK Politicians" base are switched off. This is one pull request.

Most of it can be built now. Switching Airtable off waits until Joseph
sends mailings from the site rather than Airtable.

## What replaces each Airtable field

The nightly `sync-politicians` job copies the politicians from base
`appBInVvIm6opJ1Ob` (`lib/server/politician-sync.ts`).

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

## Official sources

Each politician stores the ID their legislature gives them, so someone
who leaves and comes back, or moves from one house to another, stays
one record. Alongside the ID, there's a column for each standard key
that other sources use: a Wikipedia article title, a TheyWorkForYou
person ID, and whatever else turns up (Wikidata, Democracy Club). With
those, a politician can be matched to the other sources without a name
lookup. TheyWorkForYou's
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

## Steps

1. Add each body's ID to `politicians`, unique within the body, and a
   column per standard key (Wikipedia title, TheyWorkForYou person ID).
   Match the politicians we have to the official lists once, by name,
   body and constituency, and list any that don't match so staff can
   match them by hand. Fill the standard keys from TheyWorkForYou's
   data, which links each person to their official ID.
2. Replace the Airtable copy in `sync-politicians` with a nightly update
   from the official sources, folding in the checks in `mp-check.ts`.
   - It adds new members, marks those who have left with the reason, and
     updates names, parties, constituencies and emails.
   - Every address a body lists goes in `politician_addresses`, except
     shared ones. An address the body stops listing stays there, as a
     past one.
   - A large change is held for someone to check, as now: it shows on
     the staff home page, the notification inbox is emailed about it,
     and it can be applied on the Import page.
3. Let staff edit a politician's salutation and markers (important
   target, personal connection), and add people who aren't in any
   official list (house `other`).
   - A change of a politician's office status needs the date it
     happened and a note.
   - A new politician's salutation is drafted by an LLM from their
     Wikipedia article, as Joseph's were in Airtable, and marked as a
     draft until staff have checked it. Without an article, the
     salutation is made from the name.
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
6. Switch off Airtable:
   - Remove the syncs, their rows on the Import page, and
     `AIRTABLE_TOKEN`, as nothing else reads Airtable.
   - Politicians keep their `airtable_id`.
   - Each politician's Airtable notes become one note in their history,
     with a line saying Recommended if it was ticked. The note is
     written by "Airtable" and dated the day Airtable is switched off.
     Then `notable_people.notes` and the Notes from Airtable card go.

## Lords' addresses

One-off emails link to politicians by more than their email: Parliament's lists, the forms their name makes, their offices', and addresses staff add (`docs/domain-concepts.md`, "One-off emails"). The sync adds to Parliament's lists in `politician_addresses`.

### Shared addresses

The lists aren't all one person's addresses. 478 of the 815 sitting Lords list
`contactholmember@parliament.uk`, and other Lords share a few among them. An
address several politicians list stays out of the book: with it, one thread
would link to all 478.

The sync can't then put that address in `notable_people.email` without deciding
what those Lords' letters use, as letters would go to the shared inbox.

### Lords with a shared address

We hold 380 Lords, none with this address. Linking the 14 threads needs those
Lords on our list and a rule reading the name from a subject such as "For
Baroness Verma: Request to co-sign…". All 14 have that form, but with those Lords not
on our list, the rule hasn't been tested.

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
