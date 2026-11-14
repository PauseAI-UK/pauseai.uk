// Every word the staff interface (/staff) shows.

import { daysInWords, FAILURES_TO_STOP, SENDING_DAYS, WAIT_DAYS } from "@/lib/broadcast-days";
import { letterEditorCopy } from "@/lib/content/letter-editor";
import type { AddressSearch, ImportJob } from "@/lib/import-runs";
import { count, plural } from "@/lib/content/plural";
import { politiciansCopy } from "@/lib/politicians/copy";

/**
 * What can't be done to an ask, said on its form and, the same words, when a
 * save or a delete is refused for it (staffCopy.asks).
 */
const askLimits = {
  kindFixed: "Kind can't be changed now, as politicians have answered it.",
  named: "The site's own code uses this ask, so it can't be deleted.",
  notDeletable: "Asks can't be deleted while answers, campaigns or mailings refer to them.",
};

/** What one supporter's copy of a broadcast is, by how it went: the first word of its page's title, and its step of the trail above it. */
const copyKind = (channel: "email" | "text") => (channel === "email" ? "Email" : "Text");

/** After a bounce alert, for a bounce read from a Gmail mailbox: a link to it there; nothing for one Postmark reported. */
const bounceLine = (link: string | undefined) => (link ? `\n\nThe bounce, in Gmail:\n${link}` : "");

/** What a CiviCRM import run sent CiviCRM before it pulled, at the start of its line. */
const sentToCivicrm = (u: { sent: number; refused: number; unanswered: number }): string =>
  `${count(u.sent, "opt-out", "opt-outs")} sent to CiviCRM${u.refused ? `, ${u.refused} refused` : ""}${u.unanswered ? `, ${u.unanswered} to try again` : ""}. `;

/** The button that sets a stopped broadcast going again, which the email about one stopping names. */
const RESUME_SENDING = "Resume sending";

export const staffCopy = {
  // A letter in Gmail, by its page's heading: a button that copies a
  // search for it, then says to paste it, and where.
  findInGmail: {
    copy: "Copy Gmail search",
    copied: "Copied!",
    // The × that closes the note, as a screen reader names it.
    close: "Close",
    // Then, in the note under it, what to do, in bold, "paste" stressed; under that, where.
    next: { before: "Next, ", stressed: "paste", after: " into Gmail search." },
    where: (mailbox: string) => `You must be in an inbox that can see ${mailbox}'s mail.`,
    // A supporter's letter sent before policy@ was a Gmail account, when it was a Google Group.
    policyGroup: "You must be in an inbox that got policy@'s mail when it was sent, such as Joseph's.",
    // A letter of PauseAI's copied from Airtable, which kept no record of the Gmail it went from.
    whereUnknown: "You must be in an inbox that sent it. Most of these went from Joseph's.",
  },
  // One of PauseAI's letters, and the replies in its thread.
  letterThread: {
    title: "Letter and replies",
    // Folds the mail a message quotes and its footer, under its text.
    quoted: "Quoted mail and footer",
    // Folds all of an automatic reply but its first paragraph: the rest, the mail it quotes and its footer.
    autoInFull: "Automated reply in full",
    // An imported letter, whose text Airtable didn't keep.
    noText: "Text not available, as sent from Airtable.",
    // Over the text of a letter that's built from the send before it and the person's earlier letter.
    approximate:
      "Approximate: rebuilt from an earlier letter found in Joseph's personal email. This isn't what they received, but it was probably much like this.",
    // A supporter's letter whose text the site doesn't have.
    supporterNoText: "Text not available.",
    noReplies: "No replies yet.",
    unreadable: "This message couldn't be read.",
    // Over each message, as an email shows them.
    headers: { from: "From", to: "To", cc: "Cc", date: "Date", subject: "Subject" },
  },
  // The home page: the dashboard.
  home: {
    title: "Dashboard",
    // The dashboard: what needs a person, then the window's numbers in
    // three groups, each against the window before.
    dashboard: {
      // What's waiting for someone, shown only when something is: each kind of item, its detail, and its button.
      // The list's name, read out by a screen reader; not shown.
      actionsTitle: "Needs a person",
      actions: {
        // A body's import held, as it would change too much: which, and how many politicians.
        heldImport: (job: string, changes: number) => `${job} would change ${changes} politicians`,
        // Why it's held, and what to do.
        heldImportDetail:
          "That's a lot of politicians, or someone's name has changed, so please check it, and apply or discard it.",
        decide: "Review import",
        blockedMp: (name: string) => `${name}'s email is bouncing`,
        blockedMpDetail: "Find a working email for this MP if it has changed, or unblock if working now.",
        openMp: "Fix MP email",
        failedImport: (job: string) => `Import '${job}' failed`,
        failedImportDetail: (error: string, at: string) => `Error: "${error}" · ${at}`,
        seeRun: "See failed run",
        // The newest read of Gmail found mail in the letters inbox it couldn't handle: when, and where it waits.
        lettersInboxDetail: (at: string) =>
          `Open each in Gmail and deal with it by hand: forward it, answer it, or leave it. Found ${at}.`,
        // Its button, to the run's page, which lists each with why it wasn't relayed and a link to it in Gmail.
        lettersInboxButton: "See emails",
        // Replies to broadcasts that may be someone asking to stop, waiting for someone to look at them.
        broadcastReplies: (n: number) => `${count(n, "reply", "replies")} to a broadcast to check`,
        broadcastRepliesDetail: "Someone asking to stop must be recorded as an opt-out within a few days.",
        broadcastRepliesButton: "See replies",
      },
      // The windows: each a tab, its length in days; "Show" is the tabs' name, read out by a screen reader.
      window: (days: number) => `${days} days`,
      windows: "Show",
      // After each number: what it counts, for one and for more.
      metrics: {
        lettersSent: (n: number) => plural(n, "supporter email to politicians", "supporter emails to politicians"),
        lettersReplied: (n: number) => plural(n, "reply from politicians", "replies from politicians"),
        politiciansAgreed: (n: number) => plural(n, "politician agreed to an ask", "politicians agreed to an ask"),
        eventRegistrations: (n: number) =>
          plural(n, "person registered for an event", "people registered for an event"),
        eventsHeld: (n: number) => plural(n, "event held", "events held"),
        supportersAdded: (n: number) => plural(n, "new supporter", "new supporters"),
        // Supporters who stopped any consent: an unsubscribe, from Luma, CiviCRM or anywhere else.
        unsubscribes: (n: number) => plural(n, "new opt-out", "new opt-outs"),
      } as Record<string, (n: number) => string>,
      // A count of nothing, instead of a 0.
      none: "No",
      // Under the number: against the window before.
      change: {
        up: (n: number, days: number) => `▲ ${n} on the ${days} days before`,
        down: (n: number, days: number) => `▼ ${n} on the ${days} days before`,
        same: (days: number) => `Same as the ${days} days before`,
      },
      // A sparkline's name, which only screen readers read: the tile's label
      // ("event registrations"), and the span the line covers.
      series: (what: string, days: number, points: number) =>
        days === 7
          ? `Sparkline of ${what}, week by week over the last ${points} weeks`
          : `Sparkline of ${what}, ${days} days at a time over the last ${days * points} days`,
      // The chart of new supporters' name, which only screen readers read.
      bySourceName: (what: string, days: number, points: number) =>
        days === 7
          ? `Bars of ${what} by source, week by week over the last ${points} weeks`
          : `Bars of ${what} by source, ${days} days at a time over the last ${days * points} days`,
      // A point's label: the window it counts, by the day it begins.
      seriesPoint: (days: number, from: string, n: number) =>
        days === 7 ? `Week beginning ${from}: ${n}` : `${days} days beginning ${from}: ${n}`,
    },
  },
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
    // A recipient's letter that was personalised, which Airtable kept.
    personalised: "personalised",
  },
  // A mailing's editor: the letter, with merge fields and parts only some recipients get.
  mailingEditor: {
    // Bold, italic, links, bullets and quotes, as in a supporter's letter.
    ...letterEditorCopy,
    // The toolbar over the letter, for screen readers.
    formatting: "Formatting",
    // Over the merge fields beside the letter, to click or drag in.
    fieldsHeading: "Fields",
    // On hovering a field or a condition beside the letter.
    dragHint: "Click to insert it where the cursor is, or drag it to where you want in the letter",
    // On hovering a field some recipients have no value for, which can't be used.
    lacking: (n: number) => `${count(n, "recipient has", "recipients have")} none, so it can't be used`,
    // Over the two menus of who a part of the letter is for.
    partsHeading: "Conditional parts",
    // The menu that puts the paragraphs at the cursor in a part only those who gave an answer get.
    addOnlyFor: "+ Only for those who…",
    // The menu that puts them in a part everyone but those who gave an answer gets.
    except: "Except those who…",
    // In the menu of an ask's answers, back to the asks.
    backToAsks: "‹ Asks",
    // Instead of them, when no recipient has answered an ask.
    noConditions: "None available, because no recipient has answered an ask.",
    // After each: how many recipients gave that answer.
    covers: (n: number) => `${n}`,
    // On the box round such a part: who gets it.
    onlyForLabel: (who: string) => `Only for those who ${who}`,
    // On the box round a part all but some get: who doesn't.
    exceptLabel: (who: string) => `Except those who ${who}`,
    // Takes the part at the cursor out of its box, so everyone gets it.
    forEveryone: "For everyone",
    // The menu typing { opens, of the merge fields.
    pickField: "Insert a field",
    // Each merge field of a mailing to politicians, as its chip says it.
    fields: {
      salutation: "Salutation",
      name: "Name",
      constituency: "Constituency",
      party: "Party",
      house: "House",
    },
    // Who a part is for: those who gave an answer to an ask, after "Only for those who", as in
    // "Only for those who signed the Frontier AI letter". Each answer's words, then the ask's title.
    answerWords: {
      signed: "signed",
      going: "are going to",
      other: "gave another answer to",
      declined: "declined",
    } as Record<string, string>,
    answered: (words: string, ask: string) => `${words} ${ask}`,
  },
  // The pages for broadcasts, emails and texts to supporters: from the supporters list, the writer, the list of them
  // and each one's page; each supporter's copy of one is a message.
  // How a copy of something sent to many went, a broadcast's to a supporter or a letter to a politician, in states
  // (lib/copy-states.ts; docs/domain-concepts.md, "How a copy went"). Each is one colour: red bad, amber sad, green
  // good, blue for staff to do, grey normal.
  copyStates: {
    // Over its recipients, how many are in each state, and the heading over those a count lists.
    counts: {
      sent: "sent",
      delivered: "delivered",
      read: "read",
      replied: "replied",
      answered: "answered",
      look: "to check",
      "opted-out": "opted out",
      spam: "marked spam",
      error: "error",
      unreached: "didn't reach",
      "not-sent": "not sent",
    } as Record<string, string>,
    tabs: {
      sent: "Sent",
      delivered: "Delivered",
      read: "Read",
      replied: "Replied",
      answered: "Answered",
      look: "Replies to check",
      "opted-out": "Opted out because of this",
      spam: "Marked as spam",
      error: "Something went wrong",
      unreached: "Didn't reach them",
      "not-sent": "Not sent",
    } as Record<string, string>,
    // On its page, its counts in two groups, each under its total: those that went, and those that didn't.
    groups: { went: "went", gone: "didn't go" },
    // In a list, after the counts that need a look, the rest folded behind how many are fine; or all.
    andFine: (n: number) => `and ${n.toLocaleString("en-GB")} fine`,
    allFine: (n: number) => `all ${n.toLocaleString("en-GB")} fine`,
    // A recipient's one tag: its state, and why, by state and why (state:why), or its state alone.
    tags: {
      queued: "Queued",
      scheduled: "Scheduled",
      sending: "Sending",
      sent: "Sent",
      // A letter that only an automatic reply has come back to, such as an out-of-office.
      "sent:auto-reply": "Sent: auto-reply",
      delivered: "Delivered",
      read: "Read",
      replied: "Replied",
      answered: "Answered",
      look: "To check: replied",
      "opted-out": "Opted out",
      "opted-out:whatsapp-reply": "Opted out: replied “stop”",
      "opted-out:postmark-complaint": "Opted out: marked as spam",
      "opted-out:link": "Opted out: unsubscribe link",
      "opted-out:list-unsubscribe": "Opted out: unsubscribe link",
      "opted-out:reply": "Opted out: by reply",
      // A politician's office marked our letter as spam.
      spam: "Marked spam",
      error: "Error",
      "error:gmail": "Error: Gmail refused it",
      "error:postmark": "Error: Postmark refused it",
      "error:whatsapp": "Error: WhatsApp refused it",
      "error:unfinished": "Error: send cut off",
      "error:limit": "Error: out of time",
      "error:civicrm": "Error: CiviCRM down",
      "error:pull": "Error: CiviCRM down",
      "error:template": "Error: template paused",
      "error:late": "Error: out of time, CiviCRM down",
      "error:failing": "Error: sending kept failing",
      "unreached:bounced": "Didn't reach: bounced",
      "unreached:not-on-whatsapp": "Didn't reach: not on WhatsApp",
      "not-sent": "Not sent",
      "not-sent:cancelled": "Not sent: we cancelled",
      "not-sent:unsubscribed": "Not sent: opted out before",
      "not-sent:whatsapp": "Not sent: opted out before, in WhatsApp",
      "not-sent:no-permission": "Not sent: consent ended",
      "not-sent:suppressed": "Not sent: PauseAI Global",
      "not-sent:blocked": "Not sent: address blocked",
      "not-sent:not-on-whatsapp": "Not sent: not on WhatsApp",
      // A mailing's letter to a politician who has left office, or has no address we know.
      "not-sent:left-office": "Not sent: left office",
      "not-sent:no-email": "Not sent: no email address",
    } as Record<string, string>,
  },
  broadcastPages: {
    title: "Broadcasts",
    intro: "Bulk emails and texts PauseAI sends to supporters",
    none: "No broadcasts yet.",
    untitled: "Untitled draft",
    // A draft's step of the trail above its page, as its title changes while it's written.
    draftCrumb: "Draft",
    // In the supporters list's count row.
    broadcastButton: (n: number) => `Broadcast to ${count(n, "supporter", "supporters")}`,
    // Change who: the supporters list choosing who a draft goes to.
    choosing: (title: string) => `Change who the broadcast “${title}” goes to`,
    choosingHow: "Change the filters. The broadcast goes to everyone they find at the time it is actually sent.",
    choosingCancel: "Cancel",
    // Over the broadcast's first choice, by email or by text, before its topics.
    consentChannel: "Email or text",
    // Hovering the Consent's chip while choosing who a broadcast goes to, where it can't be changed.
    consentLocked: "To change the consent, go back to the broadcast page.",
    // The same, for a draft with nothing written yet, as from New broadcast.
    choosingNew: "Choose who the new broadcast goes to",
    choosingCount: (n: number) => `${count(n, "supporter", "supporters")} found`,
    choosingLabel: "Who the broadcast goes to",
    useThese: (n: number) => `Use these ${n}`,
    // A broadcast's channel, as a pill, a list's row and the band say it.
    channels: { email: "Email", text: "Text" },
    newTitle: { email: "New broadcast", text: "New broadcast" },
    // At the top right of the broadcasts page: to the supporters list, to choose who first.
    newBroadcast: "New broadcast",
    // What's filled in for those without a field, and the fields as the editor and the preview say them.
    fallbacks: { firstName: "there", name: "friend" },
    // Each field, as its lozenge in the editor, a template's row and a title say it.
    fieldWords: { firstName: "First name", name: "Name" },
    greeting: "Hi",
    // A new email's lines at its end, a few lines under the greeting.
    signature: ["Best wishes,", "PauseAI UK"],
    // What a part can be only for, as the editor's menus and the preview's case buttons say it.
    conditions: {
      // A part for those who wrote to their MP in a campaign, its menu's group, then each campaign by its title.
      wroteGroup: "Wrote to their MP",
      wrote: (campaign: string) => `wrote to their MP in “${campaign}”`,
      // A part for those who registered for an event, past or to come, its menu's group, then each event.
      registeredGroup: "Registered for",
      registered: (event: string) => `registered for “${event}”`,
    },
    // The preview's buttons, of the one made-up recipient: each field they have; a part's own words say the rest.
    previewCases: {
      "has:firstName": "has a first name",
      "has:name": "has a name",
    } as Record<string, string>,
    // The numbered sections of a draft.
    sections: { who: "To", write: "Write", preview: "Preview", from: "Sent from", when: "When", send: "Send" },
    willGet: (n: number, channel: "email" | "text") =>
      `${count(n, "supporter", "supporters")} will be ${channel === "email" ? "emailed" : "texted"}.`,
    // Write.
    subject: "Subject",
    emailLabel: "Email",
    files: "Attachments",
    // The dropdown of a text's words: its label, and its first choice till one's made.
    templateLabel: "Template",
    pickTemplate: "Choose a template",
    // Under the approved ones, past a rule: new words, to send for approval.
    newTemplate: "New template",
    templateMadeIn: "Made in WhatsApp Manager",
    templateBy: (name: string, approved: string, used: string) => `${name}, approved ${approved}, ${used}`,
    templateNeverUsed: "never used",
    templateUsed: (at: string, n: number) => `last used ${at}, to ${count(n, "person", "people")}`,
    newTemplateHint: "WhatsApp needs to approve the new template before it can go. This takes up to 24 hours.",
    // As the email of it says it (notifications.templateRejected).
    rejected: (reason: string) =>
      `WhatsApp rejected the template with ${reason} Change the message and send for approval again.`,
    // Preview.
    chooseTemplate: "Choose a template to see the text here.",
    findRecipient: "Show a fake recipient who…",
    testTo: "Send a test copy to",
    sendTest: "Send test",
    testVia: {
      email: (address: string) => `Sends from ${address} via Postmark.`,
      emailGmail: (gmail: string) => `Sends from ${gmail}'s Gmail, so copies also show in Sent.`,
      text: (number: string) => `Sends from ${number} via WhatsApp.`,
      textNew: "A test copy can only be sent after WhatsApp has approved the template.",
      textOff: "You can't send test texts, as WhatsApp isn't configured yet.",
    },
    testSent: (to: string) => `Sent to ${to}.`,
    testFailed: "Couldn't send the test copy.",
    // From.
    // Each address an email can go from, with what sends it: Postmark, or a staff member's Gmail.
    // The choice of what sends an email, from the one address it's from: each as "address, by what", one that
    // can't be chosen yet greyed out.
    fromAccount: "Account",
    fromOption: (address: string, backend: string) => `${address}, by ${backend}`,
    sendBy: {
      names: { gmail: "Gmail", postmark: "Postmark" },
      // Under the choice, by Gmail: how many more its account can send today, and how long this one would take.
      room: (address: string, remaining: number, days: number) =>
        days === 1
          ? `${address} can send ${remaining.toLocaleString("en-GB")} more emails today, enough for this broadcast.`
          : `${address} can send ${remaining.toLocaleString("en-GB")} more emails today, so this broadcast will take ${days} days.`,
      notConnected: (address: string) => `${address}'s Gmail isn't connected. Log in as ${address} to connect it.`,
    },
    fromName: "Name",
    noNumber: "No WhatsApp number is configured yet",
    // Under a text's number: how many more people it can text today, by Meta's daily limit, and how long this one
    // would take; null for no limit.
    textRoom: (remaining: number | null, days: number) =>
      remaining === null
        ? "Our WhatsApp number has no daily limit, so this will go in one go."
        : days === 1
          ? `Our WhatsApp number can text ${remaining.toLocaleString("en-GB")} more people today, enough for this broadcast.`
          : `Our WhatsApp number can text ${remaining.toLocaleString("en-GB")} more people today, so this broadcast will take ${days} days.`,
    // What a text goes by, after our number, as an email's address has Gmail or Postmark.
    textBy: "WhatsApp",
    // Send.
    cost: {
      text: (pounds: string) => `About £${pounds}`,
      // After it, smaller and grey: the rate it's worked out at, and since when, as it may have changed.
      textRate: (pence: number, from: string) => `${pence}p each, rate as at ${from}`,
    },
    // What will go, as facts with their labels: how many, from whom and how, when, and a text's cost. A mailing
    // to politicians' Send says the same.
    sendFacts: {
      what: "Sends",
      count: (n: number, channel: "email" | "text") =>
        channel === "email" ? count(n, "email", "emails") : count(n, "text", "texts"),
      from: "From",
      // A mailing's, before its Gmail is chosen.
      noSender: "No account chosen yet",
      // What sends it: Gmail, Postmark or WhatsApp.
      via: "Via",
      // On a sent one's page, under who it's from, after their name: what sends it (Gmail, Postmark or WhatsApp).
      viaDetail: (name: string) => `via ${name}`,
      whatsApp: "WhatsApp",
      when: "When",
      noTime: "No time chosen yet",
      cost: "Cost",
    },
    schedule: (n: number, channel: "email" | "text") =>
      `Schedule ${channel === "email" ? count(n, "email", "emails") : count(n, "text", "texts")}`,
    // At the foot of a text on new words: sending them to WhatsApp, and while it reviews them.
    submitTemplate: "Send for approval",
    // In a red alert under it, when the template didn't go: WhatsApp refused it, with its reason if it gave one, …
    submitFailed: (reason: string | null) =>
      reason
        ? // Its reason ends its sentence, inside the quotes, with one full stop whether WhatsApp's has one or not.
          `WhatsApp refused the template, saying “${reason.replace(/\.+$/, "")}.” Change it and send it again.`
        : "WhatsApp didn't take the template. Try again soon.",
    // … the site refused it, …
    submitRefused: {
      "no-words": "The template is empty, so it wasn't sent for approval.",
      "not-ready": "Something has changed under my feet. Reload the page to see what needs fixing.",
      already: "This template is already with WhatsApp. Reload the page to see it.",
      "not-text": "This broadcast is an email, so it has no template to approve.",
      "not-draft": "This text isn't a draft any more. Reload the page to see what it is now.",
      gone: "This draft broadcast has been deleted.",
    },
    // … or something broke.
    submitBroke: "Something went wrong on our side, and the template wasn't sent for approval. Try again soon.",
    // Over new words, what they're called in the list of templates, and the heading over the words.
    templateName: "Template name",
    templateWords: "Message",
    // Under the dropdown, for new words WhatsApp is reviewing: who sent them, and when, as an approved template's line says.
    templatePending: (by: string, at: string) => `${by}, approval requested ${at}, withdraw request to change`,
    // At the top of a draft whose words WhatsApp is reviewing, in amber, as the words are locked till it decides.
    awaitingApproval: (by: string, at: string) =>
      `${by} sent the template to WhatsApp for approval on ${at}. It can't be changed or scheduled until WhatsApp decides.`,
    withdrawTemplate: "Withdraw approval request",
    // The same, pressed once, asking for a second press.
    withdrawSure: "Withdraw it",
    problems: {
      // Before a Consent by the channel picked is chosen, first of what stops it.
      "no-consent": "Choose a Consent first.",
      "unknown-filter": "The filter has values that have changed or are no longer supported.",
      "no-recipients": "There's nobody to send to.",
      "no-subject": "Fill in the subject.",
      "no-letter": "Write the email.",
      "no-template": "Choose a template.",
      "no-name": "Give the template a name.",
      "field-edge": "WhatsApp templates can't have a field at the very start or end.",
      "fields-together": "WhatsApp templates can't have two fields next to each other.",
      "field-twice": "WhatsApp templates can't use the same field twice.",
      "not-approved": "WhatsApp needs to approve the template first. This can take 24 hours.",
      "not-connected": "The Gmail inbox it's sent from isn't connected.",
      "too-slow": `That's too many to send in ${daysInWords(SENDING_DAYS)}. Send it to fewer people.`,
      "no-number": "No WhatsApp number is configured, so texts can't be sent.",
      "no-time": "Choose what time it will be sent.",
      "time-passed": "You can't send it into the past!",
      "cannot-send": "Sending isn't built yet.",
    } as Record<string, string>,
    // Its page.
    scheduledLine: (n: number, channel: "email" | "text", from: string) =>
      `${channel === "email" ? count(n, "email", "emails") : count(n, "text", "texts")} from ${from}.`,
    textTitle: "The text",
    emailTitle: "The email",
    // In the list of broadcasts, where each stands, where a broadcast has more to say than a mailing
    // (mailingPages.standing), as a sentence after a dot in its colour: its words with WhatsApp or rejected by it,
    // stopped by itself and why.
    standing: {
      waiting: "Waiting for WhatsApp to approve its template",
      rejected: "WhatsApp rejected its template",
      gaveUp: {
        limit: (n: number, of: number) =>
          `Ran out of time after ${n.toLocaleString("en-GB")} of ${of.toLocaleString("en-GB")}`,
        civicrm: (n: number, of: number) =>
          `CiviCRM was down: stopped after ${n.toLocaleString("en-GB")} of ${of.toLocaleString("en-GB")}`,
        pull: (n: number, of: number) =>
          `CiviCRM was down: stopped after ${n.toLocaleString("en-GB")} of ${of.toLocaleString("en-GB")}`,
        template: (n: number, of: number) =>
          `WhatsApp paused its template: stopped after ${n.toLocaleString("en-GB")} of ${of.toLocaleString("en-GB")}`,
        late: (n: number, of: number) =>
          `CiviCRM was down when its time ran out: stopped after ${n.toLocaleString("en-GB")} of ${of.toLocaleString("en-GB")}`,
        failing: (n: number, of: number) =>
          `Kept failing to send: stopped after ${n.toLocaleString("en-GB")} of ${of.toLocaleString("en-GB")}`,
      } as Record<string, (n: number, of: number) => string>,
    },
    // A reply under our email on its Thread: what staff can record it as, and what they did.
    replies: {
      topics: (topics: string) => `${topics} (this email)`,
      bulk: "All bulk email",
      nothing: "Nothing to do",
      // In a copy's history, under Recorded as an opt-out: How they told us (recordOptOut.how), and this.
      how: "By replying to this email",
      // Answering a reply: the folded draft at the foot of the thread, the draft opened, and why one didn't go.
      reply: "Reply",
      answerLabel: "Your reply",
      send: "Send reply",
      sending: "Sending…",
      discard: "Discard",
      // Over the draft, to someone with "Do not email": it goes all the same, as it answers them.
      doNotEmail: "They've opted out of all email. Only answer what they asked.",
      notSent: {
        blank: "The reply is empty.",
        gone: "Their reply has been deleted, so this can't answer it.",
        blocked: "Not sent: their address is blocked, as email to it bounced or they marked ours as spam.",
        failed: "Error sending via Gmail. Try again, or reply in Gmail itself.",
        window: "Not sent: it's more than a day since their messge, so WhatsApp won't let us reply.",
      },
      // Our answer in the thread: who sent it; one whose sending never finished.
      sentBy: (by: string) => `Sent by ${by}`,
      stillSending: (account: string) => `Unsure if this sent. Check ${account}'s Sent folder in Gmail.`,
      optedOut: (by: string, when: string) => `Recorded as an opt-out by ${by}, ${when}`,
      // The site's own: its answer to a STOP, the STOP recorded as an opt-out, and who in the history.
      sentAutomatically: "Sent automatically",
      optedOutAutomatically: (when: string) => `Recorded as an opt-out automatically, ${when}`,
      automatically: "Automatically",
      nothingDone: (by: string, when: string) => `Nothing to do, said ${by}, ${when}`,
      // In its history.
      // Each with who, on a line under it.
      historyOptedOut: "Recorded as an opt-out",
      historyNothing: "Marked as nothing to do",
      historyAnswered: "Answered",
      noText: "No text to show. Open it in Gmail.",
      // A reply to a text with no words, such as a photo or a voice note, which only WhatsApp shows: what it is.
      notWords: (type: string) => `[A ${type} message, which only the WhatsApp app shows]`,
      // For a reply to a text: an opt-out of every text, in place of all bulk email; how they told us.
      allTexts: "Every text",
      topicsText: (topics: string) => `${topics} (this text)`,
      howText: "By replying to this text",
      // A text's reply can be answered in WhatsApp only within a day of it.
      windowClosed: "It's more than a day since their message, so WhatsApp won't let us reply.",
    },
    // A broadcast that can't go yet, on its page: CiviCRM didn't answer its check, or no pull has finished for a day.
    waiting: (reason: "civicrm" | "pull", stops: string) =>
      reason === "civicrm"
        ? `Waiting for CiviCRM to work again, so can check live suppression. This will send once it does, or give up on ${stops}.`
        : `Waiting for an import from CiviCRM, so can check live suppression. This will send once one finishes, or give up on ${stops}.`,
    // Where a scheduled broadcast says when it sends, while it waits for CiviCRM, past its time.
    waitingDue: "Waiting for CiviCRM",
    gaveUp: `Stopped after ${daysInWords(WAIT_DAYS)}, as CiviCRM couldn't be reached.`,
    // Beside either: sets it going again, to those it didn't reach.
    resume: RESUME_SENDING,
    // The same, for one a day's limit of emails left too slow.
    gaveUpLimit: `Stopped after ${daysInWords(SENDING_DAYS)}, before everyone got it.`,
    // The same, for a text whose template WhatsApp paused or disabled, for its quality.
    gaveUpTemplate: "Stopped, as WhatsApp paused or disabled the template it used.",
    // The same, for one whose days ran out while it waited for CiviCRM.
    gaveUpLate: `Stopped after ${daysInWords(SENDING_DAYS)}, as CiviCRM was down when they ran out.`,
    // The same, for one so many of whose copies failed one after another that it stopped (FAILURES_TO_STOP).
    gaveUpFailing: `Stopped, as the last ${FAILURES_TO_STOP} emails or texts it tried all failed. Each one's page says why.`,
    // On one sending that has paused after its sends failed, or what sends it couldn't for now, till when it tries again.
    resting: (until: string) => `Paused, as sending failed. It will try again at ${until}.`,
    // On one sending by Gmail that can send no more today, under the bar that says how far it's got.
    moreTomorrow: "Gmail has reached today's limit. The rest will be sent tomorrow.",
    recipientsTitle: "Recipients",
    recipientsCount: (n: number) => count(n, "recipient", "recipients"),
    noRecipients: "No recipients here.",
    // In place of the recipients of one scheduled, as sending finds them.
    recipientsNow: "Who it would go to if sent now. May change by the time it is sent.",
    columns: { who: "Supporter", status: "Status" },
    erased: "Erased supporter",
    threadLink: "Thread →",
    // Thread: one copy's page, titled as a letter's is.
    copyTitle: (channel: "email" | "text", to: string) => `${copyKind(channel)} from PauseAI UK to ${to}`,
    // Its own step of the trail above its page, after the broadcast: the title's first word.
    copyCrumb: copyKind,
    // Its history: each thing its provider reported.
    events: {
      sent: "Sent",
      delivered: "Delivered",
      read: "Read",
      failed: "Failed",
      bounced: "Bounced",
      "opted-out": "Stopped",
      replied: "Replied",
    },
    facts: {
      from: "From",
      // What everyone a broadcast is to said yes to: its channel and topic, from the Consent filter.
      saidYes: "Said yes to",
      // The rest of the list's filters, narrowing those who said yes.
      onlyThose: "Only those",
    },
    // In To, when Consent is the only filter.
    everyoneWhoSaidYes: "Everyone who said yes",
    // Beside it, to the supporters list to filter them; once filtered, the mailings' "Change who".
    narrowDown: "Narrow down",
    threadTitle: "Thread",
    // Over a copy that never reached them, the message as it would have looked: refused as it was sent, by what
    // sends it (Gmail, Postmark or WhatsApp); skipped or stopped first; or not gone yet.
    notReached: {
      refused: (by: string) => `${by} refused to send this.`,
      // With why, as its lozenge says it: skipped for each reason, or the broadcast stopped first.
      never: (why: string) => `This never went to them, as ${why}.`,
      why: {
        blocked: "their address is blocked",
        unsubscribed: "they asked us to stop",
        "no-permission": "their consent ended",
        "not-on-whatsapp": "they're not on WhatsApp",
        suppressed: "PauseAI Global says not to email them",
        cancelled: "we stopped the broadcast",
        // Its broadcast stopped by itself.
        limit: `the broadcast's ${daysInWords(SENDING_DAYS)} ran out`,
        civicrm: `CiviCRM was down for ${daysInWords(WAIT_DAYS)}`,
        pull: `CiviCRM was down for ${daysInWords(WAIT_DAYS)}`,
        template: "WhatsApp paused the template",
        late: `the broadcast's ${daysInWords(SENDING_DAYS)} ran out while CiviCRM was down`,
        failing: "the broadcast stopped after its sending kept failing",
      } as Record<string, string>,
      notYet: "The broadcast is still sending, so this hasn't gone yet.",
    },
    headers: { from: "From", to: "To" },
    // A supporter's page.
    supporterTitle: "Broadcasts",
    supporterNone: "No broadcasts sent to them.",
    supporterColumns: { message: "Broadcast", status: "Status" },
  },

  // The pages for writing a mailing, its own page once it's scheduled, and the list of them.
  mailingPages: {
    // Who a mailing is to, when its filter has nothing chosen.
    everyone: "Every politician in office",
    whoLabel: "Who it's for",
    // A search, as a pill of who a mailing is to.
    searchPill: (typed: string) => `Search "${typed}"`,
    // A new mailing's page's title, and the button that starts an empty one: on the mailings page, and on the politicians list with no filter.
    newTitle: "New mailing",
    // On the politicians list with a filter: the button that starts one to everyone it finds.
    mailThese: (n: number) => plural(n, "Mail this one…", `Mail these ${n}…`),
    // A draft with no subject yet, in the list and as its page's title.
    untitled: "Untitled draft",
    // A draft's step of the trail above its page, as its title changes while it's written.
    draftCrumb: "Draft",
    // At the top of a new mailing, until a channel sends.
    cantSend: "Mailings can't be sent yet. Everything else should work, and you can send a test copy to yourself.",
    // Beside the title: whether the draft is saved.
    saveStates: {
      conflict:
        "Sorry! Someone else has changed this draft since you opened it, so what you've done hasn't been saved. Reload the page to see their changes.",
    } as Record<string, string>,
    // In the window's corner, whether the draft is saved.
    savePill: {
      saving: "Saving…",
      saved: "Saved",
      failed: "Couldn't save. Make another change to try saving again.",
      conflict: "Not saved because someone else changed the same draft!",
    } as Record<string, string>,
    deleteDraft: "Delete draft",
    // The numbered sections of a new mailing.
    sections: {
      who: "Who",
      write: "Write",
      preview: "Preview",
      from: "Sent from",
      when: "When",
      send: "Send",
    },
    willGet: (n: number) => `${count(n, "politician", "politicians")} will be emailed.`,
    // Who's left out: each part only when there are some.
    // Of those ticked, or for a mailing from before ticks, those its filter found.
    leftOut: (found: number, noAddress: number, blocked: number, ticked = false) =>
      `${ticked ? `Of the ${found} ticked` : `Of the ${count(found, "person", "people")} the filter found`}, ${[
        noAddress && `${count(noAddress, "has", "have")} no email address`,
        blocked && count(blocked, "has an address that's blocked", "have addresses that are blocked"),
      ]
        .filter(Boolean)
        .join(" and ")}, so they'll be left out.`,
    leftOutReasons: {
      "no-address": "no email address",
      blocked: "address blocked",
    } as Record<string, string>,
    changeWho: "Change who",
    // The same, while no one's ticked yet.
    chooseWho: "Choose who",
    unknownFilter: (values: string) =>
      `The saved filter has values that are no longer supported (${values}), you need to change it before carrying on.`,
    subject: "Subject",
    ask: "Ask",
    // Under the ask: a link to the asks page's form, which comes back here.
    newAsk: "Add a new ask",
    // Behind the ? beside Ask.
    askHelpLabel: "Help about what an ask is",
    askHelp:
      "What this mailing asks the recipients to do, such as come to an event or sign a letter. These are recorded either manually by staff, or with an import job.",
    // The start of a new letter, before the salutation or name.
    greeting: "Dear",
    noAsk: "None",
    letter: "Letter",
    attachments: "Attachments",
    addFiles: "Add files",
    dropFiles: "Drop files here, or",
    // A file's size.
    bytes: (n: number) => `${n} bytes`,
    kilobytes: (n: number) => `${n} KB`,
    megabytes: (n: number) => `${n} MB`,
    removeFile: (name: string) => `Remove ${name}`,
    tooBig: "That file is too big - a file can be up to 4MB.",
    // When uploading a file fails, such as the connection dropping.
    attachFailed: "That file couldn't be added. Try again.",
    // Over the preview: before a button for each condition the letter's parts use, then over the choice of whose email it shows.
    findRecipient: "Find recipient who:",
    chooseRecipient: "Choose recipient:",
    noOne: "There are no recipients to choose from.",
    to: "To",
    noSender: "Choose who below",
    // When no recipient has the answers chosen.
    noOneMix: "No preview, because none of the recipients match the answers you picked above.",
    // The test copy: the address it goes to, yours to start with, and the button.
    sendTestTo: "Send a test copy to",
    sendTest: "Send test",
    // Under it: how the test copy goes, so you know where to look for it.
    testVia: (gmail: string | null) =>
      gmail
        ? `Sends from ${gmail}'s Gmail, so copies also show in Sent.`
        : "Sends from our own mail service, so it won't be in any Gmail's Sent.",
    testSent: (address: string) => `Sent to ${address}.`,
    testFailed: "It couldn't be sent. Try again in a minute.",
    // The first entry of a list while nothing in it is chosen.
    choose: "Choose…",
    fromLegend: "Account",
    fromNameLabel: "Name",
    // A sender, in Sent from's list: their address, and how many more it can send today.
    // Your own address, before your Gmail's connected.
    senderNotConnected: (address: string) => `${address} (not connected)`,
    notConnected: "This Gmail isn't connected. Only its owner can connect it, from their own page.",
    // With no Gmail connected, in place of the choice of one.
    noSenders: "No Gmail is connected yet, so nothing can be sent.",
    // Under the choice of Gmail while yours isn't connected, to your account page, where it's connected.
    connectOne: "Add your Gmail",
    // In the preview, who it's from: the name comes from the Gmail account.
    from: "From",
    // The test copy's sender's name.
    testFromName: "PauseAI UK mailing test",
    day: "Day",
    hour: "Hour",
    // Beside the hour: the minutes past it the sending runs at, ":03", ":18", ":33" and ":48".
    minutes: "Minutes",
    schedule: (n: number) => `Schedule ${count(n, "email", "emails")}`,
    // Why the schedule button can't be pressed.
    problems: {
      "unknown-filter": "The filter has values that have changed or are no longer supported.",
      "no-recipients": "There's nobody to send to.",
      "no-subject": "Fill in the subject.",
      "no-letter": "Write the letter.",
      "field-lacking": "It uses a field some recipients have no value for.",
      "no-sender": "Choose who to send the message from.",
      "not-connected": "The Gmail you've chosen to send from isn't connected.",
      "too-many": "This mailing is to more people than one Gmail can send to in a day.",
      "no-time": "Choose what time it will be sent.",
      "time-passed": "You can't send it into the past!",
      "cannot-send": "Sending isn't built yet.",
    } as Record<string, string>,
    // The list of mailings: the heading over those not sent yet.
    comingUp: "Coming up",
    // Choosing who a mailing is for on the politicians list: at the top, for a new mailing or for a draft named by its title,
    // and under that what to do.
    choosingNew: "Choose who the new mailing goes to",
    choosingDraft: (title: string) => `Change who the mailing “${title}” goes to`,
    // What to do, for a draft and for a new mailing. Not on a phone, where the title is enough.
    choosingHow: "Tick each person it's for. The mailing is immediately updated as you tick.",
    choosingHowNew: "Tick each person it's for. Then press the “Write to these” button.",
    // Beside it, for a new mailing: deleting it.
    cancelNew: "Cancel",
    backToDraft: "Back to the draft",
    // The tab after the houses, showing only those ticked.
    pickedTab: "Ticked",
    // The tab after it, once names are pasted: who each line found.
    pastedTab: "Paste names",
    // A row's tick box, and the one in the heading that ticks everyone the filters find, on every page.
    tick: (name: string) => `Tick ${name} for the mailing`,
    tickAll: (n: number) => `Tick all ${n} found, on every page`,
    // In the bar at the foot: the button that opens a box for names, one a line, and the box's button.
    pasteNames: "Paste names…",
    pasteLabel: "Paste names, constituencies or emails. You can just copy and paste text from a whole page.",
    pasteTick: "Find these",
    // Under it after a paste, the politicians list's table, a row for each person a line found, with their
    // tick box, and last the reason they're there: by their name, more than one match, or only near it.
    pastedTitle: "Names pasted",
    pastedTickAll: (n: number) => `Tick all ${n} found`,
    pastedFound: "Reason",
    pastedBy: {
      name: "Their name",
      constituency: "Their constituency",
      email: "Their email",
      words: "Part of their name or constituency",
    } as Record<string, string>,
    pastedSome: "More than one match: tick the right one",
    pastedNone: "No exact match: nearest name",
    // Under it: how many lines found no one; or, if none did, that.
    pastedSkipped: (n: number) => `Couldn't find a politician on ${count(n, "line", "lines")}.`,
    pastedNoOne: "None found.",
    // In the bar at the foot of the list: how many are ticked, and the button on to the draft.
    choosingCount: (n: number) => `${n} ticked for the mailing`,
    seeTicked: "See them",
    untickAll: "Clear all ticks",
    noneTicked: "Tick who it's for",
    writeToThese: (n: number) => plural(n, "Write to this one", `Write to these ${n}`),
    // The same, greyed, while no one's ticked.
    writeToNone: "Write to these",
    useThese: (n: number) => plural(n, "Use this one", `Use these ${n}`),
    // Who a mailing's for, when everyone a filter found was ticked: that filter, the day, how many, then those
    // added and taken off since, by name. With more changes than a few, or no such filter, the names ticked.
    pickedFrom: (when: string, n: number) => `as found on ${when} (${n})`,
    pickedPlus: (name: string) => `plus ${name}`,
    pickedExcept: (name: string) => `except ${name}`,
    pickedNone: "No one ticked yet",
    pickedMore: (n: number) => `and ${n} more`,
    // A mailing's own page.
    states: {
      draft: "Draft",
      scheduled: "Scheduled",
      sending: "Sending",
      sent: "Sent",
      cancelled: "Stopped",
    } as Record<string, string>,
    sends: (when: string) => `Sends on ${when}`,
    scheduledLine: (n: number, from: string) => `${count(n, "email", "emails")} from ${from}.`,
    changeTime: "Change the time",
    saveTime: "Change it",
    // Takes a scheduled mailing back to a draft, sending nothing.
    unschedule: "Unschedule",
    stopSending: "Stop sending",
    sentLabel: "Sent",
    // The list of mailings: when a draft was last saved.
    savedAt: (when: string) => `Saved ${when}`,
    // In the list of mailings or broadcasts, where each stands, as a sentence after a dot in its colour: a draft,
    // scheduled, stopped by us, sent.
    standing: {
      draft: (n: number) => `Draft, to ${count(n, "person", "people")}`,
      scheduled: (n: number) => `Scheduled to ${count(n, "person", "people")}`,
      stopped: (n: number, of: number) => `Stopped after ${n.toLocaleString("en-GB")} of ${of.toLocaleString("en-GB")}`,
      sent: (n: number) => `Sent to ${count(n, "person", "people")}`,
    },
    // The bar of how far a mailing sending has got, and once it's sent, how many have answered its ask.
    sendingBar: (n: number, of: number) => `Sending: ${n} of ${of} sent`,
    answeredBar: (n: number, of: number) => `Sent: ✓ ${n} of ${of} answered the ask`,
    // The band at the top of a mailing's page: when it started sending, and who sent it.
    started: "Started",
    by: (who: string) => `by ${who}`,
    // Over a mailing's recipients filtered by one of its counts, back to them all.
    showEveryone: "Show everyone",
    // Each recipient's link to their letter's page, with their replies when there are some.
    letterAndReplies: (n: number) => plural(n, "Letter and reply →", "Letter and replies →"),
    theLetter: "Letter →",
    // In a mailing's email, who it's to: each recipient, as it's a letter to many.
    toEach: "Each recipient, by name and address",
    emailTitle: "The email",
  },
  // The asks page: each ask, its kind and date, and how many gave each answer.
  asks: {
    title: "Asks",
    intro: "What we ask notable people to do, either by writing to them or by meeting them",
    edit: "Edit",
    // The form, adding an ask or editing one; the new one's title is the asks page's button to it, too.
    newTitle: "New ask",
    editTitle: (title: string) => `Edit the ask “${title}”`,
    fields: {
      kind: "We ask them to",
      askedBy: "Who has or will ask them",
    },
    // The rest of the form's fields, by the kind of ask: the title reads on from "sign" or "attend".
    byKind: {
      letter: {
        title: "Which letter",
        titleExample: "Giant pause button funding request to the Chancellor",
        date: "When the letter was started",
        url: "Where to read the letter",
      },
      event: {
        title: "Which event",
        titleExample: "Tea, biscuits and existential risk conference",
        date: "When the event is",
        url: "Where to learn more about the event",
      },
    } as Record<string, { title: string; titleExample: string; date: string; url: string }>,
    // Under the link, in red, while what's in it isn't a whole one.
    badLink: "Give a full link beginning https://",
    // Over an ask's slug, which doesn't change.
    slugLabel: "Identifier: ",
    kindFixed: askLimits.kindFixed,
    named: askLimits.named,
    // Beside the form: the ask as it will show on a politician's page.
    previewTitle: "What the ask will look like on a politician's page",
    save: "Save ask",
    delete: "Delete ask",
    notDeletable: askLimits.notDeletable,
    // After saving or deleting, or failing to.
    notices: {
      added: "Ask added.",
      saved: "Ask saved.",
      deleted: "Ask deleted.",
      // The same as the form says, when a save or a delete is refused for it.
      named: askLimits.named,
      "kind-in-use": askLimits.kindFixed,
      "in-use": askLimits.notDeletable,
      gone: "That ask has been deleted.",
    } as Record<string, string>,
    none: "No asks yet.",
    // Over the list's upcoming events; the rest go under their months and years.
    comingUp: "Coming up",
    kinds: { letter: "Sign a letter", event: "Attend an event" } as Record<string, string>,
    // Over a mailing's or campaign's ask, and before it on their lists.
    askTo: { letter: "Ask to sign", event: "Ask to attend" } as Record<string, string>,
    noAsk: "No ask",
    // An ask's own page.
    page: {
      asked: "Asked",
      when: "When",
      on: "On",
      readIt: { letter: "Read it", event: "Find out more" } as Record<string, string>,
      theLink: { letter: "The letter", event: "The event" } as Record<string, string>,
      writtenTo: "written to",
      lettersWord: (n: number) => plural(n, "letter", "letters"),
      replied: "replies",
      howWeAsked: "How we asked",
      answersTitle: "Answers",
      // Pressing the answer chosen goes back to all its columns.
      showAll: "Show all the answers",
      // The column of the "other" answers, each tagged with its note.
      otherAnswers: "Other answers",
      // At the foot of a column with more people than it shows.
      allOf: (n: number) => `All ${n.toLocaleString("en-GB")} →`,
      none: "No answers yet.",
      noWay: "No mailing or campaign has put this.",
      politician: "Politician",
      answer: "Answer",
      lastWrittenTo: "Last written to",
      // Under the answers: leads to the politicians list, filtered to those who answered this ask.
      everyone: "All answers in Politicians →",
      letters: (n: number) => count(n, "letter", "letters"),
    },
    askedBy: { supporters: "Supporters", pauseai: "PauseAI", controlai: "ControlAI" },
    // Over the campaigns and mailings that asked it, on the list of asks.
    waysOf: { campaign: "Supporter campaigns", mailing: "PauseAI mailings" },
    noAnswers: "No answers yet",
  },
  // The pages of blocked addresses (/staff/politicians/addresses-to-fix and
  // /staff/supporters/bounced-emails), and the bounces and complaints that blocked them. Each page's title and
  // intro are its feature's: politiciansCopy.addressesToFix and supportersCopy.bouncedEmails.
  emails: {
    // Over the list: how many are blocked, of those the filters find.
    count: (n: number) => `${n} blocked ${plural(n, "address", "addresses")}`,
    // Instead of the table, when no address is blocked, or none of the cause filtered for.
    noBlocks: "No addresses are blocked.",
    // Instead of the history, when nothing has bounced or been complained about.
    noProblems: "Nothing has bounced or been marked as spam.",
    // After a reason, as a lozenge, who told us: a bounce found in someone's Gmail, Postmark, or CiviCRM, for a hold.
    from: { gmail: "Gmail", postmark: "Postmark", civicrm: "CiviCRM" },
    // The Cause: what happened, whoever told us, as the lozenge after the reason says who. A hold is CiviCRM's, which
    // gives no reason, though it's usually bounces.
    kinds: {
      hard: "Bounced, for good",
      soft: "Bounced, for now",
      complaint: "Marked as spam",
      hold: "“On hold” in CiviCRM",
    } as Record<string, string>,
    // The reason kept for a hold, as CiviCRM gives none.
    holdReason: "Usually as its emails to it bounced",
    columns: {
      address: "Address",
      kind: "Cause",
      since: "Since",
      reason: "Reason",
      whose: "Whose",
      refused: "Not sent since",
      at: "When",
      // What the email that bounced was, a letter or one of ours.
      sent: "Type of email",
    },
    // The email was a letter: before the name of the politician it was to, the two linked to the letter.
    letterTo: "Letter to",
    // Instead of the type, for an email the site has no record of sending.
    notRecorded: "Not recorded",
    purposes: {
      letter: "Letter",
      "forwarded-reply": "Forwarded reply",
      "staff-login": "Staff login link",
      "staff-alert": "Staff alert",
      mailing: "Mailing",
      "mailing-test": "Test copy of a mailing",
    } as Record<string, string>,
    // A complaint can't be undone by staff, only by the person.
    cantReset: "Can't be unblocked: they marked our email as spam.",
    // In the unblock form's field, and its name: the note for the audit log. In a row's bubble, the label over the field.
    note: "Why unblock it?",
    unblock: "Unblock",
    // A row's button in a list of blocked addresses, which opens the bubble that asks why; and the button that closes it.
    unblockOpen: "Unblock…",
    cancel: "Cancel",
    problemsTitle: "History",
  },
  // The email staff get when a letter hard-bounces or is complained about.
  // Postmark's reason sometimes ends in a full stop and sometimes doesn't.
  alert: {
    subject: (mp: string) => `A letter to ${mp} bounced`,
    // The mail server's reason quoted after its own sentence, and the link on a line of its own; then, for a
    // bounce read from a Gmail mailbox, a link to it there.
    body: (mp: string, address: string, reason: string, link: string, bounce?: string) =>
      `A letter to ${mp} (${address}) didn't arrive. The mail server said: “${reason.replace(/\.+$/, "")}.”\n\nNothing more will be sent to that address until it's unblocked here:\n${link}${bounceLine(bounce)}`,
    // An email to an MP that wasn't a letter or a relay, or one the site can't place.
    notALetter: {
      subject: (mp: string) => `An email to ${mp} bounced`,
      body: (mp: string, address: string, reason: string, link: string, bounce?: string) =>
        `An email to ${mp} (${address}) didn't arrive. The mail server said: “${reason.replace(/\.+$/, "")}.”\n\nNothing more will be sent to that address until it's unblocked here:\n${link}${bounceLine(bounce)}`,
    },
  },
  // The web imports on the Scheduled jobs page: ControlAI's
  // letter to the PM, copied nightly into the bill's statuses
  // (lib/server/controlai-import.ts).
  controlAi: {
    title: "ControlAI letter to the Prime Minister backing the Sobel bill",
    intro: {
      before: "Imports the MPs and peers who signed ",
      link: "the letter",
      after: ", marking them as having signed “",
    },
    // The ask they're marked as having signed, linked to its page; the quotes around it aren't.
    introThen: { link: "ControlAI's letter to the Prime Minister", after: "”. This can't be changed by hand." },
    importNow: "Import ControlAI letter now",
    never: "Not imported yet.",
    result: (r: { signatories: number; matched: number; added: number; removed: number }) =>
      `${r.signatories} names, ${r.matched} found here; ${r.added} added, ${r.removed} removed.`,
    columns: { name: "Name", problem: "Problem" },
    kinds: { nobody: "Nobody here", several: "Could be:" } as Record<string, string>,
  },
  // The copy every 5 minutes of the Luma calendar's events, guests and contacts
  // (lib/events/luma-import.ts), on the Scheduled jobs page.
  luma: {
    title: "Events, guests and subscriptions from Luma",
    intro: {
      before: "Imports the public events on ",
      link: "our Luma calendar",
      after:
        ", who registered for each, who the hosts are and who is subscribed to the calendar (the contacts). Tags new upcoming events on Luma with location and online tags if it can.",
    },
    importNow: "Import Luma now",
    never: "Not imported yet.",
    columns: {
      events: "Events",
      guests: "Guests changed",
      hosts: "Hosts changed",
      people: "People",
      contacts: "Contacts",
      supporters: "Supporters added",
    },
    // The counts of a run, then why it stopped early, if it did.
    result: (r: {
      events: number;
      eventsSynced: number;
      eventsLeft: number;
      guestsChanged: number;
      people: number;
      contacts: number;
      supportersAdded: number;
      linked: number;
      requests: number;
    }) =>
      `${r.events} events changed; ${r.eventsSynced} guest lists read, ${r.eventsLeft} waiting; ${r.guestsChanged} guests, ${r.people} people, ${r.contacts} contacts changed; ${r.supportersAdded} new supporters, ${r.linked} linked; ${r.requests} requests.`,
    // After the counts, how many hosts were added to or taken off events (runs kept before hosts were copied don't say).
    hostsChanged: (n: number) => `${count(n, "host", "hosts")} changed.`,
    // After that, how many pages of contacts the run read (runs kept before this was recorded don't say).
    contactPages: (pages: number) => `${pages} pages of contacts read.`,
    // After that, how many upcoming events the run tagged on Luma, when any.
    eventsTagged: (n: number) => `${count(n, "event", "events")} tagged on Luma.`,
    // After that, the postcodes and towns looked up at postcodes.io for where supporters are (runs kept before this was recorded don't say).
    places: (p: { postcodes: number; towns: number }) =>
      `${count(p.postcodes, "postcode", "postcodes")}, ${count(p.towns, "town", "towns")} looked up.`,
    // After that, when postcodes.io failed partway: the next run carries on.
    placesFailed: "Postcodes.io failed: the next run carries on.",
    stoppedBy: {
      time: "Stopped: out of time.",
      "rate-limit": "Stopped: near Luma's rate limit.",
      running: "Another run was already going.",
    } as Record<string, string>,
  },
  // A supporter's letter on its page: what they changed in the draft the campaign gave them.
  letterChanges: {
    // Toggles to the letter as the MP got it, and back.
    asSent: "Show as sent",
    showChanges: "Show changes",
    // In place of paragraphs left as they were; a click unfolds them.
    folded: (n: number) => `${count(n, "paragraph", "paragraphs")} unchanged`,
  },
  // The letters inbox, which supporters' letters to MPs go from (lib/server/letters-inbox-reading.ts).
  lettersInbox: {
    // The labels reading puts on each message in Gmail, by what it made of it.
    labels: {
      relayed: "Relayed",
      noted: "Noted",
      spam: "Spam",
      notUnderstood: "Not understood",
    },
    // After the account's line in a run.
    result: (a: { relayed: number; spam: number; uncertain: number }) =>
      `${a.relayed} relayed, ${a.spam} spam, ${a.uncertain} matched to a letter only as its latest.`,
    // Each message not understood, a line each, with a link to it in Gmail.
    notUnderstood: "Not understood:",
    reasons: {
      unknown_proxy: "to a proxy we don't have",
      no_proxy: "to none of our proxies",
      stranger: "from neither the supporter nor their MP's office",
      not_verified: "failed authentication",
      over_cap: "over its letter's limit on relays",
      bounce: "a bounce of nothing we sent",
    } as Record<string, string>,
    openInGmail: "Open in Gmail",
    // The email to the policy inbox after a run with any.
    alert: {
      subject: (n: number, inbox: string) => `${n} MP ${plural(n, "email", "emails")} in ${inbox} not relayed`,
      body: (inbox: string, lines: string[], runUrl: string) =>
        `Open each in Gmail and deal with it by hand: forward it, answer it, or leave it.\n\n${lines.join("\n")}\n\nThe run: ${runUrl}`,
    },
  },
  // The names our own inboxes go by on the emails the site sends them: the
  // notification inbox, and the policy inbox an MP's reply is forwarded to.
  inboxNames: {
    notifications: "PauseAI UK notifications",
    policy: "PauseAI UK policy",
  },
  // The emails to the notification inbox (lib/server/notifications.ts) that
  // aren't above (alert, lettersInbox.alert): each a subject, and a body with
  // a link to where a person can deal with it.
  notifications: {
    // An import's run failed, after one that didn't: its title, its error, its page.
    // A run that went wrong along the way, without failing: each problem, a line.
    importProblems: {
      subject: (job: string) => `The import '${job}' had problems`,
      body: (job: string, problems: string[], link: string) =>
        `The import '${job}' ran, but:\n\n${problems.join("\n")}\n\nIt will try again at its next run, and you won't be emailed again until it has worked, or something else goes wrong.\n\nIts runs: ${link}`,
    },
    importFailed: {
      subject: (job: string) => `The import '${job}' failed`,
      body: (job: string, error: string, link: string) =>
        `The import '${job}' failed with the error: "${error}". It will try again at its next run, and you won't be emailed again until it has worked.\n\nIts runs: ${link}`,
    },
    // A body's import is held, as it would change too much: which import, how many politicians, and its page.
    importHeld: {
      subject: (job: string, changes: number) => `${job} would change ${changes} politicians`,
      body: (job: string, changes: number, link: string) =>
        `${job} would change ${changes} politicians, so it's held until someone checks it. Review it, then apply or discard it:\n\n${link}`,
    },
    // Google stopped our access to a connected Gmail: whose, what stops, and where to connect it again.
    gmailDisconnected: {
      subject: (account: string) => `${account}'s Gmail is disconnected`,
      body: (account: string, lettersInbox: boolean, link: string) =>
        `Google stopped our access to ${account}'s Gmail. ${lettersInbox ? "Letters to MPs, and the replies to them, wait until it's connected again." : "Mailings sent using that mailbox, and replies, will be paused until it's connected again."} Log in as ${account} and connect it on its account page:\n\n${link}`,
    },
    // Once a day at most: each MP whose address bounced a mailing's letter since the last, and what its server said.
    mailingBounces: {
      subject: (n: number) => `${count(n, "MP's address", "MPs' addresses")} bounced a mailing`,
      body: (lines: string[], link: string) =>
        `These MPs' addresses bounced letters from a mailing since the last report:\n\n${lines.join("\n")}\n\nNothing more will be sent to them until they're unblocked here:\n${link}`,
    },
    // Once a day at most: the supporters' copies that bounced since the last, so their MP's replies can't be
    // passed on; how many replies are held; each address's domain and what its server said.
    supporterBounces: {
      subject: (n: number) => `${n} supporters' ${plural(n, "address", "addresses")} bounced`,
      body: (n: number, held: number, lines: string[], link: string) =>
        `${n} supporters' copies of their letters bounced since the last report, so their MPs' replies can't be passed on to them. ${count(held, "reply is", "replies are")} held. Each address's domain, and what its server said:\n\n${lines.join("\n")}\n\nBounced emails: ${link}`,
    },
    // A broadcast that can't go, as CiviCRM didn't answer its check or no pull has completed for a day, to whoever
    // scheduled it and the inbox, once: it goes by itself when it can, or stops at `stops`.
    broadcastWaiting: {
      subject: (title: string) => `Not sent yet: ${title}`,
      body: (title: string, reason: "civicrm" | "pull", stops: string, link: string) =>
        `“${title}” was due to go, but hasn't been sent.\n\nWe check every address with CiviCRM before emailing it, and ${reason === "civicrm" ? "CiviCRM isn't answering" : "our import from CiviCRM hasn't worked for a day"}.\n\nYou don't need to do anything. It will send as soon as CiviCRM is back. If that hasn't happened by ${stops}, it will be stopped, and you'll get another email.\n\n${link}`,
    },
    // A broadcast whose Gmail, Postmark or WhatsApp has said at every try since `since` that it can't send for now,
    // as at a limit or down, to whoever scheduled it and the inbox, once: it goes on by itself, or stops at `stops`.
    broadcastHeldBack: {
      subject: (title: string) => `Held back: ${title}`,
      body: (title: string, channel: "email" | "text", since: string, said: string, stops: string, link: string) =>
        `“${title}” hasn't sent anything since ${since}: ${channel === "text" ? "WhatsApp" : "what sends it"} keeps saying it can't send for now. It last said: ${said}\n\nIt will carry on by itself once it can. If it hasn't all gone by ${stops}, it will be stopped, and you'll get another email.\n\n${link}`,
    },
    // A broadcast that waited too long and stopped, to whoever scheduled it and the inbox: how many it didn't reach.
    broadcastGaveUp: {
      subject: (title: string, reason: "civicrm" | "pull" | "limit" | "template" | "late" | "failing") =>
        reason === "template"
          ? `Stopped, as WhatsApp paused the template it used: ${title}`
          : reason === "failing"
            ? `Stopped, as sending kept failing: ${title}`
            : `Stopped after ${daysInWords(reason === "limit" || reason === "late" ? SENDING_DAYS : WAIT_DAYS)}: ${title}`,
      // How to send it to those it didn't reach: the button on its page (broadcastPages.resume).
      resume: `To send it to them, press “${RESUME_SENDING}” on its page.`,
      // Why, for an email that Gmail's daily limit left too slow, in place of CiviCRM's sentence.
      whyGmailLimit: `It was too large a broadcast for Gmail to send within ${daysInWords(SENDING_DAYS)}.`,
      // The same, for a text that our WhatsApp number's daily limit left too slow.
      whyWhatsAppLimit: `It was too large a broadcast for our WhatsApp number to send within ${daysInWords(SENDING_DAYS)}.`,
      // Why, for a text whose template WhatsApp paused or disabled, for its quality.
      whyTemplate:
        "WhatsApp paused or disabled its template, as people blocked, reported or didn't read texts on it. Change the template before it goes again.",
      // Why, for one whose days ran out while it waited for CiviCRM.
      whyLate: `Its ${daysInWords(SENDING_DAYS)} ran out while CiviCRM was down, and we don't send to anyone without checking with it first.`,
      // Why, for one so many of whose copies failed one after another (FAILURES_TO_STOP): something may be wrong with what sends it.
      whyFailing: `The last ${FAILURES_TO_STOP} messages we tried to send all failed, so something may be fundamentally wrong. Check each copy and fix any problem before sending again.`,
      body: (
        title: string,
        reason: "civicrm" | "pull" | "limit" | "template" | "late" | "failing",
        notReached: number,
        link: string,
        channel: "email" | "text",
      ) => {
        const words = staffCopy.notifications.broadcastGaveUp;
        const why = {
          limit: channel === "text" ? words.whyWhatsAppLimit : words.whyGmailLimit,
          template: words.whyTemplate,
          late: words.whyLate,
          failing: words.whyFailing,
          civicrm: `CiviCRM couldn't be reached for ${daysInWords(WAIT_DAYS)}, and we don't email anyone without checking with it first.`,
          pull: `CiviCRM couldn't be reached for ${daysInWords(WAIT_DAYS)}, and we don't email anyone without checking with it first.`,
        }[reason];
        return `“${title}” has been stopped. ${why}\n\n${count(notReached, "person", "people")} didn't get it. ${words.resume}\n\n${link}`;
      },
    },
    // A text's new words sent to WhatsApp for approval, to who sent them and the inbox: the words, and the text.
    templateSubmitted: {
      subject: (name: string) => `WhatsApp template sent for approval: ${name}`,
      body: (by: string, words: string, link: string) =>
        `${by} sent this copy to WhatsApp for approval as a new template. WhatsApp usually decides within 24 hours, and you'll be emailed when it does.\n\n${words}\n\nThe text: ${link}`,
    },
    // WhatsApp approved or rejected a template, to who sent it and the inbox: why, the words, and the texts on it.
    templateApproved: {
      subject: (name: string) => `WhatsApp approved the template: ${name}`,
      body: (words: string, links: string[]) =>
        `WhatsApp approved this copy, so a text on it can be scheduled now.\n\n${words}\n\n${links.join("\n")}`,
    },
    // Why WhatsApp rejected a template, by its code, in plain words with what to do
    // (https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-review).
    templateRejectedWhy: {
      reasons: {
        ABUSIVE_CONTENT: "“abusive content”. It found the template abusive or against its policies.",
        INCORRECT_CATEGORY: "“incorrect category”. It thought the template wasn't marketing.",
        INVALID_FORMAT: "“invalid format”. There was a field at the very start or end, or two fields together.",
        PROMOTIONAL: "“promotional”. It thought the template was too promotional.",
        SCAM: "“scam”. It thought the template might be a scam.",
        TAG_CONTENT_MISMATCH: "“tag content mismatch”. It thought the template wasn't marketing.",
      } as Record<string, string>,
      other: (code: string) => `“${code}”, a reason we don't know.`,
    },
    // WhatsApp paused or disabled a template for its quality, as people blocked or reported texts on it, to
    // whoever sent it and the inbox: and how many texts on it that stopped.
    // A WhatsApp message that answers no text of ours, to the inbox: who from, and its words.
    whatsAppMessage: {
      subject: (number: string) => `A WhatsApp message from ${number}`,
      body: (number: string, words: string) =>
        `${number} sent this to our WhatsApp number. It answers no broadcast message of ours, so sending it here.\n\n${words}`,
    },
    // Something WhatsApp says of our number, a template's quality or our account, to the inbox, as it says it.
    whatsAppAlert: {
      subject: (what: string) => `WhatsApp: ${what}`,
      // With a link to our account in WhatsApp Manager, on its own line.
      body: (what: string, details: string, manager: string) =>
        `WhatsApp sent this about our number or account (${what}). Check WhatsApp Manager.\n${manager}\n\n${details}`,
    },
    templatePaused: {
      subject: (name: string) => `WhatsApp paused the template: ${name}`,
      body: (name: string, stopped: number) =>
        `WhatsApp paused or disabled “${name}”, as people blocked, reported or didn't read texts on it. ${count(stopped, "text", "texts")} on it stopped. Write a new template with different words before texting again.`,
    },
    templateRejected: {
      subject: (name: string) => `WhatsApp rejected the template: ${name}`,
      body: (reason: string, words: string, links: string[]) =>
        `WhatsApp rejected the template with ${reason}\n\nChange it, and send it for approval again.\n\n${words}\n\n${links.join("\n")}`,
    },
    // Letters to MPs have waited LATE_HOURS to go: how many, why, and the queued letters.
    lettersWaiting: {
      subject: (n: number, hours: number) => `${count(n, "letter", "letters")} to MPs waiting over ${hours} hours`,
      body: (n: number, hours: number, why: string, link: string) =>
        `${plural(n, "A letter", `${n} letters`)} to MPs ${plural(n, "has", "have")} waited over ${hours} hours to go. Why: ${why}.\n\nThe letters waiting: ${link}`,
    },
  },
  // The read every 5 minutes of the connected Gmail accounts for replies to our
  // letters and bounces (lib/server/gmail-reading.ts), on the Scheduled jobs page.
  gmailReading: {
    // The columns of the table of a day's reads.
    columns: {
      replies: "Replies",
      autoReplies: "Automatic replies",
      oneOffs: "One-off emails",
    },
    oneOffs: (n: number) => `${n} one-off ${plural(n, "email", "emails")} kept.`,
    // After the totals, in a run that searched for addresses staff added to politicians': what it found, and how many wait.
    searched: (s: AddressSearch) =>
      `Searched for ${count(s.searched, "added address", "added addresses")}, keeping ${count(s.kept, "earlier email", "earlier emails")}.` +
      (s.waiting ? ` ${s.waiting} still to search.` : "") +
      (s.stopped ? " Stopped as its time ran out." : ""),
    title: "Replies, bounces and one-off emails from Gmail",
    intro: {
      before: "Reads the replies to our letters, and their bounces, in each ",
      link: "connected Gmail account",
      after:
        ". From policy@ and Joseph's, it also imports any threads with politicians as one-off emails. In the letters inbox, it relays mail between supporters and their MPs' offices, both ways, and emails the policy inbox about anything it couldn't place.",
    },
    readNow: "Read Gmail now",
    never: "Not read yet.",
    // The run's totals, over every account, then a line for each.
    result: (accounts: { replies: number; autoReplies: number; bounces: number }[]) =>
      `${count(accounts.length, "account", "accounts")} read: ${accounts.reduce((n, a) => n + a.replies, 0)} replies, ${accounts.reduce((n, a) => n + a.autoReplies, 0)} automatic replies, ${accounts.reduce((n, a) => n + a.bounces, 0)} bounces.`,
    account: (a: { account: string; replies: number; autoReplies: number; bounces: number }) =>
      `${a.account}: ${a.replies} replies, ${a.autoReplies} automatic replies, ${a.bounces} bounces.`,
    // After an account's line: its history had gone, so the last few days were searched instead.
    restarted: "Searched the last three days again, as Gmail had forgotten where we were up to.",
    failed: (error: string) => `Couldn't be read: ${error}`,
    // In place of that, when Google refused the account's access, so the site disconnected it.
    disconnected:
      "Google refused our access, so this account has been disconnected. Its owner can connect it again from their account page.",
  },
  // The sending every 15 minutes (/api/cron/send-mailings): the letters inbox's queue, then the mailings due.
  sending: {
    title: "Sending letters and mailings",
    intro: {
      before: "Sends ",
      link: "campaign",
      after: ", ",
    },
    // The intro goes on, with a second link, then a third.
    introThen: {
      link: "mailing",
      after: " and ",
    },
    introLast: {
      link: "broadcast",
      after: " messages that are ready to send.",
    },
    sendNow: "Send emails now",
    never: "Nothing sent yet.",
    result: (r: {
      started: number[];
      sent: number;
      skipped: number;
      failed: number;
      left: number;
      queue: { sent: number; left: number };
      broadcasts?: { started: number[]; sent: number; skipped: number; failed: number; waiting: number };
    }) =>
      `Started ${count(r.started.length, "mailing", "mailings")}; sent ${r.sent}, skipped ${r.skipped}, failed ${r.failed}, ${r.left} left. The queue: sent ${r.queue.sent}, ${r.queue.left} left.${r.broadcasts ? ` Broadcasts: started ${r.broadcasts.started.length}; copies sent ${r.broadcasts.sent}, skipped ${r.broadcasts.skipped}, failed ${r.broadcasts.failed}; ${r.broadcasts.waiting} waiting for CiviCRM.` : ""}`,
  },
  // The nightly tidying (/api/cron/tidy-logs): this log, the audit log, forgotten drafts and old errors.
  tidying: {
    title: "Tidying the logs",
    intro: {
      before: "Deletes entries of the ",
      link: "audit log",
      after: " over a month old (except politicians' history), empty ",
    },
    // The intro goes on, with a second link and a third.
    introThen: {
      link: "mailing drafts",
      after: " unopened for a day, and ",
    },
    introLast: {
      link: "errors",
      after: " not seen for a month.",
    },
    tidyNow: "Tidy logs now",
    never: "Not tidied yet.",
    // A run kept from before errors were tidied counts none.
    result: (r: { importRuns: number; auditEntries: number; drafts: number; errors?: number }) =>
      `Deleted ${count(r.importRuns, "run", "runs")}, ${r.auditEntries} audit log ${plural(r.auditEntries, "entry", "entries")}, ${count(r.drafts, "draft", "drafts")} and ${count(r.errors ?? 0, "error", "errors")}.`,
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
    politicians: (n: number) => count(n, "politician", "politicians"),
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
  sentEmails: {
    // Under the title.
    intro: "Every email the site has sent",
    // Over the list, for an admin without the supporters permission.
    withheld: "Emails to and from supporters are not shown, as you don't have the supporters permission.",
    search: "Address or subject",
    total: (n: number) => count(n, "email", "emails"),
    none: "No emails match.",
    columns: {
      when: "When",
      what: "What",
      to: "To",
      from: "From",
      backend: "Backend",
      subject: "Subject",
      outcome: "Outcome",
      links: "Links",
    },
    purposes: {
      letter: "Letter",
      "letter-copy": "Supporter's copy",
      relay: "Message relayed",
      "supporter-notice": "Notice to supporter",
      "office-notice": "Notice to MP's office",
      "forwarded-reply": "Forwarded reply",
      "staff-login": "Staff sign-in",
      "staff-alert": "Staff alert",
      "staff-report": "Staff report",
      mailing: "Mailing",
      "mailing-test": "Mailing test",
    } as Record<string, string>,
    backends: { postmark: "Postmark", gmail: "Gmail" } as Record<string, string>,
    outcomes: {
      sent: "Sent",
      refused: "Refused",
      failed: "Failed",
      bounced: "Bounced",
      complaint: "Spam complaint",
    } as Record<string, string>,
    imported: "Imported",
    letterLink: "Letter →",
    campaignLink: "Campaign →",
    mailingLink: "Mailing →",
    filters: {
      purpose: "What",
      outcome: "Outcome",
      backend: "Backend",
      links: { letter: "Has a letter", campaign: "Has a campaign", mailing: "Has a mailing" },
    },
  },
  // What went wrong on the site outside a job's run (lib/server/errors-seen.ts): the admins' list at
  // /staff/errors, one error's page, and the emails to the notification inbox.
  errorsSeen: {
    // Under the list's heading.
    intro: "Server and browser errors",
    total: (n: number) => count(n, "error", "errors"),
    none: "No errors.",
    // The list's two tabs: those still to do, and those an admin has marked done, which go back to the first
    // when they happen again. Then what the Done tab says when it's empty.
    tabs: { label: "Which errors", toDo: "To do", done: "Done" },
    noneDone: "No errors are marked done.",
    columns: {
      what: "Error message",
      kind: "Kind",
      // The route's pattern for the server's, the page's path for a browser's; nothing for a problem.
      page: "Page or route",
      first: "First seen",
      last: "Last seen",
      count: "Times",
      // On the Done tab alone: who marked it done, and when.
      doneBy: "Marked done by",
      doneAt: "Marked done",
    },
    // What was running: Next's four on the server, a problem our code reported, and the browser's two. Of
    // the browser's, the first lost the visitor the page, which went to the error page; the second threw
    // from a click or the like and left the page as it was.
    kinds: {
      render: "Page",
      route: "Route handler",
      action: "Server Action",
      proxy: "Proxy",
      problem: "Problem",
      "browser-page": "Browser: page crashed",
      "browser-other": "Browser: page carried on",
    },
    // One error's page: its title, and its step of the trail above it, then each thing known about it.
    one: {
      title: "Error",
      kind: "Kind",
      page: "Page or route",
      className: "Class",
      code: "Code",
      browser: "Browser of the latest",
      first: "First seen",
      last: "Last seen",
      count: "Times",
      // Over everything under the header, which is the latest time's alone.
      latest: "Details on most recent time",
      // Over its message as it was thrown, numbers, addresses and all; then over its stack trace.
      message: "Error message",
      stack: "Stack trace",
      noStack: "No stack trace.",
      // The button that takes it off the list to do until it happens again; then, once it's done, who marked
      // it and when, and the button that puts it back.
      markDone: "Mark as done",
      doneBy: (by: string, at: string) => `Marked done by ${by}, ${at}.`,
      undo: "Mark not done",
    },
    // The emails. `where` is the kind and the route; `words` the error's, with what varies taken out.
    email: {
      // An error on the server, or a problem.
      server: {
        subject: (words: string) => `Error on pauseai.uk server: ${words}`,
        first: (where: string, words: string, link: string) =>
          `Something new went wrong on pauseai.uk.\n\n${where}\n${words}\n\nYou'll be emailed about it again at most once a day. More info: ${link}`,
        again: (where: string, words: string, since: number, total: number, link: string) =>
          `This is still going wrong on pauseai.uk. ${count(since, "more time", "more times")} since the last email about it, ${total} in all.\n\n${where}\n${words}\n\nMore info: ${link}`,
      },
      // An error in a visitor's browser that lost them the page. Its words aren't quoted, as anyone can post them.
      browser: {
        subject: (page: string) => `Browser error on pauseai.uk: ${page}`,
        first: (where: string, link: string) =>
          `A page fell over in someone's browser, in a way that hasn't been seen in the last month.\n\n${where}\n\nYou'll be emailed about it again at most once a day. More info: ${link}`,
        again: (where: string, since: number, total: number, link: string) =>
          `A page is still falling over in people's browsers. ${count(since, "more time", "more times")} since the last email about it, ${total} in all.\n\n${where}\n\nMore info: ${link}`,
      },
      // In place of an hour's sixth email about the server's errors, or fourth about the browser's; then no more that hour.
      many: {
        subject: "Many new server errors on pauseai.uk",
        body: (link: string) =>
          `Several different things have gone wrong on the site in the last hour, so no more emails about new errors will be sent for now.\n\nMore info: ${link}`,
      },
      manyBrowser: {
        subject: "Many new browser errors on pauseai.uk",
        body: (link: string) =>
          `Pages have fallen over in people's browsers in several different ways in the last hour, so no more emails about new ones will be sent for now.\n\nMore info: ${link}`,
      },
    },
  },
  oneOff: {
    // The page's title, and a thread's way back.
    title: "One-off emails",
    columns: {
      when: "Last message",
      subject: "Subject",
      messages: "Messages",
      answered: "Answered",
      politician: "Politician",
      participants: "Participants",
      mailbox: "Mailbox",
    },
    answers: { yes: "Yes", no: "No" },
    hidden: "Only staff who see supporters can read this.",
    noPolitician: "Parliament address",
    noSubject: "(no subject)",
    thread: "The thread",
    // A thread's page's title: who wrote in it, "with" the one when only one did.
    between: (who: string[]) =>
      who.length === 1 ? `Thread with ${who[0]}` : `Thread between ${new Intl.ListFormat("en-GB").format(who)}`,
    // A thread's own step of the trail above its page: the title's first word.
    crumb: "Thread",
    // Under a thread's subject, a fact each: a label, then what the list's column of that name shows.
    fact: (label: string, value: string | number) => `${label}: ${value}`,
    unreadable: "This message couldn't be read.",
    // A message rebuilt from a forward's quote of it, at the right of its subject: who forwarded it.
    rebuilt: (forwarder: string) => `Quoted in ${forwarder}'s forward`,
    // A forward with no note over what it carries.
    forwardedAlone: "(Forwarded without a message)",
    // Beside the thread: the politicians it's linked to.
    people: {
      title: "Linked politicians",
      none: "None",
    },
    // On a politician's and a supporter's page.
    onPageTitle: "One-off emails",
    // On your own page, under your Gmail.
    // Around a link to the one-off emails, which says their title.
    kept: { before: "All threads with politicians in this specific mailbox are kept, and show under", after: "." },
    // In any other mailbox, around a link to the mailings.
    notKept: { before: "Replies to threads sent like this will be kept, and show under", after: "." },
    // In hello@'s, which sends the broadcasts too, around links to the mailings and the broadcasts.
    notKeptBroadcasts: {
      before: "Replies to mailings and broadcasts sent from here are kept, and show under",
      and: "and",
      after: ".",
    },
    unmatchedAlert: {
      subject: (n: number) => `${count(n, "email", "emails")} in policy@ matched no politician`,
      body: (lines: string[], link: string) =>
        // Each line its sender, subject and a link to it in Gmail, which opens for someone signed in to its mailbox.
        `Some emails arrived in the policy@ inbox and weren't kept, because they didn't match a politician. Work out who they're from, and widen the rule or add exceptions.\n\n${lines.join("\n")}\n\n${link}`,
      // After the list, when a report is full: how many wait for the next one.
      more: (n: number) => `And ${n} more, in the next report.`,
    },
  },
  // The hourly pull of Global's UK chapter contacts from CiviCRM (lib/server/civicrm-import.ts).
  civicrm: {
    title: "UK chapter contacts in CiviCRM",
    intro: {
      before: "Imports everyone in the UK chapter in Global's ",
      link: "CiviCRM",
      after: ", with their details, which UK lists they're on, and their do-not flags and holds.",
    },
    importNow: "Import contacts now",
    never: "Not imported yet.",
    result: (r: {
      contacts: number;
      added: number;
      changed: number;
      gone: number;
      held?: true;
      optOuts: number;
      blocked: number;
      unblocked?: number;
      supportersAdded?: number;
      linked?: number;
      updates?: { sent: number; refused: number; unanswered: number };
    }) =>
      `${r.updates ? sentToCivicrm(r.updates) : ""}${count(r.contacts, "contact", "contacts")} read: ${r.added} added, ${r.changed} changed, ${r.held ? "none marked gone, as too few came back" : `${r.gone} gone`}; ${count(r.optOuts, "unsubscribe", "unsubscribes")} changed, ${count(r.blocked, "address", "addresses")} blocked for a hold.${r.unblocked ? ` ${count(r.unblocked, "address", "addresses")} unblocked, as CiviCRM lifted the hold.` : ""}${r.linked ? ` ${count(r.supportersAdded!, "new supporter", "new supporters")}, ${r.linked} linked.` : ""}`,
  },
  // What went wrong without stopping the work (lib/server/problems.ts), by how far each can reach.
  problems: {
    // On a job's run, so on its page and in the email: something the job carried on past.
    job: {
      // The Gmail read: Gmail errored or refused for a connected account, so its new mail wasn't read this time.
      couldntRead: (account: string) =>
        `Gmail gave errors or refused connection, or our internal error, for ${account}`,
      // The Gmail read: the mailbox was read, but Gmail wouldn't give the account's name.
      nameUnknown: (account: string) => `Couldn't fetch name of ${account} from Gmail`,
      // The Gmail read: mail in the letters inbox that couldn't be matched to anything, so a person must look. How many follows.
      notUnderstood: "Messages in the letters inbox that couldn't be matched, so need a person to look at:",
      // The Gmail read, for a one-off thread's other messages, where they're tried with each new one: messages Gmail wouldn't give, by ID, which follow.
      unreadable: "Messages that Gmail has but refused to give us:",
      // The CiviCRM import: a pull came back much shorter than the last, so nobody was taken as gone from the
      // chapter, in case it's CiviCRM's mistake. The counts follow; Global should be told.
      civicrmTooFew: "CiviCRM returned far fewer contacts than last time, so nobody was marked gone. Tell Global:",
      // The CiviCRM import: sending our opt-outs to CiviCRM failed, or it didn't answer some, or said some were
      // wrong. Each is tried again next hour, but a wrong one needs a developer.
      // Sending a broadcast: CiviCRM didn't answer its check of the addresses, so it waits (staff are told by email).
      civicrmCheckFailed: "CiviCRM didn't answer, so a broadcast is waiting to send",
      civicrmUpdatesFailed: "Couldn't send opt-outs to CiviCRM. They'll go next hour",
      civicrmUpdatesUnanswered: (n: number) =>
        `${plural(n, "opt-out", "opt-outs")} got no answer from CiviCRM. They'll go again next hour`,
      civicrmUpdatesInvalid: (n: number) =>
        `CiviCRM rejected ${plural(n, "opt-out", "opt-outs")}. A developer needs to look at them:`,
    },
    // Can happen in a job or not. In a job, staff see it on the job's page and in the email. Not in a job, such
    // as a visitor sending a letter, it's kept as an error (lib/server/errors-seen.ts): on the errors page, and
    // emailed to staff.
    anywhere: {
      // An email didn't go, as Gmail or Postmark errored.
      sendFailed: (purpose: string) => `An email of type '${purpose}' couldn't be sent`,
      // Something should have emailed staff, but NOTIFICATION_INBOX isn't set, so nobody heard.
      noInbox: "NOTIFICATION_INBOX isn't set, so nobody was emailed",
      // An email went by Gmail, but Gmail wouldn't say its Message-ID. Replies to it may not find their letter.
      messageIdUnknown: "Gmail wouldn't say which Message-ID an email went with",
      // Something went wrong sending a queued letter. It's back in the queue, and the writer is told it's on its way.
      letterNotSent: (id: number) => `Letter ${id} couldn't be sent, so it's gone back in the queue`,
      // Something went wrong before an email went: the letter or broadcast copy is back in line for the next run.
      notSentYet: (what: string) => `${what} couldn't be sent, it will be tried again`,
      // An email went, but recording that failed: a person must check, as sending it again would send it twice.
      sentUnrecorded: (what: string) =>
        `${what} was sent, but couldn't be marked as sent. Check before sending it again`,
      // WhatsApp's API didn't answer when asked for our number, so no text could be sent or scheduled just then.
      whatsAppUnanswered: "WhatsApp didn't answer, so no text could go just then",
      // Meta didn't say how many people our WhatsApp account can text a day, so the fewest are, till it does.
      whatsAppLimitUnknown: "WhatsApp didn't say our daily limit, so texts go to no more than 250 people a day",
      // A text's new words couldn't be sent to WhatsApp for approval, or taken back from it.
      templateNotSent: (name: string) => `WhatsApp didn't take template ${name} for approval`,
      templateNotDeleted: (name: string) => `WhatsApp didn't delete template ${name}, which was withdrawn here`,
      // The text answering a reply of "stop" didn't go, though the stop is kept.
      stopNotAnswered:
        "A supporter replied STOP and their texts are stopped, but our WhatsApp reply confirming it failed to send",
      // What those are, in them.
      copyOf: (id: number) => `Broadcast copy ${id}`,
      letterOf: (id: number) => `Letter ${id}`,
      letterCopyOf: (id: number) => `The supporter's copy of letter ${id}`,
      relayOf: (id: number) => `Relay ${id}`,
      answerTo: (id: number) => `The answer to reply ${id}`,
      // Reading an email in a charset we don't know: a job reading mail, or staff opening a letter. It's read as UTF-8.
      charsetUnknown: (charset: string) =>
        `An email's charset isn't one we know, so its text may be garbled: ${charset}`,
    },
    // No job reaches these: each is kept as an error (lib/server/errors-seen.ts), on the errors page and
    // emailed to staff, but for connectionDropped and errorNotKept, which only reach Netlify's logs. Each
    // says what the person saw, if anything.
    logs: {
      // A visitor sending a letter gets an error, and the letter is lost unless they try again.
      letterNotKept: "A letter couldn't be kept",
      // A visitor is told the spam check can't be reached.
      turnstileDown: "Turnstile couldn't be reached",
      // A visitor is told the spam check isn't available.
      turnstileUnset: "TURNSTILE_SECRET_KEY isn't set",
      // A visitor is told the spam check is set up wrongly.
      turnstileTestKey: "TURNSTILE_SECRET_KEY is a Cloudflare test key, refused outside development",
      // A march sign-up that couldn't be saved here. The visitor gets Luma's answer, worked or failed.
      signUpNotKept: "A march sign-up couldn't be kept",
      // A march sign-up Luma wouldn't take. The visitor is told it failed, and their details are kept.
      lumaSkippedGuest: "Luma skipped a march sign-up: unsubscribed, removed or blocked on the calendar",
      // A march sign-up with no Luma key set. The visitor is told it failed, and their details are kept.
      lumaNotConfigured: "A march sign-up couldn't go to Luma, as LUMA_API_KEY isn't set",
      // A march sign-up Luma errored on. The visitor is told it failed, and their details are kept.
      lumaRefusedGuest: "Luma wouldn't add a march sign-up",
      // The signatories list's API answers with an error.
      signatoriesUnread: "The signatories couldn't be read",
      // WhatsApp gets an error, so it sends the webhook again.
      whatsAppWebhookNotRecorded: "A WhatsApp webhook couldn't be recorded",
      // A visitor looking up a postcode, or staff searching near a place, gets a failed answer.
      postcodesDown: "postcodes.io couldn't be asked",
      // The donate page shows an empty wall of thanks.
      stripeDown: "Stripe couldn't be queried, so the wall of thanks is empty",
      // A flyering tracker or the march's sign-up count shows no number.
      lumaGuestsDown: "Luma couldn't be asked about an event's guests",
      // A page that lists events shows none.
      lumaEventsDown: "Luma couldn't be asked for the events, so the page shows none",
      // An import of sign-ups registered people on Luma, and they're copied at the next scheduled run instead.
      lumaImportNotStarted: "The Luma import couldn't be started after importing sign-ups",
      // A request from Postmark or the march form that isn't JSON, treated as empty.
      badBody: (from: string) => `${from} sent a body that isn't JSON`,
      // Nobody sees anything: a warning, as the next query carries on.
      connectionDropped: "A database connection was dropped while idle",
      // An error, or a problem above, that couldn't be kept or emailed about, as the database or the email failed.
      errorNotKept: "An error couldn't be kept or emailed about",
    },
  },
  // The line every run in the import log starts with (RunBox): how it
  // ended, when, who started it, and for a held MP import, who decided it.
  // A Luma import that left work for later is incomplete in place of done
  // or unchanged.
  runs: {
    status: {
      ok: "Done",
      incomplete: "Incomplete",
      running: "Running",
      problems: "Problems",
      failed: "Failed",
      unchanged: "Unchanged",
      held: "Held",
      applied: "Applied",
      discarded: "Discarded",
    } as Record<string, string>,
    by: (who: string) => `by ${who}`,
    // A failed run's error, as it came.
    error: (error: string) => `Error: "${error}"`,
    decidedBy: (who: string) => `decided by ${who}`,
    // A held run discarded as a newer run of its job came after it, as only the newest list can be applied.
    replaced: "replaced by a newer run",
    // A job's frequent runs, in a table: its columns' headings, where a job has
    // no counts of its own, the time of a stretch of runs, and what a stretch was.
    time: "Time",
    found: "What it found",
    range: (from: string, to: string) => (from === to ? from : `${from}–${to}`),
    quiet: (n: number) => `${count(n, "run", "runs")}, nothing new`,
    stretch: (n: number) => `${count(n, "run", "runs")}, no problems`,
  },
  // The nightly import of ControlAI's statement's supporters (lib/server/controlai-statement-import.ts).
  controlAiStatement: {
    title: "ControlAI's UK campaign statement",
    intro: {
      before: "Imports the politicians who back ",
      link: "ControlAI's statement",
      after: ", marking them as having signed “",
    },
    // The ask they're marked as having signed, linked to its page; the quotes around it aren't.
    introThen: { link: "ControlAI's campaign statement", after: "”. This can't be changed by hand." },
    importNow: "Import ControlAI statement now",
    never: "Not imported yet.",
    result: (r: { supporters: number; matched: number; added: number; removed: number }) =>
      `${r.supporters} supporters, ${r.matched} found here; ${r.added} added, ${r.removed} removed.`,
    // A problem of the run: links on the page to politicians we don't have, which follow.
    unmatched: "Supporters on ControlAI's page we couldn't find here:",
  },
  import: {
    // The page with every scheduled job: the imports, each body's members,
    // ControlAI's letter and statement from the web, Luma and CiviCRM, and
    // the rest, such as reading Gmail, sending mailings and tidying the logs.
    pageTitle: "Scheduled jobs",
    // Under the title.
    pageIntro: "Imports, mail and tidying that run on a timer",
    // Each job's icon, named for screen readers and on hover: where it reads
    // from or works on. Then how often it runs, the overview's headings and a
    // lozenge on the job's page.
    parliament: "UK Parliament",
    "scottish-parliament": "Scottish Parliament",
    senedd: "Welsh Parliament",
    "ni-assembly": "Northern Ireland Assembly",
    controlai: "ControlAI",
    database: "Database",
    luma: "Luma",
    civicrm: "CiviCRM",
    gmail: "Gmail",
    nightly: "Nightly",
    // What a job that isn't an import does, a lozenge after its name: compares
    // with another list, reads mail, sends mail, or keeps the site tidy.
    kinds: {
      check: "Check",
      read: "Reads mail",
      send: "Sends mail",
      tidy: "Tidy",
    },
    // After that, for the Luma import, which tags Luma's events. Reading Gmail,
    // which relays mail and emails staff, has "Sends mail" (kinds.send).
    changesLuma: "Changes Luma",
    // On a job's page, while a run of it is going: one a staff member started, or one of its schedule's.
    running: (who: string, when: string) => `Running, started by ${who} at ${when}. Can only run one at a time.`,
    runningScheduled: (when: string) => `Running now, started at ${when}. Can only run one at a time.`,
    frequent: "Every 5 minutes",
    "quarter-hour": "Every 15 minutes",
    hourly: "Hourly",
  },
  allLetters: {
    title: "Correspondence",
    // Under the title.
    subtitle: "All emails to and from notable people",
    // Over the list: how many there are.
    total: (total: number) => count(total, "email", "emails"),
    search: "Sender, politician or topic",
    // Who a letter is from, the filter's name and its choices.
    from: "Started by",
    fromKinds: {
      supporter: "Supporters",
      pauseai: "PauseAI",
      politician: "Politicians",
      other: "Other",
    },
    // In a one-off thread's first column, in place of a status.
    oneOff: "One-off",
    // The filter by what a row is, under the Topic column's name.
    types: { campaign: "Campaign", mailing: "Mailing", "one-off": "One-off" },
    // What opens a one-off thread, in its first column.
    theThread: "Thread →",
    // Over the list, for staff without the supporters permission.
    withheld: "Emails with supporters on them are not shown, as you don't have the supporters permission.",
    // Under the title: what the one-offs are.
    intro: (inbox: string) =>
      `One-off emails are threads copied to ${inbox} that aren't part of a mailing or a campaign.`,
    // When it was sent.
    sent: "Sent",
    // Whether it got a written reply, or got one in a window.
    replied: "Replied",
    repliedChoices: { yes: "Any time", no: "No reply" },
    // What a row is about, and after it, plain, which kind of thing that is.
    topic: "Topic",
    topicKinds: { campaign: "campaign", mailing: "mailing", oneOff: "one-off" },
    noneFound: "No emails found.",
  },
  letters: {
    title: "Letters to MPs",
    // Over the list: how many there are.
    total: (total: number) => count(total, "letter", "letters"),
    search: "Sender or MP",
    // The Replied filter: whether the MP replied.
    // The Replied filter: what came back to a letter.
    answered: { yes: "Written reply", auto: "Automatic reply only", no: "No reply" },
    // The titles of a letter's own page, and of a supporter's letters' page.
    oneTitle: (from: string, to: string) => `Letter from ${from} to ${to}`,
    fromTitle: (name: string) => `Letters from ${name}`,
    // A letter's own step of the trail above its page, after its campaign or mailing.
    crumb: "Letter",
    // Who PauseAI's letters are from, in a letter's title.
    fromPauseai: "PauseAI UK",
    // A letter's own page: its facts beside the list's, and the way to read it as it was sent.
    detail: {
      subject: "Subject",
      sent: "Sent",
      mailing: "Mailing",
      personalised: "Personalised",
      historyTitle: "History",
      // Under the ask a supporter's letter makes, before its campaign's name.
      basedOn: "Based on the campaign",
      noHistory: "Nothing recorded yet.",
      // What a change of status recorded, each field's name before its value: Postmark's, a bounce's, a reply's.
      fields: {
        messageId: "Message ID",
        type: "Type",
        description: "Description",
        reason: "Reason",
        // What Gmail said when it refused to send a mailing's letter, as it said it.
        detail: "Gmail said",
        email: "Address",
        from: "From",
        to: "To",
        cc: "Cc",
        replyTo: "Reply-To",
        subject: "Subject",
        // What sending from Gmail and reading its mailbox record.
        name: "Name",
        account: "Gmail",
        status: "Code",
        bcc: "Bcc",
        notice: "Notice",
        uncertain: "Which letter",
        // Who did it: a staff member, on a copy of a broadcast's history; and how they told us, of an opt-out.
        by: "By",
        how: "How they told us",
      } as Record<string, string>,
      // The value of uncertain: the reply named none of the supporter's letters to the MP, so it was put with the newest.
      uncertainLetter: "A guess: their newest to this MP, as the reply didn't say which it answers",
      // A reason, recorded as a word, in words: why a letter, copy or relay waits or wasn't relayed.
      reasons: {
        not_connected: "The letters inbox isn't connected",
        daily_limit: "The letters inbox reached its daily limit",
        failed: "Gmail refused it or couldn't be reached; it'll try again in every hour",
        blocked: "The address is blocked, as it bounced",
        not_verified: "It failed authentication, so may be forged",
        over_cap: "Over the letter's limit on relays, in case of a loop",
      } as Record<string, string>,
      // What a notice to the supporter said.
      notices: {
        bounced: "Their message hasn't reached the MP",
        resent: "It has now gone",
        notResent: "It wasn't sent within a week, and we gave up",
      } as Record<string, string>,
      // Under a reply, what was done with it: each line's name, before who to; "Not forwarded" when it went to no one.
      handling: {
        forwarded: "Forwarded to",
        not_forwarded: "Not forwarded to",
        nowhere: "Not forwarded",
        failed: "Forward failed",
      },
      // Why, under each line of what was done with a reply.
      handlingReasons: {
        policy_inbox: "Every reply goes to the shared inbox",
        sender: "The sender, who wasn't sent it",
        copied: "Already in its To or Cc",
        own_follow_up: "It's their own follow-up",
        bounce_address: "Came to the bounce address",
        // A reply that came to one of our Gmail inboxes, so isn't forwarded there again.
        gmail: "Already in our Gmail inbox",
        refused: "Postmark refused it",
        blocked: "The address is blocked",
      },
    },
    none: "No letters.",
    status: {
      sending: "Sending",
      sent: "Sent",
      // Left sending by a run that stopped: it may have gone, or not, so it isn't sent again; a person checks.
      uncertain: "Uncertain",
      not_sent: "Not sent",
      bounced: "Bounced",
      spam_complaint: "Spam complaint",
      replied: "Replied",
      auto_reply: "Auto-reply",
      // PauseAI's letters of a mailing written here, before and instead of sending.
      scheduled: "Scheduled",
      cancelled: "Cancelled: we stopped the mailing",
      skipped: "Skipped",
      // A supporter's letter from the letters inbox, waiting to go, and what's done with it and the messages both ways.
      queued: "Queued",
      copy_sent: "Copy sent to supporter",
      copy_held: "Copy held",
      copy_bounced: "Copy bounced",
      copy_delayed: "Copy delayed",
      // The supporter's copy, left sending by a run that stopped: it may have reached them, or not.
      copy_uncertain: "Copy uncertain",
      relayed: "Relayed",
      relay_queued: "Relay queued",
      relay_held: "Relay held",
      relay_bounced: "Relay bounced",
      relay_delayed: "Relay delayed",
      relay_uncertain: "Relay uncertain",
      not_relayed: "Not relayed",
      notice: "Supporter told",
      office_told: "MP's office told",
    } as Record<string, string>,
    columns: {
      created: "Written",
      sent: "Sent",
      from: "From",
      to: "To",
      campaign: "Campaign",
      // The share of the sent letter's words that weren't in the campaign's draft.
      ownWords: "Own words",
      backend: "Backend",
      status: "Status",
      replied: "Replied",
      history: "History",
    },
    // A letter's own words, as a percentage of its words.
    ownWords: (share: number) => `${Math.round(share * 100)}%`,
    // What sent a letter: pauseai.info's old form, whose letters are copied from Airtable, or this site, by Postmark
    // or by a staff member's Gmail.
    backends: { airtable: "Airtable", postmark: "Postmark", gmail: "Gmail" },
    // The filter by the MP's markers, which are the politicians list's.
    mpFlag: "MP marked",
  },
  // The notes on a supporter's or a politician's page, and the form to add one.
  notes: {
    title: "Notes",
    none: "No notes yet.",
    // After who wrote it and when, once it's been edited.
    edited: "edited",
    // The field's name, for a screen reader.
    note: "Note",
    // Under a note's buttons, when the server wouldn't change it: its day is up.
    tooLate: {
      edit: "Notes can only be edited for 24 hours.",
      delete: "Notes can only be deleted for 24 hours.",
    },
    // The button that opens the field to write one, and the one that closes it unsent.
    write: "Write a note",
    cancel: "Cancel",
    add: "Add note",
    edit: "Edit",
    save: "Save",
    delete: "Delete",
    // Under the field on a supporter's page: what a note about them should be.
    guidance:
      "Only write notes you'd be happy for them to read (as they can via GDPR). Avoid writing about health, beliefs or private life.",
  },
  changes: {
    // Over the list, for an admin without the supporters permission.
    withheld: "Entries about supporters are not shown, as you don't have the supporters permission.",
    title: "Audit log",
    // Under the title.
    intro: "Every action taken by staff or by syncing",
    // Over the list: how many entries there are.
    total: (n: number) => count(n, "entry", "entries"),
    none: "No entries match.",
    // The search box: what it searches. The details include whom an entry is about.
    search: "Who, what or details",
    // The column of the day, before the time.
    day: "Date",
    at: "When",
    actor: "Who",
    action: "What",
    details: "Details",
    // The details as they were logged.
    json: "JSON",
    // In the details: someone no longer here (erased, or never named), by their ID.
    gone: (id: string) => `#${id}`,
    noPermissions: "No permissions",
    // A field with nothing in it, before or after an edit.
    empty: "(none)",
    // A mark, on or off, before or after an edit.
    on: "on",
    off: "off",
    // Each logged field's name, before its value, where the politician fields' names don't cover it.
    labels: {
      airtableId: "Airtable",
      importantTarget: "Important target",
      personalConnection: "Personal connection",
      address: "Address",
      note: "Note",
      reference: "Request",
      reason: "Reason",
      kind: "Kind",
      status: "Status",
      campaign: "Campaign",
      date: "Date",
      from: "Before",
      to: "Permissions",
      permissions: "Permissions",
      pdfUrl: "PDF",
      error: "Error",
      eventId: "Event",
      owner: "Owner",
      previous: "Before",
      url: "Google Doc",
    } as Record<string, string>,
    // A saved filter saved, changed or deleted: which list it's on, and its ID, never its name.
    savedFilter: (list: string, id: string) => `${list}, saved filter ${id}`,
    // A held MP import decided, linked to the import's page.
    run: (id: string) => `Import run ${id}`,
    // After each number an import, a sync, an erasure or the end of sessions logged: what it counted, for one and for more.
    counts: {
      added: () => "added",
      removed: () => "removed",
      changed: () => "changed",
      matched: () => "matched",
      imported: () => "imported",
      heldBack: () => "held back",
      alreadySet: () => "already signed",
      problems: (n: number) => plural(n, "problem", "problems"),
      lumaUsers: (n: number) => plural(n, "Luma person", "Luma people"),
      formEntries: (n: number) => plural(n, "form entry", "form entries"),
      letters: (n: number) => plural(n, "letter", "letters"),
      members: (n: number) => plural(n, "member record", "member records"),
      proxies: (n: number) => plural(n, "proxy", "proxies"),
      messages: (n: number) => plural(n, "message in the letters inbox", "messages in the letters inbox"),
      sessions: (n: number) => plural(n, "session", "sessions"),
    } as Record<string, (n: number) => string>,
  },
};

/** Each job in the import log, by the title of its card on the Scheduled jobs page and of its own page. */
export const jobTitles: Record<ImportJob, string> = {
  ...politiciansCopy.politicianImports.titles,
  "import-controlai": staffCopy.controlAi.title,
  "import-controlai-statement": staffCopy.controlAiStatement.title,
  "import-luma": staffCopy.luma.title,
  "import-civicrm": staffCopy.civicrm.title,
  "read-gmail": staffCopy.gmailReading.title,
  "send-mailings": staffCopy.sending.title,
  "tidy-logs": staffCopy.tidying.title,
};
