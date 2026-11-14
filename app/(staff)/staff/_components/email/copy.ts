// Every word of the sending layer that only the staff pages show, with those
// the server uses too (lib/email/copy.ts).
import { emailCopy as wordsTheServerUses } from "@/lib/email/copy";

export const emailCopy = {
  ...wordsTheServerUses,
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
};
