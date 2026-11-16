# WhatsApp community import

Staff upload a CSV of the profile names and numbers in our WhatsApp
community, or in one of its local groups, on the sign-up import page. Each
person becomes a supporter, linked to anyone we already know by the number.

## What was decided

- **Consent.** Joining goes through a waiting room where a person talks to an
  admin and agrees to be messaged, so it's like a paper sign-up: a yes to the
  newsletter by text, for the number. Nothing by email or call. Any opt-out in
  force of the newsletter by text wins, whatever its date; the yes never
  reopens one.
- **Place.** An upload has an optional town ("Oxford"); none for the whole
  community. It ranks last among a supporter's places: below a postcode, a
  city they gave and an event.
- **Identity.** A number nobody has makes a supporter, known by the number
  alone: the first supporters without an email. A number someone has links to
  them. A foreign number matches like a UK mobile when either side of the
  match is from WhatsApp.
- **Names** are WhatsApp profile names: never the supporter's name when
  another source gives one. A row with no name goes in with its number alone.
  Greetings use `firstNameOf()` as they are.
- **Additions only.** An upload never marks anyone as having left a group. A
  number already uploaded under the same group name isn't entered again.
- **Where.** The sign-up import page, sharing its code, with a choice at the
  top, an icon each: paper sign-ups or WhatsApp community. Staff give the
  CSV (name and phone columns), the group's name and the town.
- **Finding people.** A source label and history lines; no group filter.
- **Erasure.** Each number of an erased supporter is kept hashed, and a later
  upload holds it back.

## How

- Each person is a form entry, form `whatsapp-community`, with no email
  (`form_entries.email` nullable for that form only), the profile name or
  `''`, the number, and the upload's town in `city`. The upload is a row of
  `signup_uploads` with `kind`, its group name in `note`.
- `linkSupporters()`: a second set of candidates, WhatsApp entries, matched
  by number (`matched_by` `phone`).
- `merge_supporters_by_phone()`: a pair also matches on any number when
  either side gave it in a WhatsApp entry.
- `contact_permission()` and `phone_permissions`: the yes, reason
  `joined-whatsapp`, unless a newsletter-by-text opt-out is in force.
- `supporters_summary`: a WhatsApp name last; NULL emails left out, here and
  in `supporters_list`.
- `supporter_place`: rank 4 for a WhatsApp entry's town; rank 2 leaves it
  out. `givenPlaces()` too.
- `whatsapp_erased` (number hash), filled by erasure, read by the preview.

## Data protection

- `docs/data-protection.md`: a row for WhatsApp community members (profile
  name, number, groups, town), consent, kept until erased; `whatsapp_erased`.
- Privacy policy, approved words: "If you join our WhatsApp community, we keep
  your profile name and number, and which groups you joined."
- Erasure: their WhatsApp entries go with their form entries; their numbers'
  hashes are kept.

## Docs

`docs/domain-concepts.md`: Form entries (the new form), Supporters (matching
by number), Where they are, Whether we'd contact someone; and fix "Paper
sign-ups", which says calls as well as texts.
