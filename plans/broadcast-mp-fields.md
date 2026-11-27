# Broadcasts: the reader's MP

This plan is a draft. The choices still to make are marked O, so they
can be answered by ID.

A broadcast's words can say the reader's first name today. This adds
two more fields about the reader's MP, and a condition, so the weekly
email and the lobbying day emails (in PR #496's
`plans/parliament-lobbying.md`) can ask each reader to write to their
own MP.

## What staff can put in

- **Their MP's name**, such as "Rachel Reeves". It's the MP in office
  for the constituency of the postcode that places the reader, the same
  MP their supporter page shows.
- **A link to write to their MP** on a campaign. When staff put the
  field in, they pick which campaign, as they pick a campaign for the
  "wrote to their MP" condition. Each campaign's link is its own field,
  so the menu reads "Link to write to their MP: Support the Sobel bill".
- **A condition, "has an MP"**, for a part only those with an MP get.
  It's "has an MP" rather than "has a postcode", because a postcode
  outside the UK, or in a constituency with no MP in office, finds no
  MP, and then neither field has anything to say.

## Nobody gets a made-up value

The fields we have now each have a fallback: someone with no first name
we can use gets "Hi there" rather than "Hi Jane". There's no sensible
fallback for an MP's name, or for a link to write to them, so these two
fields have none. Instead, a broadcast can only be scheduled if
everyone who'd see the field has an MP:

- the field sits inside a part for "has an MP", so the rest goes to
  everyone and the ask only to those with an MP. In an email that's a
  part like any other. In a WhatsApp text it's the text's condition
  (#491): the template has two variants, one with the ask for those
  with an MP and one without for everyone else, each approved by Meta,
  and each reader is sent theirs;
- or the broadcast goes only to people with an MP, by a new filter on
  the supporters list, "Their MP", whose choices are "Has an MP" and
  "Has no MP", and the field can go anywhere.

Otherwise scheduling stops with "It uses a field some recipients have
no value for", as a mailing to politicians does now. The editor shows
the field with how many recipients have no MP, as it does for first
names.

## The personal link

The link opens the campaign's page with the reader's name and postcode
already filled in, so they need only add their address and press the
button. The link doesn't carry their postcode or name, which could be
read by anyone the email is forwarded to: it carries the same code as
the copy's own unsubscribe and contact preferences links, which the
site already makes for each copy as it goes.

So a link looks like `https://pauseai.uk/write/<code>/support-sobel-bill`.
The site looks the code up, finds the reader's postcode and name, and
sends their browser on to `/campaigns/support-sobel-bill` with them
filled in. They're passed in the part of the address after `#`, which
browsers never send to a server, so they don't end up in logs. An old
or unknown code goes to the campaign's page with nothing filled in.

Like the contact preferences link, it works for as long as that page
does (`PAGE_DAYS`). Anyone the email is forwarded to who clicks it sees
the reader's name and postcode in the form, but no more: they don't
see the reader's email address or anything else about them.

A test copy, sent to staff, and the preview have a link of the same
shape, `https://pauseai.uk/write/A9A9A9A9A9A9A9A9A9A9A9A9/support-sobel-bill`, whose code
no copy has, so it opens the campaign's page with nothing filled in.

## WhatsApp

A text puts each field in its template as a named parameter, so the MP's
name is `{{mp_name}}` and a campaign's link
`{{mp_link_support_sobel_bill}}`, in the variant for those with an MP.

I don't know whether Meta's review accepts a link as a template's
parameter in the body of a marketing template, or how WhatsApp shows
it. Meta's page on template parameters doesn't say
(https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview).
So it needs a real send to our own number before it's used.

## What it doesn't change

There's no new table or column: the MP comes from the postcode as the
supporter page finds it, and the link's code is the copy's own. The
supporters list gains its "Their MP" filter.

## Personal data

Nothing new is kept. A broadcast's copy already keeps the values it was
filled in with, and now keeps the MP's name too. The link's code was
already kept, as a hash.
