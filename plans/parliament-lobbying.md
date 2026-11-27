# Parliament lobbying days

This plan is a draft.

## What a lobbying day is

On a lobbying day, supporters go to Parliament to meet their own MPs.
The first is PauseCon's Tuesday, 2 March 2027, but this plan is for
any lobbying day. For each supporter:

- They sign up, giving their postcode, so we know their MP.
- We ask them to email their MP, asking to meet on the day.
- The MP replies, saying they will or won't meet, or doesn't reply.
- We email them again, depending on what their MP said.
- On the day, they go in a group with others from their constituency
  or nearby.

People who don't live in the UK can come too, and join a group with a
constituent. Last time about 30% were from abroad.

## Signing up

A lobbying day is a Luma event with a postcode question. We don't ask
about citizenship: what the day needs is whether someone has an MP to
meet, which the postcode answers. People from abroad sign up without
one. Whether Luma's question is required isn't settled; if it is, it
asks for "your UK postcode, or 'none' if you live outside the UK".

The Luma import already keeps the answer to a question whose label
includes "postcode", and finds the MP from it. An answer that isn't a
UK postcode finds no MP, and the site treats that person as from
abroad.

People who sign up through the PauseCon form give their postcode
there, and the site sends it to Luma with their name and email when it
registers them. Luma's add-guests call takes each guest's answers to
the event's registration questions, by question ID
(https://docs.luma.com/reference/post_v1-events-guests-add), but
`addLumaGuest()` sends only name and email today, so it gains the
answers. Luma's docs don't say what happens when a required question
is left blank, so a test against a test event checks that Luma takes
the answer.

## Writing to their MP

Asking an MP for a meeting is a campaign, under `/campaigns/`. The
supporter writes in our letter builder, and it goes from our letters
inbox under an address of its own, so the MP never sees the supporter's
email. Replies are passed on to the supporter, and we keep a copy, so
the site sees every reply.

Staff edit a campaign's subject and letter on the staff site. The rest
stays in code: the campaign's page and its words, its attachments, and
its place in the order. The letter editor is the broadcast writer's,
with the MP's fields (their name, constituency, and what they've
already done) where a broadcast has the reader's. The site measures how
much of the letter a supporter changed, so each letter keeps which
version it started from.

## What the MP said

Each lobbying day's campaign has an ask, as other campaigns do: an
event ask, such as "Meet constituents in Parliament on 2 March 2027".
Its answers are the event ask's own: going, declined or other (a
caseworker will meet them instead, say). An MP counts as invited once
a supporter's letter has gone to them, as for every ask
(`lib/asks/invited.ts`). Their answer shows wherever an ask's does: on
the MP's page, the asks pages, and the politicians list's Ask filter.

The answer is the MP's, shared by everyone who wrote to them, which
fits, as an MP who agrees to meet meets the group. If an MP will meet
some constituents and not others, the answer's note says so.

In the first version, staff read each reply and set the MP's answer to
the ask, from a list of replies to campaign letters waiting to be
checked, as they have for replies to politician mailings. The list is
useful for every campaign, not just lobbying days. Replies already
have a "dealt with" mark, saying who and when, and the site already
spots automatic replies, such as an office's acknowledgement. So the
list is the replies that aren't automatic and aren't yet dealt with.
On the two live campaigns, about four in five replies are automatic,
which leaves a real reply every day or two to check.

Later, Claude Haiku can read each reply as it comes in and suggest the
MP's answer, for staff to confirm. The site already calls Claude, with
`askClaude()` (`lib/server/outside-services/anthropic.server.ts`) and
the `ANTHROPIC_API_KEY` the press survey uses. Anthropic is already a
processor, but only of news articles, with no supporter's data
(`docs/data-protection.md`). MPs' replies include constituents' names
and details, so its entry there and the privacy policy would need to
say so first.

## Emails

The broadcasts already have conditions for going to an event, and for
having written to their MP on a campaign. They need:

- a condition on their MP's answer to an ask, found from the reader's
  postcode: not answered, going, declined or other. Every ask can use
  it, not just a lobbying day's;
- a field for their MP's name;
- a field for a link to write to their MP on a campaign, which staff
  pick when they put the field in. It opens that campaign's letter with
  their postcode filled in. The link is personal, so it carries a code
  only the site can read, not the postcode.

The link only works for someone whose postcode we know, so it goes in
a conditional block for "has a postcode". The broadcasts' `has:`
condition checks whether a reader has a field, so this may only need
the postcode offered as one.

## The day itself

A staff page for the lobbying day lists everyone going, grouped by MP,
with what each MP said, and staff form the groups from it. Later, the
site could make the groups itself.

## Personal data

The new thing kept about a person is whether they live in the UK. An
MP's answer is about the MP, as every ask's is. Before anything is built, this section
will say what each does to `docs/data-protection.md`, to the privacy
policy and to erasure.
