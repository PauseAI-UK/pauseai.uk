// The words of broadcasts to supporters, by email and WhatsApp, that the
// server or pure code uses, as well as the staff pages: the pages for
// broadcasts, the problems of sending them and of WhatsApp, and the emails
// to staff about them. The staff pages read them here too, as they have no
// words of their own.
import { count, plural } from "@/lib/content/plural";
import { emailCopy } from "@/lib/email/copy";
import { mailingsCopy } from "@/lib/mailings/copy";
import { defineProblems, type SafeText } from "@/lib/problems";
import { daysInWords, FAILURES_TO_STOP, WAIT_DAYS } from "./days";

/** What one supporter's copy of a broadcast is, by how it went: the first word of its page's title, and its step of the trail above it. */
const copyKind = (channel: "email" | "text") => (channel === "email" ? "Email" : "Text");

export const broadcastsCopy = {
  // The pages for broadcasts, emails and texts to supporters: from the supporters list, the writer, the list of them
  // and each one's page; each supporter's copy of one is a message.
  broadcastPages: {
    title: "Broadcasts",
    // At the top right of a broadcast's page: a new draft that copies it.
    copyBroadcast: "Copy broadcast",
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
    // The preview's title over new words, as it's where they go to WhatsApp for approval.
    previewNew: "Preview and approval",
    willGet: (n: number, channel: "email" | "text") =>
      `${count(n, "supporter", "supporters")} will be ${channel === "email" ? "emailed" : "texted"}.`,
    // In its place, beside a spinner, while who it goes to is being worked out afresh.
    counting: "Counting who it will go to",
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
    // A text's top, over its words: a choice of the card for the words' first link, or a map of a place.
    textTop: {
      label: "Header",
      none: "None",
      linkPreview: "Link preview",
      picture: "Picture",
      place: "Place",
    },
    // Choosing a text's place: a box for a Google Maps link or words to search for, its button, the places it
    // found; then the place's name and address under the map, its map's link to check its pin, and taking it off.
    placeChooser: {
      find: "⁂ Search for a place, or paste a Google Maps link",
      findButton: "⁂ Find",
      found: "⁂ Places found",
      none: "⁂ No place found. Try other words, or a Google Maps link.",
      name: "⁂ Name",
      address: "⁂ Address",
      checkMap: "⁂ Check it on a map",
      remove: "⁂ Take the place off",
    },
    // Choosing a text's picture: the picture chosen, the box to drop or paste one on, its button, why a file won't
    // do, and what can change once approved.
    pictureChooser: {
      shown: "⁂ The picture at the top of the text",
      drop: "Drop or paste a picture here",
      remove: "⁂ Take the picture off",
      choose: "Add picture",
      refusals: {
        "not-picture": "⁂ WhatsApp takes a JPEG or PNG picture. Choose one of those.",
        "too-big": "⁂ That picture is too big. Choose one of 4 MB or less.",
      },
      changeable: "⁂ You can change the picture after WhatsApp approves the text.",
    },
    // A text's buttons, under its words: their heading; each button's kind, a reply or a link, its words, a link's
    // address, and its Remove; and adding one.
    replyButtons: {
      heading: "Buttons",
      reply: "Reply",
      link: "Link",
      words: "On the button",
      address: "https://...",
      remove: "Remove",
      addReply: "+ Reply button",
      addLink: "+ Link button",
    },
    // A text's two versions, once it has a condition: how many templates they go to WhatsApp as, and why there's
    // only one condition.
    textVersions: {
      templates: (n: number) => `⁂ Goes to WhatsApp as ${n} template${n === 1 ? "" : "s"}`,
      submit: (n: number) => (n === 1 ? "Send for approval" : `Send ${n} templates for approval`),
    },
    // A second version's template, as it's named for its list: the text's name, then who it's for.
    versionTemplateName: (name: string, who: string) => `⁂ ${name}, for those who ${who}`,
    // A template in the dropdown, and under the one chosen: a tag by its name when nothing has ever had it; on a line,
    // who made it; when it was last sent and to how many, or else when it's first scheduled for, or else when it was
    // approved; and how many other drafts have it, if any do.
    templateFacts: {
      unused: "Unused",
      approved: (day: string) => `Approved ${day}`,
      scheduled: (day: string) => `Scheduled for ${day}`,
      used: (day: string, n: number) => `Last sent ${day}, to ${count(n, "person", "people")}`,
      drafts: (n: number) => `In ${count(n, "draft", "drafts")}`,
    },
    // Under the template chosen: its words as new words, under a new name, to send for approval; and deleting it,
    // from WhatsApp too, offered only while no other broadcast has it.
    editTemplate: "Edit as a new template",
    copyName: (name: string, n: number) => `${name} (${n})`,
    deleteTemplate: "Delete template",
    deleteRefused: {
      used: "Another broadcast has used this template since, so it wasn't deleted.",
      gone: "This template has already been deleted.",
      failed: "WhatsApp gave an error while deleting the template. Try again later.",
    } as Record<string, string>,
    newTemplateHint: "WhatsApp needs to approve the new template before it can go. This takes up to 24 hours.",
    // As the email of it says it (notifications.templateRejected).
    rejected: (reason: string) =>
      `WhatsApp rejected the template with ${reason} Change the message and send for approval again.`,
    // Preview.
    chooseTemplate: "Choose a template to see the text here.",
    findRecipient: "Show a fake recipient who…",
    // Under the text, when its first link is to Google Maps, whose card WhatsApp gets wrong in a template's text.
    mapsFirst:
      "WhatsApp shows a broken preview for a Google Maps link when it's the first link in a text. Put another link before it, such as the event's page.",
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
    // The choice of what sends an email, from the one address it's from: each as "address, by what"
    // (mailingPages.fromOption), any that can't be chosen yet greyed out.
    fromAccount: "Account",
    sendBy: {
      // Under the choice, by Gmail: how many more its account can send today, and how long this one would take.
      room: (address: string, remaining: number, days: number) =>
        days === 1
          ? `${address} can send ${remaining.toLocaleString("en-GB")} more emails today, enough for this broadcast.`
          : `${address} can send ${remaining.toLocaleString("en-GB")} more emails today, so this broadcast will take ${days} days.`,
      notConnected: (address: string) => `${address}'s Gmail isn't connected. Log in as ${address} to connect it.`,
      // Under the choice, by Postmark, which has no daily limit.
      postmark: "Postmark has no daily limit, so this will go in one go.",
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
      `Waiting for WhatsApp approval, sent on ${at} by ${by}. You can no longer edit the template. If you're confident enough to send the message without a test send, you can schedule it so it goes automatically when approved.`,
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
      "same-words": "An approved template already has these words.",
      "no-place": "⁂ Choose the place its map shows.",
      "button-no-words": "⁂ Give each button its words.",
      "button-too-long": "⁂ Shorten the words on a button to 25 characters or fewer.",
      "link-no-address": "⁂ Give each link button the address it opens.",
      "link-not-address": "⁂ A link button's address must be a web page's, starting https://.",
      "too-many-links": "⁂ A text can have two link buttons at most.",
      "too-many-buttons": "⁂ A text can have three buttons at most.",
      "buttons-mixed": "⁂ A text's buttons must all be reply buttons, or all link buttons.",
      "no-picture": "⁂ Add the picture for its top.",
      "not-connected": "The Gmail inbox it's sent from isn't connected.",
      "too-slow": "That's too many to send before it stops trying. Send it to fewer people, or keep trying for longer.",
      "no-number": "No WhatsApp number is configured, so texts can't be sent.",
      "no-time": "Choose what time it will be sent.",
      "time-passed": "You can't send it into the past!",
      "cannot-send": "Sending isn't built yet.",
    } as Record<string, string>,
    // What a broadcast's buttons and forms say when the site refuses them (lib/form-result.ts), by the reason it
    // gives, where the page has no other words for it. Those said at the top of the page are said once the page
    // has caught up with what changed.
    refusals: {
      // At the top of the page, after a draft's Consent is chosen, its test copy is sent or Schedule is pressed, when
      // the draft was deleted, or scheduled by someone else, since the page loaded.
      draft: { gone: "Can't do that, because the draft was deleted or scheduled." },
      // At the top of the page, after Withdraw approval request is pressed when the template was no longer waiting
      // for WhatsApp, as WhatsApp has decided on it or someone else withdrew it first.
      withdraw: { gone: "Nothing to withdraw, because the template is no longer waiting for WhatsApp to approve it." },
      // At the top of the page, after Unschedule, Stop sending or Give up is pressed on a broadcast with nothing
      // left to stop, as someone else stopped it first or it had all gone.
      stop: { gone: "This broadcast is no longer scheduled or sending, so there was nothing to stop." },
      // At the top of the page, after Resume sending is pressed on a broadcast that isn't stopped any more, as
      // someone else resumed it first.
      resume: { gone: "This broadcast is no longer stopped, so there was nothing to resume." },
      // At the top of the page, after Copy broadcast is pressed on a broadcast deleted since the page loaded.
      copy: { gone: "This broadcast has been deleted, so it can't be copied." },
      // Change the times' form.
      reschedule: {
        // Under its fields, when the time chosen has passed, or it would have stopped trying already, as it can
        // while the form stays open.
        "too-soon": "Those times are in the past, choose later ones.",
        // At the top of the page, when the broadcast was no longer scheduled or sending, as someone else stopped
        // it or it had all gone.
        gone: "This broadcast is no longer scheduled or sending, so its times can't be changed.",
      },
      // At the top of a Thread's page, after Nothing to do is pressed or an opt-out is recorded on a reply someone
      // else has dealt with, or that has been deleted, since the page loaded.
      deal: { gone: "Someone has already dealt with this reply." },
    },
    // When it goes: when it stops trying to reach those it hasn't, and the button that changes it; once changing
    // it, under its day and time, what to set it to.
    keepsTryingUntil: "Keeps trying until",
    // On its page, in place of the mailings' Change the time, as it changes both; and its bubble's button.
    changeTimes: "Change the times",
    saveTimes: "Change them",
    // How long it keeps trying, as a sentence with its choice in it: before the choice, each choice (half a day,
    // or days), and after it, until when.
    keepsTryingFor: "Keeps trying for",
    finishChoice: (minutes: number) => (minutes < 24 * 60 ? "12 hours" : count(minutes / (24 * 60), "day", "days")),
    untilWhen: (when: string) => `until ${when}`,
    // The "?" after it, named, and what it opens, a paragraph each: why it keeps trying, and what to choose.
    whyKeepsTrying: "Why it keeps trying",
    keepsTryingWhy: [
      "Some people can't be reached straight away, because of sending limits, outages, or WhatsApp holding back marketing texts.",
      "We keep trying for this long, then stop. If the message is only meaningful for a limited time, for example it is about an event, then change the stop time.",
    ],
    // Under Schedule, for a text whose template WhatsApp hasn't approved: scheduling sends it for approval, if it
    // isn't with WhatsApp already.
    schedulesForApproval: (templates: number) =>
      templates === 1
        ? "Scheduling also sends the template to WhatsApp for approval."
        : `⁂ Scheduling also sends the ${templates} templates to WhatsApp for approval.`,
    // Under its time, for a text whose template WhatsApp hasn't approved, due in less than a day.
    approvalSoon:
      "WhatsApp can take 24 hours to approve a template, but you've scheduled the broadcast to start sooner than that. It will still be sent, but late, if approval is slow.",
    // Its page.
    // Under where one scheduled stands, while WhatsApp hasn't approved its template: who sent it, when, and that it
    // goes at its time once approved, or, past its time, as soon as it is.
    approvalStrip: (by: string, at: string, due: boolean) =>
      `Waiting for WhatsApp to approve the template, sent by ${by} ${at}. ${due ? "It goes as soon as it's approved." : "It goes at its scheduled time once it's approved."}`,
    scheduledLine: (n: number, channel: "email" | "text", from: string) =>
      `${channel === "email" ? count(n, "email", "emails") : count(n, "text", "texts")} from ${from}`,
    textTitle: "The text",
    emailTitle: "The email",
    // In the list of broadcasts, where each stands, where a broadcast has more to say than a mailing
    // (mailingPages.standing), as a sentence after a dot in its colour: its words with WhatsApp, approved or rejected by it,
    // stopped by itself and why.
    standing: {
      waiting: "Waiting for WhatsApp approval",
      approved: (n: number) => `WhatsApp approved, to ${count(n, "person", "people")}`,
      rejected: "WhatsApp rejected",
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
        approval: () => "WhatsApp never approved the template, so it wasn't sent",
        failing: (n: number, of: number) =>
          `Kept failing to send: stopped after ${n.toLocaleString("en-GB")} of ${of.toLocaleString("en-GB")}`,
      } as Record<string, (n: number, of: number) => string>,
    },
    // A reply under our email on its Thread: what staff can record it as, and what they did.
    replies: {
      topics: (topics: string) => `${topics} (this email)`,
      bulk: "All bulk email",
      // Answering it, Nothing to do, and who sent our answer, as a mailing's letter's thread says them.
      ...mailingsCopy.answers,
      // In a copy's history, under Recorded as an opt-out: How they told us (recordOptOut.how), and this.
      how: "By replying to this email",
      // Over the draft, to someone with "Do not email": it goes all the same, as it answers them.
      doNotEmail: "They've opted out of all email. Only answer what they asked.",
      // One a staff member wrote in the mailbox's Gmail rather than here, which says only the mailbox.
      sentInGmail: (account: string) => `Sent in ${account}'s Gmail`,
      // Under their message on WhatsApp: the emoji to put on it, read out by a screen reader as this; who put an
      // emoji on a message and when, ours on theirs or theirs on ours; and why one of ours didn't go.
      react: "React on WhatsApp",
      reactedBy: (emoji: string, by: string, when: string) => `${by} reacted ${emoji}, ${when}`,
      // In the copy's history: ours, with who on a line under it; theirs, with, under it, when they took it back.
      historyReacted: (emoji: string) => `We reacted ${emoji}`,
      historyTheyReacted: (emoji: string) => `They reacted ${emoji}`,
      historyReactionRemoved: "Removed reaction",
      reactionNotSent: "That didn't send to WhatsApp. Try again.",
      stillSending: (account: string) => `Unsure if this sent. Check ${account}'s Sent folder in Gmail.`,
      optedOut: (by: string, when: string) => `Recorded as an opt-out by ${by}, ${when}`,
      // The site's own: its answer to a STOP, the STOP recorded as an opt-out, and who in the history.
      sentAutomatically: "Sent automatically",
      optedOutAutomatically: (when: string) => `Recorded as an opt-out automatically, ${when}`,
      automatically: "Automatically",
      // In its history.
      // Each with who, on a line under it.
      historyOptedOut: "Recorded as an opt-out",
      historyNothing: "Marked as nothing to do",
      historyAnswered: "We replied",
      // A number in a text's history, after whose it is.
      numberOf: (name: string, number: string) => `${name} (${number})`,
      // What WhatsApp said became of our reply to a text, in the copy's history.
      historyOurs: {
        delivered: "Our reply delivered",
        read: "Our reply read",
        failed: "Our reply failed",
      } as Record<string, string>,
      // Under a text's bubble, ours or the broadcast's, that WhatsApp said it couldn't deliver, with its why if it gave one.
      undelivered: (why: string | null) =>
        why ? `WhatsApp couldn't deliver this: ${why}` : "WhatsApp couldn't deliver this",
      noText: "No text to show. Open it in Gmail.",
      // A reply to a text that's more than words, in grey over whatever words it came with, such as a photo's
      // caption: what it is. Its file isn't kept, so the site can't show that; a place and a contact card are
      // kept whole.
      kinds: {
        image: "Photo, which can't be shown here",
        video: "Video, which can't be shown here",
        document: "Document, which can't be shown here",
        audio: "Audio file, which can't be shown here",
        voice: "Voice note, which can't be shown here",
        sticker: "Sticker, which can't be shown here",
        location: "A location they shared",
        button: "⁂ Tapped a button",
        contacts: "A contact card they shared",
      } as Record<string, string>,
      // Any other kind, by WhatsApp's name for it.
      kindOther: (type: string) => `Message (${type}), which can't be shown here`,
      // A reaction of theirs to one of our messages, whose emoji is on it, in the thread as who reacted and when
      // (reactedBy): one from before emojis were kept, before when; and, on a line under, when they took it back,
      // or put another in its place. In words, as a reply's kept, over its emoji.
      reacted: "Reacted",
      reactedNotKept: "A reaction, emoji lost",
      reactionRemoved: (when: string) => `Removed reaction · ${when}`,
      // For a reply to a text: an opt-out of every text, in place of all bulk email; how they told us.
      allTexts: "Every text",
      topicsText: (topics: string) => `${topics} (this text)`,
      howText: "By replying to this text",
      // A text's reply can be answered in WhatsApp only within a day of it.
      windowClosed: "It's more than a day since their message, so WhatsApp won't let us reply.",
    },
    // A broadcast that can't go yet, on its page: CiviCRM's check failed, with what it last said, or no pull has
    // finished for a day.
    waiting: (reason: "civicrm" | "pull", stops: string, said: string | null) =>
      reason === "civicrm"
        ? `Waiting, as CiviCRM's check of who can be sent this failed. It last said: ${said?.replace(/\.$/, "") ?? "nothing"}. This will send once the check works, or give up on ${stops}.`
        : `Waiting for an import from CiviCRM, so can check live suppression. This will send once one finishes, or give up on ${stops}.`,
    // Where a scheduled broadcast says when it sends, while it waits for CiviCRM, past its time.
    waitingDue: "Waiting for CiviCRM",
    gaveUp: `Stopped after ${daysInWords(WAIT_DAYS)}, as CiviCRM couldn't be reached.`,
    // The same, for one that reached its finish (keepsTrying) before it had all gone.
    gaveUpLimit: "Stopped trying, before everyone got it.",
    // The same, for a text whose template WhatsApp paused or disabled, for its quality.
    gaveUpTemplate: "Stopped, as WhatsApp paused or disabled the template it used.",
    // The same, for one that reached its finish while it waited for CiviCRM.
    gaveUpLate: "Stopped trying while CiviCRM was down.",
    // The same, for a text that reached its finish before WhatsApp approved its template.
    gaveUpApproval: "Never sent, as WhatsApp didn't approve the template before it stopped trying.",
    // The same, for one so many of whose copies failed one after another that it stopped (FAILURES_TO_STOP).
    gaveUpFailing: `Stopped, as the last ${FAILURES_TO_STOP} emails or texts it tried all failed. Each one's page says why.`,
    // On one sending that has paused after its sends failed, or what sends it couldn't for now, till when it tries again.
    resting: (until: string) => `Paused, as sending failed. It will try again at ${until}.`,
    // On one sending by Gmail that can send no more today, under the bar that says how far it's got.
    moreTomorrow: "Gmail has reached today's limit. The rest will be sent tomorrow.",
    // The same, for a text, our number having texted as many people as WhatsApp lets it in a day.
    moreTomorrowText: "Our WhatsApp number has reached today's limit. The rest will be sent tomorrow.",
    // On one sending whose only texts left are those WhatsApp held: how many, when the first is next tried, and
    // the day it stops if they still haven't gone.
    heldLeft: (n: number, next: string, stops: string) =>
      `WhatsApp has delayed ${plural(n, "the last text", `the last ${n} texts`)}, as ${plural(n, "that person has", "those people have")} had too many marketing messages from businesses recently. It will try again on ${next}, and give up on ${stops}.`,
    // On one all sent but for emails delayed by a soft bounce or Postmark's silence: how many, that their tries
    // can't be stopped, and the day those still delayed become errors, or now, with Give up.
    delayedLeft: (n: number, stops: string) =>
      n === 1
        ? `Postmark has an email it hasn't delivered yet and is still retrying. We can't stop it. If it's not delivered by ${stops} it will count as an error, or click Give up to count it as an error now.`
        : `Postmark has ${n} emails it hasn't delivered yet and is still retrying. We can't stop these. Any not delivered by ${stops} will count as errors, or click Give up to count them as errors now.`,
    // In place of Stop sending, on one all sent but for delayed emails: stops waiting for them, counting them as errors.
    giveUp: "Give up",
    // One with nothing going out for now, though it's sending or past its time (SendingPause), in a few words. In
    // the list, in place of "Sending now" over when it went: the word, over what it waits for or till when. And
    // over its bar, in the list and on its page, in place of "Sending:".
    paused: {
      word: "Waiting",
      forCiviCrm: "for CiviCRM",
      till: (when: string) => `till ${when}`,
      tillTomorrow: "till tomorrow",
      forDelayed: "for delivery",
      bar: (n: number, of: number) => `Waiting: ${n} of ${of} done`,
    },
    recipientsTitle: "Recipients",
    recipientsCount: (n: number) => count(n, "recipient", "recipients"),
    noRecipients: "No recipients here.",
    // In place of the recipients of one scheduled, as sending finds them.
    recipientsNow: "Who it would go to if sent now. May change by the time it is sent.",
    // The recipients' columns; the last, when its provider last said anything of their copy.
    columns: { who: "Supporter", status: "Status", changed: "Last change" },
    erased: "Erased supporter",
    threadLink: "Thread →",
    // Under a copy WhatsApp held: when it's next tried, as a date and time.
    heldTill: (when: string) => `Tries again ${when}`,
    // Thread: one copy's page, titled as a letter's is.
    copyTitle: (channel: "email" | "text", to: string) => `${copyKind(channel)} from PauseAI UK to ${to}`,
    // Its own step of the trail above its page, after the broadcast: the title's first word.
    copyCrumb: copyKind,
    // Under a text's words folded at five lines, WhatsApp's own words for opening the rest.
    readMore: "Read more",
    // Its history: each thing its provider reported.
    events: {
      sent: "Sent",
      delivered: "Delivered",
      read: "Read",
      failed: "Failed",
      bounced: "Bounced",
      // Postmark couldn't deliver it for now, and is trying again.
      "soft-bounced": "Soft bounce",
      "opted-out": "Stopped",
      replied: "Replied",
    },
    facts: {
      from: "From",
      // The list everyone a broadcast is to is on: its channel and topic, from the Consent filter.
      list: "List",
      // Who a broadcast went to: how many, over the rest of the list's filters, which narrow those who said yes.
      to: (n: number) => `To ${count(n, "supporter", "supporters")}`,
    },
    // Under To, the list everyone it's to is on, as the Consent filter names it, then the channel.
    onList: (list: string, channel: "email" | "text") => `${list}, by ${channel === "email" ? "email" : "text"}`,
    // In To, when Consent is the only filter.
    everyoneOnList: "Everyone on the list",
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
        "bad-number": "their number isn't written in full, with + and its country code",
        suppressed: "PauseAI Global says not to email them",
        cancelled: "we stopped the broadcast",
        // Its broadcast stopped by itself.
        limit: "the broadcast stopped trying first",
        civicrm: `CiviCRM was down for ${daysInWords(WAIT_DAYS)}`,
        pull: `CiviCRM was down for ${daysInWords(WAIT_DAYS)}`,
        template: "WhatsApp paused the template",
        late: "the broadcast stopped trying while CiviCRM was down",
        approval: "WhatsApp never approved the template",
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
  // The emails to staff (lib/email/notifications.server.ts).
  notifications: {
    // A broadcast that can't go, as CiviCRM didn't answer its check, no pull has completed for a day, or WhatsApp
    // hasn't approved a text's template, to whoever scheduled it and the inbox, once: it goes by itself when it can,
    // or stops at `stops`.
    broadcastWaiting: {
      subject: (title: string) => `Not sent yet: ${title}`,
      body: (
        title: string,
        reason: "civicrm" | "pull" | "approval",
        said: string | null,
        stops: string,
        link: string,
      ) =>
        reason === "approval"
          ? `“${title}” was due to go, but WhatsApp hasn't approved its template yet.\n\nIt will send as soon as WhatsApp approves it. If that hasn't happened by ${stops}, it will be stopped without sending, and you'll get another email.\n\n${link}`
          : reason === "civicrm"
            ? `“${title}” was due to go, but hasn't been sent.\n\nWe check everyone with CiviCRM before sending to them, and the check failed. CiviCRM said: ${said ?? "nothing"}\n\nIt will send as soon as the check works. If that hasn't happened by ${stops}, it will be stopped, and you'll get another email.\n\n${link}`
            : `“${title}” was due to go, but hasn't been sent.\n\nWe check every address with CiviCRM before emailing it, and our import from CiviCRM hasn't worked for a day.\n\nYou don't need to do anything. It will send as soon as CiviCRM is back. If that hasn't happened by ${stops}, it will be stopped, and you'll get another email.\n\n${link}`,
    },
    // Replies to a broadcast's texts that nobody has dealt with for a couple of hours, to whoever made it and the
    // inbox, once each (lib/broadcasts/text-alerts.server.ts): who sent each, the hours left to answer it before
    // WhatsApp stops taking our words, and a link to its thread.
    textsWaiting: {
      subject: (n: number, title: string) => `${count(n, "text reply", "text replies")} to answer: ${title}`,
      body: (title: string, lines: string[]) =>
        `These replies to “${title}” are waiting for someone to answer them. WhatsApp lets us reply only within 24 hours of their message, so either reply to them or mark that nothing needs doing.\n\n${lines.join("\n")}`,
      line: (who: string, hours: number, link: string) => `- ${who}: ${count(hours, "hour", "hours")} left. ${link}`,
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
      subject: (title: string, reason: "civicrm" | "pull" | "approval" | "limit" | "template" | "late" | "failing") =>
        reason === "template"
          ? `Stopped, as WhatsApp paused the template it used: ${title}`
          : reason === "failing"
            ? `Stopped, as sending kept failing: ${title}`
            : reason === "approval"
              ? `Never sent, as WhatsApp didn't approve the template: ${title}`
              : reason === "limit" || reason === "late"
                ? `Stopped trying: ${title}`
                : `Stopped after ${daysInWords(WAIT_DAYS)}: ${title}`,
      // How to send it to those it didn't reach: the button on its page (mailingsCopy.mailingPages.resume).
      resume: `To send it to them, press “${mailingsCopy.mailingPages.resume}” on its page.`,
      // Why, for an email that reached its finish before it had all gone, in place of CiviCRM's sentence.
      whyGmailLimit: "It stopped trying before everyone got it, as Gmail rate limits what we can send.",
      // The same, for a text, held back by our WhatsApp number's daily limit, or by WhatsApp.
      whyWhatsAppLimit:
        "It stopped trying before everyone got it. Our WhatsApp number can only send so many a day, and WhatsApp holds back texts to people who've had a lot of marketing.",
      // Why, for a text whose template WhatsApp paused or disabled, for its quality.
      whyTemplate:
        "WhatsApp paused or disabled its template, as people blocked, reported or didn't read texts on it. Change the template before it goes again.",
      // Why, for one that reached its finish while it waited for CiviCRM.
      whyLate: "It stopped trying while CiviCRM was down, and we don't send to anyone without checking with it first.",
      // Why, for a text that reached its finish before WhatsApp approved its template: it was never sent.
      whyApproval: "WhatsApp didn't approve its template before it stopped trying, so it was never sent.",
      // Why, for one so many of whose copies failed one after another (FAILURES_TO_STOP): something may be wrong with what sends it.
      whyFailing: `The last ${FAILURES_TO_STOP} messages we tried to send all failed, so something may be fundamentally wrong. Check each copy and fix any problem before sending again.`,
      body: (
        title: string,
        reason: "civicrm" | "pull" | "approval" | "limit" | "template" | "late" | "failing",
        notReached: number,
        link: string,
        channel: "email" | "text",
      ) => {
        const words = broadcastsCopy.notifications.broadcastGaveUp;
        const why = {
          limit: channel === "text" ? words.whyWhatsAppLimit : words.whyGmailLimit,
          template: words.whyTemplate,
          late: words.whyLate,
          approval: words.whyApproval,
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
    // With how many texts on it were scheduled, and are drafts again.
    templateRejected: {
      subject: (name: string) => `WhatsApp rejected the template: ${name}`,
      body: (reason: string, words: string, links: string[], unscheduled: number) =>
        `WhatsApp rejected the template with ${reason}\n\n${unscheduled ? `${plural(unscheduled, "The broadcast using it was scheduled, so it's a draft again.", `${unscheduled} broadcasts using it were scheduled, so they're drafts again.`)}\n\n` : ""}Change it, and send it for approval again.\n\n${words}\n\n${links.join("\n")}`,
    },
  },
};

// What went wrong without stopping the work (lib/problems.ts). Each can happen in a job or not: in a job, staff see
// it on the job's page and in the email; not in one, it's kept as an error (lib/oversight/errors-seen.server.ts), on
// the errors page and emailed to staff. whatsAppWebhookNotRecorded is in no job.
export const broadcastProblems = defineProblems("broadcasts", {
  // Sending a broadcast: CiviCRM didn't answer its check of the addresses, so it waits (staff are told by email).
  civicrmCheckFailed: "CiviCRM didn't answer, so a broadcast is waiting to send",
  // WhatsApp's API didn't answer when asked for our number, so no text could be sent or scheduled just then.
  whatsAppUnanswered: "WhatsApp didn't answer, so no text could go just then",
  // A text's new words couldn't be sent to WhatsApp for approval, or taken back from it.
  templateNotSent: (p: { template: SafeText }) => `WhatsApp didn't take template ${p.template} for approval`,
  templateNotDeleted: (p: { template: SafeText }) =>
    `WhatsApp didn't delete template ${p.template}, which was withdrawn here`,
  // An approved template staff deleted, which WhatsApp then wouldn't: it's kept, as it was.
  approvedNotDeleted: (p: { template: SafeText }) => `WhatsApp gave an error while deleting template ${p.template}`,
  // The text answering a reply of "stop" didn't go, though the stop is kept.
  stopNotAnswered:
    "A supporter replied STOP and their texts are stopped, but our WhatsApp reply confirming it failed to send",
  // A supporter's copy of a broadcast, or our answer to a reply: something went wrong before it went, so it's
  // tried again; or it went, but recording that failed.
  copyNotSentYet: (p: { copy: number }) => emailCopy.sends.notSentYet(`Broadcast copy ${p.copy}`),
  copySentUnrecorded: (p: { copy: number }) => emailCopy.sends.sentUnrecorded(`Broadcast copy ${p.copy}`),
  answerNotSentYet: (p: { reply: number }) => emailCopy.sends.notSentYet(mailingsCopy.answers.answerTo(p.reply)),
  answerSentUnrecorded: (p: { reply: number }) =>
    emailCopy.sends.sentUnrecorded(mailingsCopy.answers.answerTo(p.reply)),
  // WhatsApp gets an error, so it sends the webhook again.
  whatsAppWebhookNotRecorded: "A WhatsApp webhook couldn't be recorded",
});
