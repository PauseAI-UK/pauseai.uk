// The words of erasing a supporter, which the server uses too: the red
// button at the foot of a supporter's page, the page it goes to, and what
// couldn't be cleared afterwards.
import { defineProblems } from "@/lib/problems";
import type { EraseLeftover } from "@/lib/staff-search";

export const erasureCopy = {
  // Erasing a supporter: the red button at the foot of their page, and the
  // page it goes to, with the form; then the list's notice afterwards.
  erase: {
    title: "Erase this supporter",
    // The page's own step of the trail above it, after the supporter's name.
    crumb: "Erase",
    // Beside the button, at the foot of the supporter's page.
    note: "If they've asked to be forgotten, for example a GDPR request.",
    // Under the page's title: what erasing is for.
    intro: "For when someone asks to be forgotten, for example a GDPR erasure request",
    // In red, over the form.
    warning: "This can't be undone.",
    // Beside the form: what goes, and what stays.
    erased: {
      title: "What's erased",
      text: "Everything we hold about this person is deleted: letters, event registrations, their Luma contact, our copy of their PauseAI membership.",
    },
    kept: {
      title: "What we keep",
      text: "We keep references to them in blocked addresses and unsubscribes. The global team's own copy of their membership has to be erased by asking them.",
    },
    // The field for what points back to their request, kept in the audit log's entry, and under it what to put.
    referenceLabel: "How and when did they ask?",
    referenceHint:
      "For example “Email to Joseph, 3 Nov 2026”. Don't put their name or address, as this reference is kept after they're erased.",
    confirm: "I'm sure this person asked to be erased",
    button: "Erase",
    cancel: "Cancel",
    // Why the form wasn't sent on, by the server's reason.
    refused: {
      // Under the reference's field, when it holds nothing but spaces.
      blank: "We need to know how and when they asked.",
      // At the top of the page, when someone else erased this supporter after the page loaded.
      gone: "Someone has already erased this supporter.",
    },
    done: "Erased. We've kept only their blocked addresses and unsubscribes, so we never contact them again.",
    // In amber, over what couldn't be cleared afterwards: the person is erased all the same.
    partly: "Erased everything except:",
    // What couldn't be cleared, a line each under `partly`; the log has `partly` and the line together.
    notCleared: {
      mail: "their mail",
      oneOffs: "their one-off emails",
      replies: "their replies to broadcasts",
    },
  },
};

// What went wrong without stopping the work (lib/problems.ts): kept as an error
// (lib/oversight/errors-seen.server.ts), on the errors page and emailed to staff.
export const erasureProblems = defineProblems("erasure", {
  // A person was erased, but a clean-up after it failed: what the notice says to whoever erased them, on one line.
  notCleared: (p: { what: EraseLeftover }) => `${erasureCopy.erase.partly} ${erasureCopy.erase.notCleared[p.what]}`,
});
