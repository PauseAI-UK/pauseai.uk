// The sending layer's words that the server or pure code uses: the blocked
// addresses' (both pages' and their parts'), the alert of a politician's
// address blocked by an email that wasn't a letter, the names of our own
// inboxes, the email about a connected Gmail Google disconnected, and the
// problems sending and connected Gmail report. The staff pages' own are in
// app/(staff)/staff/_components/email/copy.ts.
import { plural } from "@/lib/content/plural";

/** After a bounce alert, for a bounce read from a Gmail mailbox: a link to it there; nothing for one Postmark reported. */
const bounceLine = (link: string | undefined) => (link ? `\n\nThe bounce, in Gmail:\n${link}` : "");

export const emailCopy = {
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
  // The email staff get when a politician's address is blocked by an email that wasn't a letter or a relay, or one
  // the site can't place (a letter's own is lettersCopy.alert). Postmark's reason sometimes ends in a full stop and
  // sometimes doesn't.
  alert: {
    bounceLine,
    // An email to an MP that wasn't a letter or a relay, or one the site can't place.
    notALetter: {
      subject: (mp: string) => `An email to ${mp} bounced`,
      body: (mp: string, address: string, reason: string, link: string, bounce?: string) =>
        `An email to ${mp} (${address}) didn't arrive. The mail server said: “${reason.replace(/\.+$/, "")}.”\n\nNothing more will be sent to that address until it's unblocked here:\n${link}${bounceLine(bounce)}`,
    },
  },
  // The names our own inboxes go by on the emails the site sends them: the
  // notification inbox, and the policy inbox an MP's reply is forwarded to.
  inboxNames: {
    notifications: "PauseAI UK notifications",
    policy: "PauseAI UK policy",
  },
  // The emails to the notification inbox (lib/email/notifications.server.ts) about a connected Gmail.
  notifications: {
    // Google stopped our access to a connected Gmail: whose, what stops, and where to connect it again.
    gmailDisconnected: {
      subject: (account: string) => `${account}'s Gmail is disconnected`,
      body: (account: string, lettersInbox: boolean, link: string) =>
        `Google stopped our access to ${account}'s Gmail. ${lettersInbox ? "Letters to MPs, and the replies to them, wait until it's connected again." : "Mailings sent using that mailbox, and replies, will be paused until it's connected again."} Log in as ${account} and connect it on its account page:\n\n${link}`,
    },
  },
  // What went wrong sending, without stopping the work (lib/server/problems.server.ts). Each can happen in a job or
  // not: in a job, staff see it on the job's page and in the email; not in one, it's kept as an error
  // (lib/oversight/errors-seen.server.ts), on the errors page and emailed to staff.
  problems: {
    // Staff disconnecting their Gmail: it disconnects as normal, but Google still holds the permission. No job
    // reaches it, so it's always kept as an error.
    tokenNotRevoked: (account: string) => `${account}'s Gmail token couldn't be revoked at Google`,
    // An email didn't go, as Gmail or Postmark errored.
    sendFailed: (purpose: string) => `An email of type '${purpose}' couldn't be sent`,
    // Something should have emailed staff, but NOTIFICATION_INBOX isn't set, so nobody heard.
    noInbox: "NOTIFICATION_INBOX isn't set, so nobody was emailed",
    // Something went wrong before an email went: the letter or broadcast copy is back in line for the next run.
    notSentYet: (what: string) => `${what} couldn't be sent, it will be tried again`,
    // An email went, but recording that failed: a person must check, as sending it again would send it twice.
    sentUnrecorded: (what: string) => `${what} was sent, but couldn't be marked as sent. Check before sending it again`,
  },
};
