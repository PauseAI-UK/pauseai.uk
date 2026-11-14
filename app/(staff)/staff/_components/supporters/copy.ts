// Every word of supporters that only the staff pages show: importing paper
// sign-ups, the bounced emails page and the dev links to a supporter's
// contact preferences, with those the server uses too
// (lib/supporters/copy.ts).
import { supportersCopy as wordsTheServerUses } from "@/lib/supporters/copy";
import { count } from "@/lib/content/plural";

export const supportersCopy = {
  ...wordsTheServerUses,
  // At the foot of a supporter's consents in a fixture build: a button per address that opens their contact preferences.
  devPreferences: {
    title: "Dev: links in our emails to them",
    // An address's contact preferences, as the email with a link to them opens them.
    preferences: (address: string) => `Contact preferences: ${address}`,
    // The unsubscribe page of the latest broadcast email of theirs under these topics.
    unsubscribe: (topics: string) => `Unsubscribe page: their latest ${topics} email`,
    // The same, for an email too old for the page to show more than its button.
    oldUnsubscribe: "Unsubscribe page: an email over 30 days old",
  },
  // Uploading a CSV of paper sign-ups (/staff/supporters/import).
  signupUpload: {
    title: "Import sign-ups",
    intro: "Import people from a spreadsheet from paper sign-up forms",
    steps: { file: "Choose a file", check: "What will happen" },
    drop: {
      title: "Drop a CSV file here",
      or: "or click to choose one",
      label: "CSV file",
      another: "Choose a different file",
      read: (rows: number, columns: number) => `${rows} rows, ${columns} columns.`,
      tooBig: "This file is over 4 MB. Choose a smaller one.",
      notCsv: (name: string) => `${name} isn't a CSV file. Save it as CSV from your spreadsheet and try again.`,
    },
    refused: {
      empty: "This file is empty.",
      missing: (fields: string, headings: string) => `This file has no ${fields} column. Its columns are: ${headings}.`,
      clash: (field: string, headings: string) =>
        `More than one column could be ${field}: ${headings}. Remove or rename one and try again.`,
      badChoice: "The event or column you chose can't be used any more. Go back and choose again.",
    },
    help: {
      title: "What the file needs",
      short: [
        "Fix any mistakes before you upload it",
        "One row per person, with column names in the first row",
        "Name and Email columns (required)",
        "Phone and Postcode columns (optional)",
        "A yes/no column for an event (optional)",
        "Other columns are ignored",
      ],
      more: "All column names and values",
      less: "Hide column names and values",
      intro: "Columns can be in any order, and capitals, spaces and punctuation in their names don't matter.",
      columns: { field: "Column", names: "Names it accepts", values: "Values" },
      fields: {
        name: { label: "Name", values: "Full name" },
        email: { label: "Email", values: "Email address" },
        phone: { label: "Phone", values: "Any format" },
        postcode: {
          label: "Postcode",
          values:
            "Full postcode, or just the first half (such as SE15). Partial is less good as can't find MP with it.",
        },
      } as Record<string, { label: string; values: string }>,
      event: { label: "Event sign-up", names: "Any name. You choose it after uploading.", values: "yes" },
      yes: (words: string) => `Yes: ${words}.`,
      no: "No: blank, n, no, false or 0. Anything else holds the row back.",
    },
    columns: {
      heading: "Column",
      goes: "Imported as",
      filled: "Rows filled in",
      ignored: "Ignored",
      event: "Event sign-up",
    },
    form: {
      formsTitle: "About these forms",
      eventTitle: "Event to sign up to",
      event: "Event",
      findEvent: "Find an event",
      removeEvent: "Remove event",
      eventColumn: "Column for event sign-up",
      noColumn: "None",
      noEventColumn: "This file has no yes/no column to use for the event.",
      signedOn: "Date collected",
      note: "Where collected",
      noteHint: "Camden Town flyering",
    },
    preview: {
      title: "Preview import",
      back: "Import sign-ups",
      needsFile: "Choose a file for a preview of what will happen.",
      // Under the import button, each what stops it.
      blockers: {
        file: "Choose a file",
        note: "Add where collected",
        event: "Choose the event, or set the column to None",
      },
      loading: "Working out what will happen…",
      failed: "Something went wrong and nothing was imported. Please try again.",
      changed:
        "Some details changed after the preview loaded, so nothing was imported. Check the updated preview below.",
      summary: {
        entries: (n: number) => `${n} people will be imported.`,
        held: (n: number) => `${n} won't be imported.`,
        supporters: (fresh: number, known: number) => `${fresh} new, ${known} already on the supporters list.`,
        event: (name: string, n: number) =>
          `${n} will be registered for "${name}". Luma will email them a confirmation.`,
        // Signing the form is joining the list, but "No bulk emails" stops it, so each is emailed once, saying
        // where they signed (`where`, as the email says it) and how to lift it. "Do not email" stops even that.
        notices: (n: number, where: string) =>
          `${count(n, "person has", "people have")} “No bulk emails”, so will be emailed once, saying they signed up on ${where} and how to lift it.`,
        noEmail: (n: number) =>
          `${count(n, "person has", "people have")} “Do not email”, so won't hear from us at all.`,
      },
      table: { row: "Row", happens: "What will happen" },
      happens: {
        notImported: "Not imported",
        alreadyImported: "Already imported",
        known: { email: "Existing (same email)", mobile: "Existing (same mobile)" },
        register: "Register on Luma",
        going: "Already on Luma",
        mailing: "Mailing list",
        phone: "Calls and texts",
        notice: "Emailed: “No bulk emails”",
        noEmail: "“Do not email”",
      },
      problems: {
        "no-name": "No name",
        "long-name": "Name too long",
        "no-email": "No email",
        "bad-email": "Invalid email",
        "bad-phone": "Invalid phone number",
        "same-email": "Email used on another row",
        blocked: "Email blocked after a bounce or complaint",
      } as Record<string, string>,
      unread: (value: string, column: string) => `Unclear answer in ${column}: "${value}"`,
      importNow: (people: number, luma: number) => `Import ${people} people and register ${luma} on Luma`,
      importOnly: (people: number) => `Import ${people} people`,
      nothing: "There's nothing new to import from this file.",
    },
    result: {
      title: (filename: string) => `Import: ${filename}`,
      back: "Import sign-ups",
      // Under the title, a fact each, on one line with a dot between them.
      summary: (imported: number, held: number) => `${imported} imported, ${held} were not`,
      by: (who: string, when: string) => `Imported by ${who} on ${when}`,
      signedOn: (day: string) => `Collected on ${day}`,
      // Before the event's name, which links to it on Luma.
      event: "Event signed-up to:",
      note: (note: string) => `Where collected: ${note}`,
      columns: {
        person: "Name",
        phone: "Phone",
        postcode: "Postcode",
        happened: "What happened",
      },
      none: "Everyone from this upload has since been erased.",
      // While the Luma import the upload started is still to copy its event's guests, by a spinner.
      lumaReading: "Importing from Luma",
      luma: {
        added: "Registered on Luma",
        skipped: "Not registered: unsubscribed from our Luma calendar",
        "not-configured": "Not registered: Luma isn't set up",
        failed: "Not registered: Luma had an error. Upload the file again to retry.",
      } as Record<string, string>,
    },
    uploads: {
      title: "Past imports",
      see: "See past imports",
      none: "No imports yet.",
      imported: "imported",
      heldBack: "held back",
      by: (who: string) => `imported by ${who}`,
    },
  },
  // The page of supporters' blocked addresses (/staff/supporters/bounced-emails), titled as the navigation names
  // it; the rest of its words are every blocked address's (staffCopy.emails).
  bouncedEmails: {
    title: "Bounced emails",
    // Under the title, what the page is.
    intro: "Supporters' bad emails, unblock them here",
  },
  // Hovering the Consent's chip while the list chooses who a broadcast goes to, where it can't be changed.
  consentLocked: "To change the consent, go back to the broadcast page.",
};
