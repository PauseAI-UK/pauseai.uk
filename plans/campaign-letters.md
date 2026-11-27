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

Every published version is kept for good: its subject, its letter, who
published it and when. The version list on the staff page shows each
one, with how many letters started from it. Letters sent before this
change don't point at a version (some were sent before the code's last
change to the letter), so they're counted as "before versions", and they
still keep the text they started from, as now.

A campaign added to the code later appears on the staff site with no
letter. Its public page says it isn't open yet until staff publish its
first version.

## What's stored

The draft is kept on the campaign's row, and published versions in a
table of their own, where they're only ever added, never changed. That
way "a version never changes once published" is true of the table
itself, rather than something the code has to be careful about.

`campaigns` gains the draft, all empty while there isn't one:

- `draft_subject` and `draft_body` (the letter, as a mailing's body is
  kept: JSON with fields and parts only some get);
- `draft_version`, which goes up with each save, so that when two staff
  edit at once the second save is refused rather than overwriting the
  first, as with mailings;
- `draft_updated_at` and `draft_updated_by`.

`campaign_letters` is new, with a row for each published version:

- `id`;
- `campaign`, the campaign's slug, deleted with the campaign;
- `subject` and `body`;
- `published_at`, and `published_by`, the staff member's email (empty for
  the two versions the migration copies from the code).

`letters_from_supporters` gains `campaign_letter_id`, the version the
letter started from, empty for letters from before. A campaign still
can't be deleted while it has letters, as every letter points at it.

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

The campaign pages are built once now, as they have nothing that changes.
Reading the letter from the database means they're either built on each
visit or rebuilt whenever staff publish. I'll read this Next.js's docs on
caching before choosing, and say which in the PR.

## Personal data

Nothing new is kept about supporters or constituents. A version keeps the
email of the staff member who published it, as mailings do of whoever
made them. The letters a supporter sends are erased as now, and their
version stays, as it's the campaign's, not theirs. So nothing changes in
`docs/data-protection.md`, the privacy policy or erasure.

## Left for later

The public "Take action" page that lists the campaigns is separate work,
after this.
