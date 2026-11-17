# WhatsApp texts: a card, and where "Read more" falls

A broadcast's text arrives folded behind "Read more" after a few lines,
with at most a small card for its link. This plan shows staff the text as
it will arrive, fold and card, while they write (phase 1), then gives a
text a picture from the page it links to, with a button to the page
(phase 2).

What's here is from Meta's own docs (fetched as Markdown by adding `.md`
to a page's address), and from texts seen on a phone. Where neither
says, the plan says so.

## What WhatsApp does

A broadcast goes as a marketing template (`sendTemplate` in
`lib/server/outside-services/whatsapp.server.ts`), and the template is a
body and a footer only (`createTemplate`).

**The fold.** Meta folds a marketing message's words to a fixed number
of lines, the rest behind "Read more"
([Send marketing messages, "Text truncation"](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/send-marketing-messages#text-truncation)):

- no button, but a link in the words: 5 lines (this overrides the rest);
- a media header: 3 lines;
- no header: 4 lines.

The page is the Marketing Messages API's, but our texts, sent by the
Cloud API, fold too. On a phone (Android), a text with a link folds at 5
lines as it wraps on the screen, a blank line between paragraphs counting
as one; the fifth ends "…", then "Read more" in green, then the footer.
It can't be turned off, and how many words make a line depends on the
phone. So the first lines have to carry the message, and staff need to
see where they end.

**The small card.** A text with a link in its words gets a small card at
its top, above the words, outside the five lines: the page's title in
bold (at most two lines), a line of its description, and its site, on
grey, with no picture. Meta's docs describe cards only for plain texts
sent with `preview_url: true`
([Text messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/text-messages)),
not for templates; this is what a phone showed. The card is made from the
page's Open Graph tags
([Link Previews](https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews)).
A page with no `og:description` got no card, as Meta's rules say: title,
description and URL must not be empty.

Whether a page with an `og:image` gets a picture in a template's card is
unknown: the page seen, a Google Doc, showed none. Test with one of our
pages.

## Phase 1: the preview as it arrives (built)

The writer's phone preview (`TextBubble`), and the broadcast's page,
show a text as the phone did:

- the words folded at 5 lines, a blank line between paragraphs as a line,
  the last ending "…", with Read more under them, which opens the rest
  (`TextFold`);
- in the writer, the small card for the words' first `http(s)://` link,
  from the page's tags, read on the server as WhatsApp reads them
  (`lib/server/outside-services/link-pages.server.ts`).

The 5 is the rule for a text with a link and no button, which is every
text we send now. A line's width is the preview's, a 393 px phone's, so
where the fold falls is close, not exact.

Left for later: the card on the broadcast's page and in the storyboard's
picture of a text arriving (`tests/fixtures/text-view.ts`).

## Phase 2: a picture and a button

Staff give a broadcast's text a link to a page, optionally. The text
then goes with:

- **a picture**: the page's `og:image`, as an `IMAGE` header;
- **a button**: a URL button to the page, labelled with a word staff
  choose (25 characters at most);
- the words as now, with the "Reply STOP" footer.

With a header and a button, the words fold at 3 lines, not 5: that's the
trade for the picture, and the preview's fold follows it.

The page's `og:image` is read when staff add the link, and shown in the
writer's phone preview at once. Our own pages' tags already meet
WhatsApp's rules (an absolute image URL, under 600 KB, at least 300 px
wide); a page whose tags don't gets no picture, and the writer says why.

**Sending for approval.** A media header's example must be uploaded
with Meta's Resumable Upload API, which gives a handle (`4::…`) for
`example.header_handle`
([Template media](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-media)).
The upload goes through the Meta app, so it needs the app's ID, a new
setting (`WHATSAPP_APP_ID`) beside `WHATSAPP_APP_SECRET`. Meta's page on
that API ([upload guide](https://developers.facebook.com/docs/graph-api/guides/upload))
isn't in its Markdown index and fetches empty, so read it in a browser
before building this.

**Sending.** Each message gives the header's image by `link`, the
page's `og:image` address
([Template media, "Send media-based message template"](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-media)).
Meta recommends uploading media once and sending its ID instead; an ID
lasts 30 days
([Media](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media)).
Start with `link`; move to an ID if sends fail on fetching it.

Images: JPEG, PNG or static WebP, 5 MB at most, no edge over 4,096 px.

**Not using:** tap-target titles (`tap_target_configuration`), which
would show the page's title on the picture, need the account "fully
verified" with high quality kept up
([Tap target title URL override](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/tap-target-url-title-override)).
Worth trying once ours is.

### The changes

1. **Schema**: a migration adding the link, the button's label and the
   image's address to `whatsapp_templates`, as a template's look is
   approved with it. No personal data.
2. **Meta calls** (`whatsapp.server.ts`): `createTemplate` takes an
   optional header handle and button; an upload for the handle;
   `sendTemplate` takes the image's link. The fixture
   (`lib/server/fixtures/whatsapp.ts`) answers the upload and checks the
   new parts.
3. **Reading a page's tags**: `og:image` added to phase 1's reading.
4. **Writer** (`BroadcastWriter`): a link field, the button's label, the
   picture in the preview, the fold at 3 lines.
5. **Copy**: the field labels, the button label's default, the message
   when a page has no usable image, as placeholders to be approved.
6. **Storyboard**: a flow writing a text with a link and a picture, and
   the text as it arrives.
7. **Docs**: `docs/development.md`, "WhatsApp", for `WHATSAPP_APP_ID`.

### Questions

- Should every text with a link get the picture, or only when staff ask?
- The button's label: one fixed word, or staff's choice each time?

## Not in this plan

Meta stops taking marketing messages through the Cloud API on 13 October
2027; after that they go through the Marketing Messages API's
`/marketing_messages` endpoint, with onboarding first
([Marketing Messages API overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/overview)).
That move is its own piece of work. It also brings Meta's "automatic
creative optimizations", on by default, which change a message's look
(headlines drawn from the words, filters on the picture) unless opted
out per template
([Send marketing messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/send-marketing-messages#automatic-creative-optimizations)).
