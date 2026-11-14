// The words of the scheduled jobs that the server uses, and those the job
// pages share with it: each job's title, description, button and result,
// and the problems a run of a job reports. The import log's own words, its
// jobs' titles and its emails about failed runs, are below every feature
// (jobTitles and notifications in lib/content/staff-interface.ts).

import type { AddressSearch } from "@/lib/import-runs";
import { count, plural } from "@/lib/content/plural";

/** What a CiviCRM import run sent CiviCRM before it pulled, at the start of its line. */
const sentToCivicrm = (u: { sent: number; refused: number; unanswered: number }): string =>
  `${count(u.sent, "opt-out", "opt-outs")} sent to CiviCRM${u.refused ? `, ${u.refused} refused` : ""}${u.unanswered ? `, ${u.unanswered} to try again` : ""}. `;

export const jobsCopy = {
  // The web imports on the Scheduled jobs page: ControlAI's
  // letter to the PM, copied nightly into the bill's statuses
  // (lib/jobs/controlai-import.server.ts).
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
    stoppedBy: {
      time: "Stopped: out of time.",
      "rate-limit": "Stopped: near Luma's rate limit.",
      running: "Another run was already going.",
    } as Record<string, string>,
  },
  // The read every 5 minutes of the connected Gmail accounts for replies to our
  // letters and bounces (lib/jobs/gmail-reading.server.ts), on the Scheduled jobs page.
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
  // The hourly pull of Global's UK chapter contacts from CiviCRM (lib/jobs/civicrm-import.server.ts).
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
  // The nightly import of ControlAI's statement's supporters (lib/jobs/controlai-statement-import.server.ts).
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
  // What went wrong without stopping a job's work (lib/server/problems.server.ts): each on the job's run, so on
  // its page and in the email, as something the job carried on past.
  problems: {
    // The Gmail read: Gmail errored or refused for a connected account, so its new mail wasn't read this time.
    couldntRead: (account: string) => `Gmail gave errors or refused connection, or our internal error, for ${account}`,
    // The Gmail read: the mailbox was read, but Gmail wouldn't give the account's name.
    nameUnknown: (account: string) => `Couldn't fetch name of ${account} from Gmail`,
    // The Gmail read: mail in the letters inbox that couldn't be matched to anything, so a person must look. How many follows.
    notUnderstood: "Messages in the letters inbox that couldn't be matched, so need a person to look at:",
    // The CiviCRM import: a pull came back much shorter than the last, so nobody was taken as gone from the
    // chapter, in case it's CiviCRM's mistake. The counts follow; Global should be told.
    civicrmTooFew: "CiviCRM returned far fewer contacts than last time, so nobody was marked gone. Tell Global:",
  },
};
