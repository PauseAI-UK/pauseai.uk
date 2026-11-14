// The words of letters to politicians that the server or pure code uses, as
// well as the staff pages: letters and their list, every email to and from
// politicians, the letters inbox's reading, one-off emails, how a copy of
// something sent to many went, and the problems and notifications of
// sending letters. The staff pages' own are in
// app/(staff)/staff/_components/letters/copy.ts.
import { count, plural } from "@/lib/content/plural";
import { emailCopy } from "@/lib/email/copy";

export const lettersCopy = {
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
    // A recipient's letter that was personalised, which Airtable kept.
    personalised: "personalised",
    // A letter's own page: its facts beside the list's, and the way to read it as it was sent.
    detail: {
      subject: "Subject",
      sent: "Sent",
      mailing: "Mailing",
      personalised: "Personalised",
      historyTitle: "History",
      // The card of what the letter asks, when it makes an ask.
      ask: "Ask",
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
  // The letters inbox, which supporters' letters to MPs go from (lib/letters/letters-inbox-reading.server.ts).
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
    unmatchedAlert: {
      subject: (n: number) => `${count(n, "email", "emails")} in policy@ matched no politician`,
      body: (lines: string[], link: string) =>
        // Each line its sender, subject and a link to it in Gmail, which opens for someone signed in to its mailbox.
        `Some emails arrived in the policy@ inbox and weren't kept, because they didn't match a politician. Work out who they're from, and widen the rule or add exceptions.\n\n${lines.join("\n")}\n\n${link}`,
      // After the list, when a report is full: how many wait for the next one.
      more: (n: number) => `And ${n} more, in the next report.`,
    },
  },
  // How a copy of something sent to many went, a broadcast's to a supporter or a letter to a politician, in states
  // (lib/letters/copy-states.ts; docs/domain-concepts.md, "How a copy went"). Each is one colour: red bad, amber sad, green
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
  // What went wrong without stopping the work (lib/server/problems.server.ts). Each can happen in a job or not:
  // in a job, staff see it on the job's page and in the email; not in one, it's kept as an error
  // (lib/oversight/errors-seen.server.ts), on the errors page and emailed to staff.
  problems: {
    // Something went wrong sending a queued letter. It's back in the queue, and the writer is told it's on its way.
    letterNotSent: (id: number) => `Letter ${id} couldn't be sent, so it's gone back in the queue`,
    // What a problem names a letter as, a supporter's copy of one, and a relay.
    letterOf: (id: number) => `Letter ${id}`,
    letterCopyOf: (id: number) => `The supporter's copy of letter ${id}`,
    relayOf: (id: number) => `Relay ${id}`,
    // On a job's run, so on its page and in the email: something the job carried on past. The Gmail read, for a
    // one-off thread's other messages, where they're tried with each new one: messages Gmail wouldn't give, by ID,
    // which follow.
    unreadable: "Messages that Gmail has but refused to give us:",
  },
  // The email staff get when a letter hard-bounces or is complained about (lib/letters/bounces.server.ts).
  // Postmark's reason sometimes ends in a full stop and sometimes doesn't.
  alert: {
    subject: (mp: string) => `A letter to ${mp} bounced`,
    // The mail server's reason quoted after its own sentence, and the link on a line of its own; then, for a
    // bounce read from a Gmail mailbox, a link to it there.
    body: (mp: string, address: string, reason: string, link: string, bounce?: string) =>
      `A letter to ${mp} (${address}) didn't arrive. The mail server said: “${reason.replace(/\.+$/, "")}.”\n\nNothing more will be sent to that address until it's unblocked here:\n${link}${emailCopy.alert.bounceLine(bounce)}`,
  },
  // The emails to staff (lib/email/notifications.server.ts).
  notifications: {
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
    // Letters to MPs have waited LATE_HOURS to go: how many, why, and the queued letters.
    lettersWaiting: {
      subject: (n: number, hours: number) => `${count(n, "letter", "letters")} to MPs waiting over ${hours} hours`,
      body: (n: number, hours: number, why: string, link: string) =>
        `${plural(n, "A letter", `${n} letters`)} to MPs ${plural(n, "has", "have")} waited over ${hours} hours to go. Why: ${why}.\n\nThe letters waiting: ${link}`,
    },
  },
};
