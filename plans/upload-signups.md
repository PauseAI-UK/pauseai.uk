# Upload sign-ups

A staff page, Upload sign-ups, in the navigation under Supporters. It takes a CSV
of paper forms filled in while flyering. Built on the `upload-signups` branch, and
described in `docs/domain-concepts.md`, "Form entries". This plan holds only what's
left before it can merge.

Designs: https://claude.ai/artifact/2LoKADT8Xw4zFXgVEbdJ4E (private to Francis).

## To settle before merging

### 1. Is PauseAI UK the right permission? (for Reuben)

A mailing list tick is the form entry's box, so PauseAI UK by email, and calls and
texts for a number given, the same as our other forms. That's the default Francis
chose until Reuben answers. The newest entry's box wins, so a blank on paper turns
an earlier yes on a web form into a no.

If the answers point elsewhere:

- **PauseAI global email,** if the tick means the newsletter or global's list. The
  staff interface describes `pauseai-updates` as newsletters sent through CiviCRM
  by either the global or the UK team. Nobody gets them until CiviCRM has their
  details.
- **A new topic, "Signed up at flyering", by email,** if it means neither.

Either would be a new migration.

### 2. Do people who ticked nothing get imported? (for Reuben)

They are for now, with no permission to contact. 14 of the 105 in the example file
said yes to neither the march nor the mailing list. It depends on what signing the
form without ticking anything means.

### To ask Reuben

- What does each checkbox on the paper form say, on each version of it?
- What do volunteers tell people about each box in the street?
- Does a tick for the mailing list mean the newsletter, PauseAI UK's own news, or
  global's?
- Does it cover being passed to global?
- What does signing the form without ticking anything mean: joining, or only
  giving their details?
- What does a march Y mean on the handwritten page, which has no tick box?

### Words

Every new word on the pages, and the privacy policy's new line, is a placeholder
for a person to write. `tests/checks/placeholder-copy.test.ts` fails until then.

## Outside this feature

- **The example file's doubts.** Reuben checks them against the paper before it's
  uploaded, and removes any wrong ones by hand on Luma. 36 rows have something in
  `Needs check`, 30 of those about the email, and 2 have a "Maybe" for the march.
  20 of those with a doubt and both "Maybe" rows are on the march's guest list, 14
  or 15 of them with a doubt about the email, so a confirmation may have gone to a
  wrong address. Uploaded unchecked, the file imports all of them, as the site
  doesn't read that column.
- **The paper form.** A line on it about joining and sharing with global would
  give later sign-ups a recorded consent. What people agree to now is mostly what's
  said in the street, which the site can't record, and passing details to Stichting
  PauseAI needs consent (`docs/data-protection.md`). Whether what's recorded is
  enough is a legal question this plan doesn't settle.

## Left for later

- **Becoming members.** Francis has asked global about an API. `members` is a copy
  of Stichting PauseAI's Airtable base, and the import marks any row it didn't
  read as removed, so rows can't be added to it from here. `AIRTABLE_TOKEN` is
  read-only. Other routes are a file for global to add by hand, for those who ticked
  the mailing list, or an email with a link to join (https://pauseai.info/join),
  whose form asks for its own consents. Either way, the hourly import then makes
  them members by matching their email, if the share permission is set.
- Photos of the paper forms, which would hang off the form entry.
- WhatsApp, which Reuben adds to the waiting room by hand from the spreadsheet.
