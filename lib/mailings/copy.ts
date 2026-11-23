// The words of mailings that the server or pure code uses, as well as the
// staff pages: a mailing's editor and its merge fields, and the pages for
// writing one and its own page. How each copy of one went is letters'
// (lib/letters/copy.ts). The staff pages' own are in
// app/(staff)/staff/_components/mailings/copy.ts.
import { letterEditorCopy } from "@/lib/content/letter-editor";
import { count, plural } from "@/lib/content/plural";

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
    // In the toolbar, pressed while the cursor is in such a part: pressing it takes the part out of its box.
    onlyThose: "Only those",
    // The same, in a part everyone but some get.
    exceptThose: "Except those",
    // Under a whole line or more selected in a part: what takes the lines out of it, for everyone.
    remove: {
      onlyFor: "Remove only those",
      except: "Remove except those",
    },
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
      // A draft changed elsewhere: by someone else, by you in another tab, or by being scheduled.
      conflict:
        "This draft changed somewhere else since you opened it, so your last change wasn't saved. Reload the page to see it as it is now.",
    } as Record<string, string>,
    // In the window's corner, whether the draft is saved; or, for a broadcast whose Consent was just picked, that
    // who it goes to is still being counted.
    savePill: {
      calculating: "Calculating…",
      saving: "Saving…",
      saved: "Saved",
      failed: "Couldn't save. Make another change to try saving again.",
      conflict: "Not saved. It changed elsewhere.",
      outdated: "Not saved. Reload the page first.",
    } as Record<string, string>,
    deleteDraft: "Delete draft",
    // At the top right of a mailing's page: a new draft that copies it.
    copyMailing: "Copy mailing",
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
    // Who's left out: each part only when there are some, the first saying of whom.
    // Of those ticked, or for a mailing from before ticks, those its filter found.
    leftOut: (noAddress: number, blocked: number, ticked = false) => {
      const of = ticked ? "of the ticked politicians" : "of the politicians the filter found";
      const parts: [number, string][] = [
        [noAddress, plural(noAddress, "has no email address", "have no email address")],
        [blocked, plural(blocked, "has a blocked address", "have blocked addresses")],
      ];
      const said = parts
        .filter(([n]) => n > 0)
        .map(([n, says], i) => (i === 0 ? `${n} ${of} ${says}` : `${n} ${says}`));
      return `${said.join(", and ")}. Press "Leave them out" to remove them.`;
    },
    leftOutReasons: {
      "no-address": "no email address",
      blocked: "address blocked",
    } as Record<string, string>,
    // Under Who, a warning that can be sent past: some it goes to have already answered its ask, each answer
    // with how many gave it, as "2 declined".
    // Of those ticked, or for a mailing from before ticks, those its filter found, as leftOut says.
    alreadyAnswered: (n: number, ask: string, answers: string[], ticked = false) =>
      `${n} ${ticked ? "of the ticked politicians" : "of the politicians the filter found"} ${plural(n, "has", "have")} already given an answer about ${ask} (${answers.join(", ")}). Press "Leave them out" to remove them.`,
    alreadyAnsweredEach: (n: number, answer: string) => `${n} ${answer.toLowerCase()}`,
    // Under a warning about who a mailing is to (those left out, those who already answered): opens the list of them.
    whoTheyAre: "Who they are",
    // The button beside Who they are under each warning about who a draft is to: unticks those it's about.
    leaveThemOut: "Leave them out",
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
    // The lists of mailings and of broadcasts, their headings, in order (mailingGroups): those scheduled; those
    // going out now, or waiting; the drafts; those sent or stopped since they started sending in the last day.
    scheduled: "Scheduled",
    sending: "Sending",
    drafts: "Drafts",
    justFinished: "Just finished",
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
    // How long till one scheduled sends (staffVocabulary.dueIn), large, over what goes (scheduledLine).
    sendsIn: (inWords: string) => `Sends ${inWords}`,
    // In a list, in place of how long till it goes, for one going out now.
    sendingNow: "Sending now",
    scheduledLine: (n: number, from: string) => `${count(n, "email", "emails")} from ${from}`,
    changeTime: "Change the time",
    saveTime: "Change it",
    // Takes a scheduled mailing back to a draft, sending nothing.
    unschedule: "Unschedule",
    stopSending: "Stop sending",
    sentLabel: "Sent",
    // The list of mailings: when a draft was last saved.
    savedAt: (when: string) => `Saved ${when}`,
    // In the list of mailings or broadcasts, where each stands, as a sentence after a dot in its colour: a draft,
    // scheduled, stopped by us, sent. One sent says only that sending is over and who it was for: some may have
    // bounced, been blocked or opted out, which the counts under it say.
    standing: {
      draft: (n: number) => `Draft, to ${count(n, "person", "people")}`,
      scheduled: (n: number) => `Scheduled to ${count(n, "person", "people")}`,
      stopped: (n: number, of: number) => `Stopped after ${n.toLocaleString("en-GB")} of ${of.toLocaleString("en-GB")}`,
      sent: (n: number) => `Finished, to ${count(n, "person", "people")}`,
    },
    // The bar of how far a mailing sending has got, and once it's sent, how many have answered its ask.
    sendingBar: (n: number, of: number) => `Sending: ${n} of ${of} done`,
    answeredBar: (n: number, of: number) => `Sent: ✓ ${n} of ${of} answered the ask`,
    // The band at the top of a mailing's page: when it started sending, and who sent it.
    started: "Started",
    by: (who: string) => `by ${who}`,
    // Over a mailing's recipients filtered by one of its counts, back to them all.
    showEveryone: "Show everyone",
    // In a mailing's email, who it's to: each recipient, as it's a letter to many.
    toEach: "Each recipient, by name and address",
    emailTitle: "The email",
    // Each address a mailing or a broadcast's email can go from, with what sends it: Postmark, or a staff member's Gmail.
    fromOption: (address: string, backend: string) => `${address}, by ${backend}`,
    // What sends an email: by name.
    sendBy: { names: { gmail: "Gmail", postmark: "Postmark" } },
    // What will go, as facts with their labels: how many, from whom and how, when, and a text's cost, on a
    // mailing's Send and a broadcast's.
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
    // Beside a broadcast that stopped by itself: sets it going again, to those it didn't reach. The email
    // about one stopping names it.
    resume: "Resume sending",
  },
  // Answering a reply in a thread, a broadcast's or a mailing's letter's: the folded draft at the foot of the
  // thread, the draft opened, and why one didn't go; what staff can record it as instead; and who dealt with it.
  answers: {
    reply: "Reply",
    // Reply, under our last answer to their latest reply.
    followUp: "Follow up",
    answerLabel: "Your reply",
    send: "Send reply",
    sending: "Sending…",
    discard: "Discard",
    notSent: {
      blank: "The reply is empty.",
      gone: "Their reply has been deleted, so this can't answer it.",
      blocked: "Not sent: their address is blocked, as email to it bounced or they marked ours as spam.",
      failed: "Error sending via Gmail. Try again, or reply in Gmail itself.",
      window: "Not sent: it's more than a day since their messge, so WhatsApp won't let us reply.",
    },
    nothing: "Nothing to do",
    nothingDone: (by: string, when: string) => `Nothing to do, said ${by}, ${when}`,
    // Our answer in the thread: who sent it.
    sentBy: (by: string) => `Sent by ${by}`,
  },
};
