// Every word the staff interface (/staff) shows.

import type { AddressSearch, ImportJob } from "@/lib/import-runs";
import { count, plural } from "@/lib/content/plural";
import { politiciansCopy } from "@/lib/politicians/copy";

/** After a bounce alert, for a bounce read from a Gmail mailbox: a link to it there; nothing for one Postmark reported. */
const bounceLine = (link: string | undefined) => (link ? `\n\nThe bounce, in Gmail:\n${link}` : "");

/** What a CiviCRM import run sent CiviCRM before it pulled, at the start of its line. */
const sentToCivicrm = (u: { sent: number; refused: number; unanswered: number }): string =>
  `${count(u.sent, "opt-out", "opt-outs")} sent to CiviCRM${u.refused ? `, ${u.refused} refused` : ""}${u.unanswered ? `, ${u.unanswered} to try again` : ""}. `;

export const staffCopy = {
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
  // (lib/server/controlai-import.server.ts).
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
  // (lib/events/luma-import.server.ts), on the Scheduled jobs page.
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
  // The names our own inboxes go by on the emails the site sends them: the
  // notification inbox, and the policy inbox an MP's reply is forwarded to.
  inboxNames: {
    notifications: "PauseAI UK notifications",
    policy: "PauseAI UK policy",
  },
  // The emails to the notification inbox (lib/server/notifications.server.ts) that
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
  },
  // The read every 5 minutes of the connected Gmail accounts for replies to our
  // letters and bounces (lib/server/gmail-reading.server.ts), on the Scheduled jobs page.
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
  // What went wrong on the site outside a job's run (lib/server/errors-seen.server.ts): the admins' list at
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
  // The hourly pull of Global's UK chapter contacts from CiviCRM (lib/server/civicrm-import.server.ts).
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
  // What went wrong without stopping the work (lib/server/problems.server.ts), by how far each can reach.
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
      civicrmUpdatesFailed: "Couldn't send opt-outs to CiviCRM. They'll go next hour",
      civicrmUpdatesUnanswered: (n: number) =>
        `${plural(n, "opt-out", "opt-outs")} got no answer from CiviCRM. They'll go again next hour`,
      civicrmUpdatesInvalid: (n: number) =>
        `CiviCRM rejected ${plural(n, "opt-out", "opt-outs")}. A developer needs to look at them:`,
    },
    // Can happen in a job or not. In a job, staff see it on the job's page and in the email. Not in a job, such
    // as a visitor sending a letter, it's kept as an error (lib/server/errors-seen.server.ts): on the errors page, and
    // emailed to staff.
    anywhere: {
      // An email didn't go, as Gmail or Postmark errored.
      sendFailed: (purpose: string) => `An email of type '${purpose}' couldn't be sent`,
      // Something should have emailed staff, but NOTIFICATION_INBOX isn't set, so nobody heard.
      noInbox: "NOTIFICATION_INBOX isn't set, so nobody was emailed",
      // An email went by Gmail, but Gmail wouldn't say its Message-ID. Replies to it may not find their letter.
      messageIdUnknown: "Gmail wouldn't say which Message-ID an email went with",
      // Something went wrong before an email went: the letter or broadcast copy is back in line for the next run.
      notSentYet: (what: string) => `${what} couldn't be sent, it will be tried again`,
      // An email went, but recording that failed: a person must check, as sending it again would send it twice.
      sentUnrecorded: (what: string) =>
        `${what} was sent, but couldn't be marked as sent. Check before sending it again`,
      // Meta didn't say how many people our WhatsApp account can text a day, so the fewest are, till it does.
      whatsAppLimitUnknown: "WhatsApp didn't say our daily limit, so texts go to no more than 250 people a day",
      // Reading an email in a charset we don't know: a job reading mail, or staff opening a letter. It's read as UTF-8.
      charsetUnknown: (charset: string) =>
        `An email's charset isn't one we know, so its text may be garbled: ${charset}`,
    },
    // No job reaches these: each is kept as an error (lib/server/errors-seen.server.ts), on the errors page and
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
  // The nightly import of ControlAI's statement's supporters (lib/server/controlai-statement-import.server.ts).
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
