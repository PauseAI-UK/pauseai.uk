# WhatsApp texts: a card, and where "Read more" falls

A broadcast's text arrives as a plain bubble: no picture or card for its
link, and its words folded behind "Read more" after a few lines. This
plan gives a text a card of the page it links to, a picture with the
page's title on a button, and shows staff where the fold falls while
they write.

Everything here is from Meta's own docs (fetched as Markdown by adding
`.md` to a page's address). Where they don't say, the plan says so.

## What WhatsApp does, and why

A broadcast goes as a marketing template (`sendTemplate` in
`lib/server/outside-services/whatsapp.server.ts`), and the template is a
body and a footer only (`createTemplate`).

**No card.** A card for a link, from the page's Open Graph tags, is made
for a plain text sent with `preview_url: true`, which only a reply within
a day of the person's message can be
([Text messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/text-messages),
[Link Previews](https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews)).
No template page offers a preview of a link in the body, and a test send
of a template with a link in its words showed none. What a template has
instead is a media header (a picture above the words) and up to two URL
buttons
([Template components](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components)).

**The fold.** Meta folds a marketing message's words to a fixed number
of lines, the rest behind "Read more"
([Send marketing messages, "Text truncation"](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/send-marketing-messages#text-truncation)):

- no button, but a link in the words: 5 lines (this overrides the rest);
- a media header: 3 lines;
- no header: 4 lines.

The page is the Marketing Messages API's, but our texts, sent by the
Cloud API, fold too, so take it as the rule for both. It can't be turned
off. How many characters make a line depends on the phone; Meta doesn't
say. So the fold is something to write for, not to fix: the first three
lines have to carry the message, and staff need to see where they end.

The two pull against each other: a picture folds the words at 3 lines
rather than 5. That's the trade for the card.

## The card

Staff give a broadcast's text a link to a page, optionally. The text
then goes with:

- **a picture**: the page's `og:image`, as an `IMAGE` header;
- **a button**: a URL button to the page, labelled with a word staff
  choose (25 characters at most);
- the words as now, with the "Reply STOP" footer.

The page's `og:image` is read when staff add the link, and shown in the
writer's phone preview at once, so they see the card before it goes.
Our own pages' tags already meet WhatsApp's rules (an absolute image
URL, under 600 KB, at least 300 px wide); a page whose tags don't gets
no picture, and the writer says why.

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
Start with `link`, as our pages serve their images from a CDN; move to an
ID if sends fail on fetching it.

Images: JPEG, PNG or static WebP, 5 MB at most, no edge over 4,096 px.

**Not using:** tap-target titles (`tap_target_configuration`), which
would show the page's title on the picture, need the account "fully
verified" with high quality kept up
([Tap target title URL override](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/tap-target-url-title-override)).
Worth trying once ours is; not part of this.

## Where the fold falls

The writer's phone preview (`TextBubble`) folds the words as WhatsApp
will: 3 lines with a picture, 4 without, 5 with a link in the words and
no button, then "Read more". A line's width is a guess, as Meta doesn't
give one: set it from test sends to a phone, and say in its comment that
it's measured, not Meta's.

The broadcast's page, the gallery and the storyboard's picture of a text
arriving (`tests/storyboard/whatsapp-steps.ts`) show the same fold.

## The changes

1. **Schema**: a migration adding the link, the button's label and the
   image's address to `whatsapp_templates`, as a template's look is
   approved with it. No personal data.
2. **Meta calls** (`whatsapp.server.ts`): `createTemplate` takes an
   optional header handle and button; an upload for the handle;
   `sendTemplate` takes the image's link. The fixture
   (`lib/server/fixtures/whatsapp.ts`) answers the upload and checks the
   new parts.
3. **Reading a page's tags**: a server function giving a page's
   `og:image` and `og:title`, through `outsideFetch`.
4. **Writer** (`BroadcastWriter`): a link field, the button's label, the
   picture in the preview; the fold in `TextBubble`.
5. **Copy**: the field labels, the button label's default, the message
   when a page has no usable image, as placeholders to be approved.
6. **Storyboard**: a flow writing a text with a link, its card and fold
   in the preview, and the text as it arrives.
7. **Docs**: `docs/development.md`, "WhatsApp", for `WHATSAPP_APP_ID`.

## Questions

- Should every text with a link get the card, or only when staff ask?
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
