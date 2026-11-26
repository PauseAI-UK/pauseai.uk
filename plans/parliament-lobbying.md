# Parliament lobbying days

This plan is a draft. Its open questions are marked Q, and the choices
still to make are marked O, so they can be answered by ID. It carries
on the numbering of `plans/pausecon-2027.md`.

## What a lobbying day is

On a lobbying day, supporters go to Parliament to meet their own MPs.
The first is PauseCon's Tuesday, but this plan is for any lobbying day,
so each one later costs little more than a Luma event.

For each supporter, the day goes like this:

- They sign up, giving their postcode, so we know their MP.
- We ask them to email their MP, asking to meet on the day.
- The MP replies, saying they will or won't meet, or doesn't reply.
- We email them again, depending on what their MP said.
- On the day, they go in a group with others from their constituency
  or nearby.

People who don't live in the UK can come too. They join a group with
someone who is a constituent. Last time about 30% were from abroad.

## Signing up

A lobbying day is a Luma event with a required postcode question. The
Luma import already keeps the answer to a question whose label
includes "postcode", and finds the MP from it, as it does for every
supporter's postcode. So people who sign up on Luma need nothing new.

People who sign up through the PauseCon form give their postcode there,
and the site registers them on the Luma event. The site registers
people on Luma by name and email alone, and I don't know whether Luma
lets that through when the event has a required question. That needs a
real test before PauseCon opens (Luma's API:
https://docs.luma.com/reference/post_v1-event-add-guests).

We don't ask about citizenship, which is more than we need to know.
What the day needs is whether someone has an MP to meet, so we ask for
a UK postcode, with "I live outside the UK" as the other choice. People
from abroad can sign up without a postcode.

Most may sign up on Luma rather than our form. Whether the Luma event's
postcode question is required isn't settled. If it's required, people
from abroad need something to put in it, for instance "Your UK
postcode, or 'none' if you live outside the UK". Either way, an answer
that isn't a UK postcode finds no MP, and the site treats that person
as from abroad. Whether the import then needs to tell a typo from
someone abroad is something to watch for at the first lobbying day.

## Writing to their MP

The site already has letters to MPs (the campaigns, under
`/campaigns/`). The supporter writes in our letter builder, and it goes
from our letters inbox under an address of its own, so the MP never
sees the supporter's email. Replies are passed on to the supporter, and
we keep a copy. That does the job of "CC us" in the notes, and better,
as the site sees every reply.

So asking an MP for a meeting would be a campaign. Campaigns are
defined in code now: their letters, their pages and their order. Four
ways to make one for each lobbying day:

O5. A new campaign in code for each lobbying day, as the Sobel bill's
was. It is simple, but a developer has to add each one.

O6. One lobbying-day campaign in code, whose letter fills in the day's
date and place from the lobbying day it's for. Staff set up a lobbying
day by picking its Luma event, and the letter follows. Only the words
of the letter are in code.

O7. Campaigns that staff can make and edit on the staff site: the
letter, its subject and its dates. This helps every campaign, not just
lobbying, but it's the most work, and it has to keep each letter as it
was sent, even after the campaign has been edited.

O14. The middle way. Staff edit a campaign's subject and letter on the
staff site, and the rest stays in code: the campaign's page and its
words, its attachments, and its place in the order. The letter editor
would be the broadcast writer's, with the MP's fields (their name,
constituency, and what they've already done) where a broadcast has the
reader's. Each sent letter is kept whole already, but the site measures
how much of the letter a supporter changed, so a letter keeps which
version it started from.

We're doing O14 for now. With it, a lobbying day's letter is a campaign
whose subject and letter staff write for that day, so it covers O6
too. O7 is worth its own plan if staff later want to start whole
campaigns without a developer.

## What the MP said

The site keeps every reply to a campaign letter, but nothing records
what a reply means. For a lobbying day, each letter needs an outcome:
no reply yet, will meet, won't meet, or something else (for instance,
a caseworker will meet them instead).

The site has asks, which record what a politician said to something we
asked them, such as signing a letter. They are kept per MP, not per
supporter. A meeting is a bit of both. The MP agrees to meet, but meets
the supporters who wrote.

O8. The outcome on each letter, so each supporter has their own. An
MP's ask ("will meet constituents on the lobbying day") is then worked
out from their letters, which shows on the MP's page.

O9. The outcome as an ask on the MP alone. When one constituent's
letter gets a yes, everyone writing to that MP counts as having one.
This is simpler, but it loses who asked and who was answered.

I recommend O8.

Someone has to read each reply to set its outcome. The notes suggest
an AI model reading them.

O10. Staff read each reply, in a list of replies waiting to be checked,
as they do for replies to politician mailings now. With 500 to 1,000
people signed up, that could be hundreds of replies.

O11. Claude Haiku, Anthropic's small, fast model, reads each reply as it
comes in and suggests its outcome. Staff see the suggestion in the same
list, and confirm it or change it. Nothing is sent on the strength of a
suggestion alone.

I recommend O11. Two things to settle for it:

- #307 (weekly press survey) brings an AI model into the repo, but in a
  GitHub workflow reading public news pages. This would be the site
  itself calling Anthropic's API from Netlify, so it needs an API key
  in the site's settings and its own code to call the model.
- MPs' replies include constituents' names and details, so Anthropic
  becomes a new processor of personal data. That needs its own entry in
  `docs/data-protection.md` and a line in the privacy policy, before it
  reads a real reply.

## Emails

The broadcasts need to know about the lobbying day, for conditional
blocks and filters:

- Going to the lobbying day already exists, as "going to this event".
- Wrote to their MP already exists, for a campaign.
- What their MP said is new: no reply, will meet or won't meet.

The broadcasts also need two new fields for each reader:

- their MP's name;
- a link to write to their MP on a campaign, which staff pick when they
  put the field in, so it serves any campaign, not just a lobbying
  day's. It opens that campaign's letter with their postcode already
  filled in.

The link is personal, so it can't carry the postcode in plain sight.
It would carry a code that only the site can read.

The link only works for someone whose postcode we know, so it goes in
a conditional block for "has a postcode". The broadcasts' `has:` condition
checks whether a reader has a field, so this may only need the
postcode offered as one.

## The day itself

The notes say people go in groups by constituency, with those from
abroad joining a group. A staff page for the lobbying day would list
everyone going, grouped by MP, with what each MP said.

In the first version, staff form the groups themselves from that page.
The site could make them later, putting people from abroad and those
whose MP said no in with those who have a meeting.

## Personal data

The new things kept about a person are what their MP said in reply, and
whether they live in the UK. Anthropic would be a new processor, of
MPs' replies (O11). Before anything is built, this section
will say what each does to `docs/data-protection.md`, to the privacy
policy and to erasure.
