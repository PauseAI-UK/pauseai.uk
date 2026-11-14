// Every word of mailings and of the campaigns' pages that only the staff
// pages show: the list of mailings and a mailing's page, and the list of
// campaigns and a campaign's page, with those the server uses too
// (lib/mailings/copy.ts).
import { count } from "@/lib/content/plural";
import { mailingsCopy as wordsTheServerUses } from "@/lib/mailings/copy";

export const mailingsCopy = {
  ...wordsTheServerUses,
  // The mailings page (/staff/mailings): PauseAI's mails to many politicians, and each one's own page.
  mailings: {
    title: "Mailings",
    intro: "Emails PauseAI sends to many notable people at once",
    none: "No mailings yet.",
    // Over the list: how many there are.
    total: (n: number) => count(n, "mailing", "mailings"),
    columns: {
      title: "Mailing",
      ask: "Ask",
      sender: "Sender",
      sentAt: "Sent",
      sent: "Sent to",
      replied: "Replied",
      answered: "Answered",
    },
    // A mailing copied from Airtable, which kept only who got it.
    imported: "From Airtable",
    // The chips in an imported mailing's text.
    importedFields: {
      greeting: "Greeting",
      own: "Their own paragraph",
      colleagues: "How many colleagues",
    } as Record<string, string>,
    notRecorded: "Not recorded",
    notSent: "Not sent yet",
    // A mailing's own page.
    fields: {
      ask: "Ask",
      sender: "Sender",
      sentAt: "Sent",
      subject: "Subject",
      attachments: "Attachments",
      source: "Source",
    },
    noAsk: "None",
    textTitle: "The email",
    noText: "Text not available, as sent from Airtable. Open a letter under Recipients to copy a Gmail search for it.",
    recipientsTitle: "Recipients",
    // Over the recipients: how many; instead of them, when there are none.
    recipientsCount: (n: number) => count(n, "recipient", "recipients"),
    noRecipients: "Nobody yet.",
    recipientColumns: {
      name: "Politician",
      status: "Status",
    },
  },
  // The campaigns page (/staff/campaigns): letters supporters write to politicians, and each campaign's own page.
  campaigns: {
    title: "Campaigns",
    intro: "Letters supporters write to politicians, through a form on the site",
    none: "No campaigns yet.",
    fromSupporters: "From supporters",
    noLetters: "No letters",
    // In the list of campaigns, after a dot, as a mailing's row says where it stands: how many of its letters went.
    sent: (n: number) => `${count(n, "letter", "letters")} sent`,
    started: "Started",
    last: "Last letter",
    from: "From",
    to: "To",
    supporters: (n: number) => count(n, "supporter", "supporters"),
    lettersTo: (letters: number, politicians: number) =>
      `${count(letters, "letter", "letters")} to ${count(politicians, "politician", "politicians")}`,
    theLetter: "The letter",
    publicPage: "Public page",
    seePublicPage: "See it",
    version: "Version of the letter",
    versionLine: (from: string | null, n: number) => `${from ? `From ${from}: ` : ""}${count(n, "letter", "letters")}`,
    // Over a campaign's letter, as a mailing's says who it's to.
    fromEach: "Each supporter",
    lettersTitle: "Letters",
    // Over the letters one of the counts has chosen, and the way back to them all.
    // Over the letters whose text was changed; those a state's count chooses are headed as a mailing's are (copyStates.tabs).
    tabs: {
      changed: "Letters with the text changed",
    },
    showAll: "Show all the letters",
    // Under how much of their letters was their own, leading to those letters.
    changedLink: (n: number) => `${n} changed the wording`,
    columns: { politician: "Politician", from: "From", ownWords: "Own words", status: "Status" },
    fields: {
      salutation: "Salutation",
      constituency: "Constituency",
      name: "Name",
      postcode: "Postcode",
    } as Record<string, string>,
    noText: "We've lost the text.",
  },
};
