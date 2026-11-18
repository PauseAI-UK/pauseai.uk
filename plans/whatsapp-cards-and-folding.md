# WhatsApp texts: a picture and buttons

A text with a link gets only a small card with no picture, even when the
page has an `og:image`. To show a picture, a template needs a media
header. This plan lets staff add a picture they upload, and buttons, to a
text, each by choice, none by default.

From Meta's own docs (add `.md` to a page's address to fetch it), and
texts seen on a phone. Where neither says, the plan says so.

## What staff can add

- **A picture**: any picture staff upload, as an `IMAGE` header. It
  needn't be from the page the text links to.
- **Buttons**: up to two URL buttons, each with a link and words staff
  write (25 characters at most).

The words and the "Reply STOP" footer stay as now.

## The fold moves

What's added changes where Read more falls
([Send marketing messages, "Text truncation"](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/send-marketing-messages#text-truncation)):

- no button, and a link in the words: 5 lines, picture or not (this
  overrides the rest);
- else a picture: 3 lines;
- else: 4 lines.

So a picture costs two lines of words only with a button, or with no
link. Meta's page is the Marketing Messages API's; the 5 matched a phone,
but a picture with a link is untested: check with a real send. The
writer's preview already folds (`TextFold`); it takes the number of lines
from what's added.

Whether the small card still shows for a link in the words once there's a
picture isn't in Meta's docs. A photo with a caption gets no card, so
probably not; check with the same send.

## The picture

Staff upload it in the writer, as an email broadcast's attachments are
uploaded and kept, and it shows in the preview at once. Meta takes JPEG or
PNG, 5 MB at most
([Media](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media));
anything else is turned away with a message saying so. Uploading rather
than taking a linked page's image means no fetching other sites, and the
picture approved is the one sent, even if the page changes.

**Sending for approval.** A media header's example is uploaded with Meta's
Resumable Upload API, which gives a handle (`4::…`) for
`example.header_handle`
([Template media](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-media)).
The upload goes through the Meta app, so it needs a new setting,
`WHATSAPP_APP_ID`, beside `WHATSAPP_APP_SECRET`. Meta's
[upload guide](https://developers.facebook.com/docs/graph-api/guides/upload)
isn't in its Markdown index and fetches empty: read it in a browser first.

**Sending.** Each message gives the image by `link`, an address on our
site serving the uploaded copy (Template media, "Send media-based message
template"). Not a media ID: those last 30 days, and a text can be
scheduled further ahead.

**Not using:** tap-target titles, which put the page's title on the
picture, need a fully verified account with high quality
([Tap target title URL override](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/tap-target-url-title-override)).
Worth trying once ours is.

## The changes

1. **Schema**: a migration adding to `whatsapp_templates` the uploaded
   picture, and each button's link and words, as they're approved with
   the template. No personal data.
2. **Meta calls** (`whatsapp.server.ts`): `createTemplate` takes an
   optional header handle and buttons; an upload for the handle;
   `sendTemplate` takes the image's link. The fixture
   (`lib/server/fixtures/whatsapp.ts`) answers the upload and checks the
   new parts.
3. **Writer** (`BroadcastWriter`): Add a picture, uploaded; Add a
   button, twice at most; both in the preview, folded at 3, 4 or 5 lines.
4. **Copy**: the controls' labels, and the message for a file Meta won't
   take, as placeholders.
5. **Storyboard**: a flow adding a picture and a button, and the text as
   it arrives.
6. **Docs**: `docs/development.md`, "WhatsApp", for `WHATSAPP_APP_ID`.

## Not in this plan

Meta stops taking marketing messages through the Cloud API on 13 October
2027; after that they go through the Marketing Messages API, with
onboarding first
([overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/overview)).
That move is its own work. It brings "automatic creative optimizations",
on by default, which change a message's look unless opted out per
template
([Send marketing messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/send-marketing-messages#automatic-creative-optimizations)).
