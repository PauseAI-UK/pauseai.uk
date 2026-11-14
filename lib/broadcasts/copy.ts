// The words of broadcasts to supporters, by email and WhatsApp, that the
// server or pure code uses, as well as the staff pages: the pages for
// broadcasts, the problems of sending them and of WhatsApp, and the emails
// to staff about them. The staff pages read them here too, as they have no
// words of their own.
import { count } from "@/lib/content/plural";
import { mailingsCopy } from "@/lib/mailings/copy";
import { daysInWords, FAILURES_TO_STOP, SENDING_DAYS, WAIT_DAYS } from "./days";

/** What one supporter's copy of a broadcast is, by how it went: the first word of its page's title, and its step of the trail above it. */
const copyKind = (channel: "email" | "text") => (channel === "email" ? "Email" : "Text");

export const broadcastsCopy = {
  // The pages for broadcasts, emails and texts to supporters: from the supporters list, the writer, the list of them
  // and each one's page; each supporter's copy of one is a message.
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
    // The choice of what sends an email, from the one address it's from: each as "address, by what"
    // (mailingPages.fromOption), one that can't be chosen yet greyed out.
    fromAccount: "Account",
    sendBy: {
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
  // What went wrong without stopping the work (lib/server/problems.server.ts). Each can happen in a job or not:
  // in a job, staff see it on the job's page and in the email; not in one, it's kept as an error
  // (lib/server/errors-seen.server.ts), on the errors page and emailed to staff. whatsAppWebhookNotRecorded
  // is in no job.
  problems: {
    // Sending a broadcast: CiviCRM didn't answer its check of the addresses, so it waits (staff are told by email).
    civicrmCheckFailed: "CiviCRM didn't answer, so a broadcast is waiting to send",
    // WhatsApp's API didn't answer when asked for our number, so no text could be sent or scheduled just then.
    whatsAppUnanswered: "WhatsApp didn't answer, so no text could go just then",
    // A text's new words couldn't be sent to WhatsApp for approval, or taken back from it.
    templateNotSent: (name: string) => `WhatsApp didn't take template ${name} for approval`,
    templateNotDeleted: (name: string) => `WhatsApp didn't delete template ${name}, which was withdrawn here`,
    // The text answering a reply of "stop" didn't go, though the stop is kept.
    stopNotAnswered:
      "A supporter replied STOP and their texts are stopped, but our WhatsApp reply confirming it failed to send",
    // What a problem names a supporter's copy of a broadcast as, and our answer to a reply.
    copyOf: (id: number) => `Broadcast copy ${id}`,
    answerTo: (id: number) => `The answer to reply ${id}`,
    // WhatsApp gets an error, so it sends the webhook again.
    whatsAppWebhookNotRecorded: "A WhatsApp webhook couldn't be recorded",
  },
  // The emails to staff (lib/server/notifications.server.ts).
  notifications: {
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
      // How to send it to those it didn't reach: the button on its page (mailingsCopy.mailingPages.resume).
      resume: `To send it to them, press “${mailingsCopy.mailingPages.resume}” on its page.`,
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
        const words = broadcastsCopy.notifications.broadcastGaveUp;
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
  },
};
