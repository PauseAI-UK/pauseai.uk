# Email to supporters

The UK weekly, and smaller broadcasts such as one to a local group, sent
from pauseai.uk instead of CiviCRM, so each email can be personal, with
events near the reader and their MP. It uses the Broadcasts pages at
`/staff/broadcasts`. Sending by Gmail or Postmark is built; what's left is
the first real send, a few loose ends, and phases 5 and 6, a pull request
each.

## Outstanding outside the code

- The first real send by Postmark's broadcast stream, checked in
  production. Once it's gone well, UK staff stop sending from CiviCRM,
  and all UK bulk email goes from pauseai.uk.

## Loose ends

- The contact preferences page says Luma's invites are separate (open
  question 1).
- When someone ticks the Luma checkbox (once it's built:
  `plans/supporters-whatsapp.md`, "Asking on Luma") but has "No bulk
  emails" set, the Luma import emails them a link to the preferences page
  to lift it when it reads the tick, as the site's forms and the paper
  import do.

## Phases

### 5. Personal broadcasts

More filters and lozenges in Broadcasts, so an email can carry such
things as events near the reader, the main events with how many have
signed up, and their MP. Deliberately not specified yet.

### 6. The weekly, scheduled each week

The weekly is scheduled automatically each week.

## Getting more people to say yes

- Our own join form on pauseai.uk, with a "PauseAI UK can email me"
  box, still passing new members to Global. pauseai.uk brought in 351
  of the 427 UK signups in October. Record it in
  `docs/data-protection.md` as a new source.
- The Luma checkbox (`plans/supporters-whatsapp.md`) covers the weekly.
  Registering for an event isn't a yes on its own: the charities' soft
  opt-in (PECR regulation 22(3A)) is for registered charities, and Safe
  AI Alliance Ltd isn't one.
- A postcode question on every Luma event, for events near the reader
  and their MP.

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
  `civicrm_contacts` rows. The import marks the contact gone, and their
  records stop counting at once.

- Discuss erasure with Global. When Global erases someone, CiviCRM
  keeps their address as a suppression record, so `checkSuppression`
  still blocks it, and CiviCRM stops returning them, so our import
  marks the contact gone. What we hold from our own sources, such as
  letters, Luma and our forms, stays until they ask us to delete it.
  Should either side tell the other of an erasure request?

## Open questions

1. Does removing someone from the Luma calendar stop organisers'
   invites to them? Luma says a removed contact is opted out of the
   calendar's invites and newsletters, but organisers send invites to
   most events, often to past guests, and how they pick them isn't
   known: a pasted list may not be checked. Until we know,
   the preferences page says Luma's invites are separate.
