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
  // Writing a campaign's letter (/staff/campaigns/<slug>/letter): its draft, a preview for an MP, and publishing it.
  campaignLetter: {
    title: (campaign: string) => `⁂ The letter for ${campaign}`,
    write: "⁂ Write",
    preview: "⁂ What a constituent starts from",
    noMps: "⁂ There are no MPs to preview the letter for.",
    // The preview signs the letter with a made-up sender, as each supporter's own name and address go there.
    exampleSender: "Jane Smith",
    exampleAddress: ["1 High Street", "AB1 2CD"],
    exampleNote: "⁂ The name and address at the end are an example. Each supporter's own go there.",
    publishTitle: "⁂ Publish",
    publish: "⁂ Publish the letter",
    // Why it can't be published, under the button.
    refusals: {
      "no-subject": "⁂ It needs a subject.",
      "no-letter": "⁂ It needs a letter.",
      "not-draft": "⁂ Someone else has just published this draft.",
      gone: "⁂ Someone else has just deleted this draft.",
    },
  },
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
    // The letters from before staff could edit a campaign's letter, as a version in the list.
    beforeVersions: (n: number) => `⁂ Before versions: ${count(n, "letter", "letters")}`,
    ownDrafts:
      "⁂ These letters were written before staff could edit the letter. Each one keeps the draft it started from.",
    // Over the letter, for a campaign in the code: opening its draft, or going back to the one open.
    editLetter: "Edit the letter",
    carryOn: "⁂ Carry on with the draft",
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
    // A campaign letter's fields: the MP's, and the sender's.
    fields: {
      salutation: "Salutation",
      constituency: "Constituency",
      name: "MP's name",
      sender: "Sender's name",
      postcode: "Postcode",
    } as Record<string, string>,
    noText: "We've lost the text.",
  },
  // What a mailing's buttons and forms say when the site refuses them (lib/form-result.ts), by the reason it gives.
  // Those said at the top of the page are said once the page has caught up with what changed.
  refusals: {
    // At the top of the page, after Unschedule or Stop sending is pressed on a mailing that was no longer
    // scheduled or sending when the press arrived, as someone else stopped it first or it had all gone.
    stop: { gone: "This mailing is no longer scheduled or sending, so there was nothing to stop." },
    // Change the time's form.
    reschedule: {
      // Under its fields, when the time chosen has passed, as it can while the form stays open.
      "too-soon": "That time is in the past, choose a later one.",
      // At the top of the page, when the mailing was no longer scheduled, as someone else unscheduled it or it
      // had started sending.
      gone: "This mailing is no longer scheduled, so its time can't be changed.",
    },
    // At the top of the page, after Copy mailing is pressed on a mailing deleted since the page loaded.
    copy: { gone: "This mailing has been deleted, so it can't be copied." },
    // At the top of the page, after Delete draft is pressed on a draft someone has scheduled since the page loaded.
    deleteDraft: { "not-draft": "Someone has scheduled this mailing, so it can't be deleted. Unschedule it first." },
    // Send test, on a draft.
    test: {
      // Under the button, when the email couldn't be sent.
      "not-sent": wordsTheServerUses.mailingPages.testFailed,
      // Under the button, when the recipient chosen has been unticked, or lost their address, since the page loaded.
      "not-recipient": "Can't send a test copy, because that politician is no longer getting this mailing.",
      // At the top of the page, when the draft has been deleted since the page loaded.
      gone: "Can't send a test copy, because the draft was deleted.",
    },
    // At the top of a letter's page, after Nothing to do is pressed on a reply someone else has dealt with, or
    // that has been deleted, since the page loaded.
    nothingToDo: { gone: "Someone has already dealt with this reply." },
  },
};
