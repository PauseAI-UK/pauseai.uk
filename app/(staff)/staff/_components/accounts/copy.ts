// Every word of logging in and of staff accounts that only the staff pages
// show, with those the server uses too (lib/accounts/copy.ts). The Gmail
// card on your own page has the sending layer's words (emailCopy.gmail).
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
