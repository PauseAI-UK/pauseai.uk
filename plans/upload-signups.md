# Import sign-ups

A staff page, Import sign-ups, in the navigation under Supporters. It takes a CSV
of paper forms filled in while flyering. Built on the `upload-signups-2` branch, and
described in `docs/domain-concepts.md`, "Form entries". This plan holds only what's
left before it can merge.

Designs: https://claude.ai/artifact/2LoKADT8Xw4zFXgVEbdJ4E (private to Francis).

## To settle before merging

### Is signing the form enough to email them? (legal)

The new forms have no mailing list box: signing one is joining, so every import
gives PauseAI UK by email, and calls and texts for a number given. Whether
what volunteers say in the street makes that consent is for whoever advises on
data protection (`docs/data-protection.md`).

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
  read-only. Other routes are a file for global to add by hand, or an email with a link to join (https://pauseai.info/join),
  whose form asks for its own consents. Either way, the hourly import then makes
  them members by matching their email, if the share permission is set.
- Photos of the paper forms, which would hang off the form entry.
- WhatsApp, which Reuben adds to the waiting room by hand from the spreadsheet.
