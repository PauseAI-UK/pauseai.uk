# WhatsApp texts: what's left after a place, reply buttons and a second version

A text can have a map of a place at its top, reply buttons whose taps come
back as replies, and a second version for those who meet a condition, each
version a template of its own. What's left is below: two later stages, and
what a real send still has to show. Pictures and link buttons are in
`plans/whatsapp-cards-and-folding.md`, whose picture goes in the top's
choice beside the link preview and the place.

Two things were built more simply than first planned, and could be done
more fully later:

- **The place's map.** The writer shows a drawing of a map with the
  place's name and address, and a link to check its pin on
  OpenStreetMap, not a map of the place itself. A real map needs a map
  library and tiles from a server the site's Content Security Policy lets
  in, such as OpenFreeMap's.
- **The second version's words.** It starts as a copy of the first's
  words, top and buttons, and stays new words, sent for approval. It
  can't be one of the approved templates from the dropdown.

## Later

Two stages, each its own work, in either order.

### A tap that does something

A reply button could make the site act when it's tapped, chosen with the
button's words: sign the supporter up to a Luma event, or stop one list.
A sign-up would add them with Luma's
[Add Guests](https://docs.luma.com/reference/post_v1-events-guests-add)
call and answer in WhatsApp that they're signed up. Two things to settle
first:

- **No email.** Luma's call needs the supporter's email address, which we
  don't have for everyone we text. They could get the event's page to sign
  up themselves, be asked for their email in WhatsApp, or not see the
  button (a version only for those we have an email for).
- **Sign-up questions.** The call skips an event's sign-up questions
  unless the site answers them, so the organisers could miss answers they
  rely on. The button could be offered only for events without required
  questions.

Sending Luma a supporter's email and name when they tap is a new use of
their data, so this stage says what it does to
`docs/data-protection.md` and the privacy policy before it's built.

### Each supporter's nearest event

One text, sent each month to everyone, could bring each supporter their
own nearest coming event: its name and day in the words, through fields
as a first name is now, and a link button to its Luma page.

The button works because a link button's address can end with a slot,
filled for each person when their copy is sent
([Template components, "URL buttons"](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components#url-buttons)):
`https://luma.com/{{1}}` is approved once, with an example, and each
copy fills it with that person's event. Only the end of the address can
change, and there's one slot. Whether Meta approves an address that's a
site and the slot alone isn't in its docs; a test template answers it.

It needs:

- where each supporter is, as the supporters list's "near" filter knows
  it for many;
- which events count as theirs, such as in person, within some distance,
  in the next few weeks;
- what someone with no event near them gets: a national or online event
  in its place, as a field has a fallback, or to be left out of the
  broadcast.

## Still to find out

- Whether Meta takes a text whose picture differs from the template's
  approved example, with no mark against the account's quality. A test
  send with a different picture answers it, before staff can change one.
- What WhatsApp Web does when the map is clicked, and whether the name we
  send shows in the map app on an iPhone and on Android. A test send to
  both phones and WhatsApp Web answers both.
- Whether WhatsApp's `button` message always carries the context ID of
  the text it answers. Meta's webhook page shows it in its example; a
  test tap confirms it.
- How WhatsApp folds a text's words under a map. The cards plan's fold
  rules cover a picture; a place may be the same, and a real send settles
  it.
