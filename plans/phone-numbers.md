# Phone numbers, checked by the database

Every phone number is kept in international format, or not at all
(`docs/domain-concepts.md`, "Phone numbers"): `phoneNumber()` in
`lib/phone.ts` tidies each as it comes in. But nothing stops code written
later from storing a number as typed, and every query still tidies every
number it reads through `phone_number()` in SQL. This makes the database
refuse any other number, in every column that holds one now or later, and
drops `phone_number()`.

## A domain for numbers

One definition, in a migration:

```sql
CREATE DOMAIN phone AS text CHECK (VALUE ~ '^\+[1-9][0-9]{6,14}$');
```

Every column that holds only numbers becomes `phone`: `form_entries.phone`,
`luma_guests.phone`, `civicrm_contacts.phone`, `civicrm_updates.phone` and
`whatsapp_unreachable.number`. A new column gets the check by being
declared `phone`, and the rule is written once in SQL, matching
`isInternational()`. A domain allows NULL, as these columns do. Changing a
column's type rewrites its table, which at our sizes (hundreds of rows) is
a moment's lock.

Columns that hold an email or a number by what the row is for can't be a
domain. Each gets a CHECK by its row's kind instead:

- `opt_outs.address`, a number where `way` isn't `email`;
- `broadcast_messages.address`, a number for a text's copy (its mailing's
  `channel`, so a trigger or the copy's own column of what it is);
- `supporter_links.matched_value`, a number where `matched_by = 'phone'`.

There may be more: the migration starts by listing every column whose
values match a number, on a copy of production's schema.

## A check that every number column uses it

A test in `tests/checks/` reads the schema and fails on any column named as
a number (`phone`, `*_phone`, `number`, `*_number`) that isn't of the
`phone` domain, naming it. A column that holds something else under such a
name is listed in the test with why. That's what catches a new number
column whose author forgot the domain.

## A type in TypeScript

`phoneNumber()` returns a `PhoneNumber`, a branded string only it makes,
and code that writes a number takes a `PhoneNumber`: `addFormEntry`, the
uploads, the imports, opt-outs and WhatsApp's own numbers (`numberOf`, which
becomes a `phoneNumber()` call). A new way in that passes a typed `string`
fails to compile, so it's caught with a message for the person typing, not
as the database refusing the write.

## `phone_number()` dropped

Every function and view that calls it compares the column itself: about
thirty in the database (`contact_permission()`, the supporter views,
`merge_supporters_by_phone()`, `whatsapp_number_hash()`), and about twenty
queries in TypeScript. Each matched column gets an index where it's
searched on. The test that checks `phone_number()` agrees with
`phoneNumber()` goes with it. `phoneSearch` stays, as it reads part of a
number, and `phoneWords`, as it's for display.

This is one large migration: it touches consent, the supporter views,
merging and erasure at once. Before it's pushed: every storyboard flow, and
a check on a copy of production that the counts of consents and textable
supporters don't change.

## Personal data

Nothing new is collected or used. `docs/data-protection.md` and the privacy
policy don't change. Erasure's hashes (`whatsapp_erased`) are of
international numbers already, so they still match once
`whatsapp_number_hash()` hashes the number itself.
