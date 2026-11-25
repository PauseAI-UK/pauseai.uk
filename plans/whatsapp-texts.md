# WhatsApp texts: what's left

A text can have a picture or a map of a place at its top, reply and link
buttons, and a second version for those who meet a condition, each version
a template of its own. What's left is below.

## Built more simply than it could be

- **The place's map.** The writer shows a drawing of a map with the
  place's name and address, and a link to check its pin on OpenStreetMap,
  not a map of the place itself. A real map needs a map library and tiles
  from a server the site's Content Security Policy lets in, such as
  OpenFreeMap's.
- **The second version's words.** It starts as a copy of the first's
  words, top and buttons, and stays new words, sent for approval. It
  can't be one of the approved templates from the dropdown.

## Where Read more falls

What a text has changes where WhatsApp folds its words under Read more
([Send marketing messages, "Text truncation"](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/send-marketing-messages#text-truncation)):

- no button, and a link in the words: 5 lines, picture or not (this
  overrides the rest);
- else a picture: 3 lines;
- else: 4 lines.

The preview folds at 5 lines whatever the text has (`TextFold`). It could
take the number from the text's top and buttons, once a real send shows
Meta's page, written for its Marketing Messages API, holds for ours: the 5
matched a phone, but a picture with a link is untested, and so is a map.
Whether the small card still shows for a link in the words once there's a
picture isn't in Meta's docs either.

## Later stages

Each its own work, in any order.

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

## Not in this plan

- **Tap target titles**, which put the page's title on a picture, need a
  fully verified account with high quality
  ([Tap target title URL override](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/tap-target-url-title-override)).
  Worth trying once ours is.
- **The Marketing Messages API.** Meta stops taking marketing messages
  through the Cloud API on 13 October 2027; after that they go through
  the Marketing Messages API, with onboarding first
  ([overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/overview)).
  That move is its own work. It brings "automatic creative optimizations",
  on by default, which change a message's look unless opted out per
  template
  ([Send marketing messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/send-marketing-messages#automatic-creative-optimizations)).

## Still to find out

A real send to an iPhone, an Android phone and WhatsApp Web answers each:

- whether Meta takes a picture's upload for approval as the site makes
  it: Meta's upload guide (https://developers.facebook.com/docs/graph-api/guides/upload)
  fetches empty, so `uploadExample` follows its usual form, a session
  then the file, unchecked;
- whether Meta takes a text whose picture differs from the template's
  approved example, with no mark against the account's quality;
- what WhatsApp Web does when the map is clicked, and whether the name we
  send shows in the map app;
- whether WhatsApp's `button` message always carries the context ID of
  the text it answers;
- where Read more falls with a picture or a map (above).
