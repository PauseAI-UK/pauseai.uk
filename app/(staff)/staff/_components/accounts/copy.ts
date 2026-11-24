// Every word of logging in and of staff accounts that only the staff pages
// show, with those the server uses too (lib/accounts/copy.ts). The Gmail
// card on your own page has the sending layer's words (emailCopy.gmail).
import { accountsCopy as wordsTheServerUses } from "@/lib/accounts/copy";

export const accountsCopy = {
  ...wordsTheServerUses,
  login: {
    title: "Staff log in",
    intro: "Sign in with your pauseai.uk Google account.",
    keep: "Keep me signed in",
    button: "Sign in with Google",
    // Back from Google, when signing in didn't work, or the account chosen wasn't a pauseai.uk one.
    failed: "Signing in didn't work. Please try again.",
    other: "Only pauseai.uk accounts can sign in. Choose your pauseai.uk account on Google's page.",
    // On a local build without DATA_FIXTURES=1, which Google can't sign in to: the card takes an address, and prints a
    // link in the dev server's terminal. Then, the page says to look there.
    local: {
      intro:
        "This is a local build, so Google can't sign you in here. Type your pauseai.uk address and a link to sign in appears in the dev server's terminal.",
      emailLabel: "Email",
      button: "Print a sign in link",
      printed:
        "If that's a pauseai.uk address, the link to sign in is in the dev server's terminal. Open it in this browser.",
    },
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
