# Staff edit a campaign's letter

Staff write and edit each Email your MP campaign's subject and letter on
the staff site, and publish it when it's ready. Everything else about a
campaign stays in code: its page and that page's words, its attachments,
its ask, and its place in the order.

## What staff do

A campaign's staff page (`/staff/campaigns/<slug>`) has "The letter", which
today shows the one version written in code. It gains an Edit button.
Pressing it opens a draft, a copy of the published letter, in the same
editor staff use for mailings to politicians. The draft saves as they
type, as a mailing's draft does, but supporters don't see it. When they
press Publish, the draft becomes the campaign's new version, and every
supporter who opens the form from then on starts from it. Staff can also
throw a draft away.

In the editor, the letter can have the MP's fields (their salutation,
name, constituency and party) and the supporter's name, as chips. It can
also have parts only for MPs with a given answer to an ask, such as "Only
for MPs who signed ControlAI's letter", which the editor's "Only for those
who…" menu already makes. The Sobel bill's letter uses one of those parts
to thank an MP who signed ControlAI's letter, which the code does today.

Beside the draft, a preview shows it as a supporter would start from it,
as the mailing writer's Preview card does for a mailing. Staff pick an
MP, real or a test one (ZZ99ZB is the one who signed ControlAI's
letter), and see the subject and letter filled in for that MP's
constituents, with the parts only for some MPs shown or left out by
that MP's answers. Only the MP changes what a draft says: the supporter
adds just their name and address at the end, which the site doesn't
know until they type them, so the preview signs it with a made-up
example, and says so. Once published, the staff page's "Public page: See
it" link and a test postcode try the real form.

Every published version is kept for good: its subject, its letter, who
published it and when. The version list on the staff page shows each
one, with how many letters started from it. Letters sent before this
change don't point at a version (some were sent before the code's last
change to the letter), so they're counted as "before versions", and they
still keep the text they started from, as now.

A campaign added to the code later appears on the staff site with no
letter. Until staff publish its first version, the step where a
supporter would write it says it isn't open yet ("How the form uses
it").

## What's stored

`campaign_letters` is new. A row is one of a campaign's letters, as
staff write it: a published version, or the draft staff are working on.

- `id`;
- `campaign`, the campaign's slug, deleted with the campaign;
- `subject` and `body` (the letter, as a mailing's body is kept: JSON
  with fields and parts only some get);
- `version`, which goes up with each save of a draft, so that when two
  staff edit at once the second save is refused rather than overwriting
  the first, as with mailings;
- `updated_at` and `updated_by`, the last save;
- `published_at` and `published_by`, the staff member's email, both
  empty on the draft. The two versions the migration copies from the
  code have a `published_at` but no `published_by`.

A campaign has at most one draft (a unique index on `campaign` where
`published_at` is empty). Publishing stamps the draft with
`published_at` and `published_by`, and from then on the database refuses
any change to that row. Editing again starts a new draft, a copy of the
latest version.

`letters_from_supporters` gains `campaign_letter_id`, the version the
letter started from, empty for letters from before. It only ever points
at a published version: the server checks that when it takes a letter,
and the draft can't be sent from, as the form never sees it. A campaign
still can't be deleted while it has letters, as every letter points at
it.

For example, the Sobel bill's campaign after staff have published one
change and started on another:

| id | campaign | subject | published_at | published_by |
|---|---|---|---|---|
| 1 | support-sobel-bill | Request to support the Artificial Superintelligence Bill | 2026-12-01 09:00 | (from the code) |
| 4 | support-sobel-bill | Request to support the Artificial Superintelligence Bill | 2026-12-03 14:20 | jane.smith@example.com |
| 7 | support-sobel-bill | Please attend the debate on the Artificial Superintelligence Bill | | |

Row 7 is the draft. Supporters start from row 4, and the letters they
send have `campaign_letter_id` 4.

What isn't stored, and is worked out each time: which version is
current (the latest published), how many letters each version got
(counted from the letters), and whether a campaign is open (it has a
published version).

The migration copies the two campaigns' letters from the code as their
first versions, written out as JSON, with the Sobel bill's thank-you
paragraph as a part only for MPs who signed ControlAI's letter. Then
`subject` and `letter` come out of the code's campaigns
(`lib/content/email-your-mp.ts`).

## How the form uses it

Today the form builds the draft in the browser from the code. Instead,
the campaign's pages read the latest published version from the database
and hand it to the form, with its ID. When the supporter sends their
letter, the form sends that ID, and the server rebuilds the draft from the
same version, so it measures how much they changed against what they
were actually given, even if staff published a new version in between.
The letter records the version's ID.

Only the step where the supporter writes their letter
(`/campaigns/<slug>/write`) needs the letter. That page is built on each
visit, reading the latest version as it's shown, as `/press` reads its
coverage. The campaign's own page, with the postcode form, and the
preview and sent steps don't need it, so they stay built once at deploy.

Building on each visit costs one small database query per visit to that
step, which is a few milliseconds, on a page that already looks up the MP.

A campaign with no published letter says so on its write step. Its own
page is built at deploy, so it can't know, and still shows the postcode
form. Only a link to it shows it, as the public list of campaigns that
comes later will only list campaigns that have a letter.

## Personal data

Nothing new is kept about supporters or constituents. A version keeps the
email of the staff member who published it, as mailings do of whoever
made them. The letters a supporter sends are erased as now, and their
version stays, as it's the campaign's, not theirs. So nothing changes in
`docs/data-protection.md`, the privacy policy or erasure.

## Left for later

The public "Take action" page that lists the campaigns is separate work,
after this.
