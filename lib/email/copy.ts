// The sending layer's words that the server or pure code uses: the blocked
// addresses' (both pages' and their parts'), the alert of a politician's
// address blocked by an email that wasn't a letter, the names of our own
// inboxes, the email about a connected Gmail Google disconnected, and the
// problems sending and connected Gmail report. The staff pages' own are in
// app/(staff)/staff/_components/email/copy.ts.
import { plural } from "@/lib/content/plural";
import type { FoundBy } from "./block-filters";
import type { Purpose } from "./email.server";

/** After a bounce alert, for a bounce read from a Gmail mailbox: a link to it there; nothing for one Postmark reported. */
const bounceLine = (link: string | undefined) => (link ? `\n\nThe bounce, in Gmail:\n${link}` : "");

export const emailCopy = {
  // The pages of blocked addresses (/staff/politicians/addresses-to-fix and
  // /staff/supporters/bounced-emails), and the bounces and complaints that blocked them. Each page's title and
  // intro are its feature's: politiciansCopy.addressesToFix and supportersCopy.bouncedEmails.
  emails: {
    // Over the list: how many are blocked, of those the filters find.
    count: (n: number) => `⁂ ${n} blocked ${plural(n, "address or number", "addresses and numbers")}`,
    // Instead of the table, when no address is blocked, or none of the cause filtered for.
    noBlocks: "⁂ No addresses or numbers are blocked.",
    // After a reason, as a lozenge, who told us: a bounce found in someone's Gmail, Postmark, CiviCRM, for a hold, or
    // WhatsApp, refusing a text.
    from: { gmail: "Gmail", postmark: "Postmark", civicrm: "CiviCRM", whatsapp: "WhatsApp" },
    // The Cause: what happened, whoever told us, as the lozenge after the reason says who. A hold is CiviCRM's, which
    // gives no reason, though it's usually bounces. WhatsApp's refusal may also be someone who hasn't accepted its
    // latest terms, or whose app is too old.
    kinds: {
      hard: "Bounced, for good",
      soft: "Bounced, for now",
      complaint: "Marked as spam",
      hold: "“On hold” in CiviCRM",
      "not-on-whatsapp": "⁂ Not on WhatsApp",
    } as Record<string, string>,
    // The headings the causes are under in their filter, by what was sent: an email or a text.
    channels: { email: "⁂ Email", text: "⁂ Text" },
    // The reason kept for a hold, as CiviCRM gives none.
    holdReason: "Usually as its emails to it bounced",
    // A number's reason: WhatsApp couldn't deliver a text, and when texts try it again, after UNREACHABLE_MONTHS
    // (lib/broadcasts/unreachable.server.ts); once that's past, the next text does.
    triesFrom: (date: string) => `⁂ WhatsApp couldn't deliver a text to it. Texts try it again from ${date}.`,
    triesNext: "⁂ WhatsApp couldn't deliver a text to it. The next text tries it again.",
    columns: {
      address: "Address",
      kind: "Cause",
      since: "Since",
      reason: "Reason",
      whose: "Whose",
      refused: "Not sent since",
      at: "When",
      // What found the address or number out: the email that bounced, a letter or one of ours, or a text.
      sent: "⁂ What found it out",
    },
    // The email was a letter: before the name of the politician it was to, the two linked to the letter.
    letterTo: "Letter to",
    // Instead of the type, for a hold, which no email of ours found out.
    held: "⁂ On hold in CiviCRM",
    // Instead of the type, for a bounce read from a Gmail mailbox of an email the site has no record of sending.
    fromMailbox: (mailbox: string) => `⁂ Sent from ${mailbox}'s mailbox`,
    // Instead of the type, for an email the site has no record of sending.
    notRecorded: "⁂ Not one we sent through the site",
    // Each type of email (Purpose in lib/email/email.server.ts); a broadcast's links to its copy, an email or a text.
    purposes: {
      letter: "Letter",
      "letter-copy": "⁂ Supporter's copy of their letter",
      relay: "⁂ Message relayed to an MP",
      "supporter-notice": "⁂ Notice to a supporter",
      "office-notice": "⁂ Notice to an MP's office",
      "forwarded-reply": "Forwarded reply",
      "staff-login": "Staff login link",
      "staff-alert": "Staff alert",
      "staff-report": "⁂ Staff report",
      mailing: "Mailing",
      "mailing-test": "Test copy of a mailing",
      broadcast: "⁂ Broadcast",
      "preferences-link": "⁂ Contact preferences link",
      "bulk-notice": "⁂ Notice about bulk emails",
      "broadcast-answer": "⁂ Answer to a reply to a broadcast",
    } satisfies Record<Purpose, string>,
    // The filter of what found an address or number out (FOUND_BY in lib/email/block-filters.ts), named as its
    // column is.
    foundBy: {
      broadcast: "⁂ A broadcast, by email or text",
      letter: "⁂ A letter, or an email about one",
      mailing: "⁂ A mailing",
      other: "⁂ Another email",
      unrecorded: "⁂ Nothing the site sent",
    } satisfies Record<FoundBy, string>,
    // A complaint can't be undone by staff, only by the person.
    cantReset: "Can't be unblocked: they marked our email as spam.",
    // In the unblock form's field, and its name: the note for the audit log. In a row's bubble, the label over the field.
    note: "Why unblock it?",
    unblock: "Unblock",
    // A row's button in a list of blocked addresses, which opens the bubble that asks why; and the button that closes it.
    unblockOpen: "Unblock…",
    cancel: "Cancel",
    // A row's button that opens its history, and what's in it, newest first (BlockEvent in lib/oversight/blocks.server.ts):
    // a bounce or complaint by its cause, in the words of whoever told us, and the mailbox a bounce was read from; a
    // text WhatsApp refused, or skipped as it had, by its broadcast; and staff unblocking it, with why.
    history: {
      open: "⁂ History",
      readFrom: (mailbox: string) => `⁂ Found in ${mailbox}'s mailbox`,
      refused: "⁂ WhatsApp couldn't deliver",
      skipped: "⁂ Not sent, as WhatsApp couldn't deliver before",
      unblocked: (by: string) => `⁂ Unblocked by ${by}`,
    },
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
