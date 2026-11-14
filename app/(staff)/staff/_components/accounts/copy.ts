// Every word of logging in and of staff accounts that only the staff pages
// show, with those the server uses too (lib/accounts/copy.ts).
import { accountsCopy as wordsTheServerUses } from "@/lib/accounts/copy";

export const accountsCopy = {
  ...wordsTheServerUses,
  login: {
    title: "Staff log in",
    intro: "Enter your staff email to sign in on this browser.",
    emailLabel: "Email",
    keep: "Keep me signed in",
    button: "Send sign in link",
    sent: "Check your email and open the link in this browser.",
    again: "Try again",
    failed: "The link you used has expired or has been used already. Please request a new one.",
    elsewhere: "The link you used was made in another browser. Either open it there, or request a new one here.",
  },
  // Your own page: your sessions and your Gmail.
  me: {
    title: "Your account",
    sessionsTitle: "Where you're logged in",
  },
  // Connecting a staff member's Gmail, on their own page and in a mailing's Sent from.
  gmail: {
    title: "Let staff send mailings from your Gmail",
    // The heading once it's connected.
    connectedTitle: "Staff can send mailings from your Gmail",
    // The same two, logged in as the letters inbox, which sends supporters' letters to MPs and nothing else.
    lettersInboxTitle: "Send supporters' letters to MPs from this Gmail",
    lettersInboxConnectedTitle: "Supporters' letters to MPs go from this Gmail",
    // What connecting it means, said before it goes to Google: a line, then a bullet each.
    intro: "Usually this is a shared account rather than a person's own: log in here as it, then connect it.",
    explain: [
      "Mailings can go from its address, are kept in its Sent mail, and replies come back to it.",
      "The site reads only those replies and bounces, and never deletes or changes anything.",
    ],
    limit: (limit: string) => `At most ${limit} a day, leaving room for the account's other email.`,
    // The same, logged in as the letters inbox, which sends supporters' letters to MPs and nothing else.
    lettersInboxExplain: [
      "Supporters' letters to MPs go from proxy addresses on it, and the MPs' replies come back to it, to be relayed to the supporters, and their answers back.",
      "The site reads all of its mail, labels and archives what it has handled, and moves an erased supporter's mail to Trash.",
    ],
    lettersInboxLimit: (limit: string) =>
      `At most ${limit} a day, letters, copies and relays together, under Google's 2,000.`,
    connect: "Connect Gmail",
    disconnect: "Disconnect Gmail",
    connected: (when: string) => `Connected ${when}.`,
    notConnected: "Your Gmail isn't connected.",
    sentToday: (sent: number, limit: string) => `${sent} of today's ${limit} emails sent.`,
    // After coming back from Google, or disconnecting.
    outcomes: {
      connected: "Your Gmail is connected. All staff will be able to send mailings from it now.",
      // The same, for the letters inbox, which sends supporters' letters and nothing else.
      connectedLettersInbox:
        "The letters inbox is connected. Supporters' letters to MPs go from it now, and replies are relayed through it every 5 minutes.",
      refused: "Gmail wasn't connected, as you didn't allow it.",
      failed: "Gmail couldn't be connected. Try again.",
      disconnected: "Your Gmail is disconnected.",
    } as Record<string, string>,
    // Back from Google having chosen an account other than the one logged in here, `me`.
    otherAccount: (me: string) =>
      `That Google account does not have the same email ${me} as your PauseAI UK staff account. Either pick a different Google account, or log in here with the same email.`,
    // What's kept from it: in a mailbox that keeps every thread with politicians, around a link to the one-off
    // emails, which says their title.
    kept: { before: "All threads with politicians in this specific mailbox are kept, and show under", after: "." },
    oneOffEmails: "One-off emails",
    // In any other mailbox, around a link to the mailings.
    notKept: { before: "Replies to threads sent like this will be kept, and show under", after: "." },
    // In hello@'s, which sends the broadcasts too, around links to the mailings and the broadcasts.
    notKeptBroadcasts: {
      before: "Replies to mailings and broadcasts sent from here are kept, and show under",
      and: "and",
      after: ".",
    },
  },
  // Your sessions, on your own page (/staff/me): one row each, and a way to end them all.
  sessions: {
    intro: "You're logged into the PauseAI Staff pages on these devices.",
    // Under a session's browser and system: each before its time, then, for one that is, that it's kept.
    started: "Logged in",
    ends: "Ends",
    kept: "Kept signed in",
    // Beside the session of the browser looking.
    thisBrowser: "This browser",
    // In place of the browser and system, when what the browser sent names neither.
    unknown: "Unknown browser",
    logOutEverywhere: "Log out of all of them",
  },
};
