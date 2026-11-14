// The words of mailings that the server or pure code uses, as well as the
// staff pages: a mailing's editor and its merge fields, the pages for writing
// one and its own page, and how each copy of one went. The staff pages' own
// are in app/(staff)/staff/_components/mailings/copy.ts.
import { letterEditorCopy } from "@/lib/content/letter-editor";
import { count } from "@/lib/content/plural";

export const mailingsCopy = {
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
  // How a copy of something sent to many went, a broadcast's to a supporter or a letter to a politician, in states
  // (lib/mailings/copy-states.ts; docs/domain-concepts.md, "How a copy went"). Each is one colour: red bad, amber sad, green
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
  // The pages for writing a mailing, its own page once it's scheduled, and the list of them.
  mailingPages: {
    // Who a mailing is to, when its filter has nothing chosen.
    everyone: "Every politician in office",
    whoLabel: "Who it's for",
    // A search, as a pill of who a mailing is to.
    searchPill: (typed: string) => `Search "${typed}"`,
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
    // Who a mailing's for, when everyone a filter found was ticked: that filter, the day, how many, then those
    // added and taken off since, by name. With more changes than a few, or no such filter, the names ticked.
    pickedFrom: (when: string, n: number) => `as found on ${when} (${n})`,
    pickedPlus: (name: string) => `plus ${name}`,
    pickedExcept: (name: string) => `except ${name}`,
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
    // In a mailing's email, who it's to: each recipient, as it's a letter to many.
    toEach: "Each recipient, by name and address",
    emailTitle: "The email",
  },
};
