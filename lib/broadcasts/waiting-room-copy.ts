// The WhatsApp waiting room's words (docs/domain-concepts.md, "The waiting room"):
// what our number says in the chat, the staff page's, the daily email of
// who's to check, and the problems it reports. The /whatsapp/beta page's are
// with the site's (lib/content/whatsapp.ts).
import { count } from "@/lib/content/plural";
import { defineProblems } from "@/lib/problems";
import type { WaitingState } from "./waiting-room";

export const waitingRoomCopy = {
  // What our number says to them, in the chat.
  texts: {
    welcome:
      "Welcome to PauseAI UK! We're the civic movement dedicated to averting the risks of superhuman AI. To screen out bots, could you briefly introduce yourself and say why you're interested in PauseAI UK? Then we'll send you the link to our WhatsApp community.\n\nIf you tell us your postcode and email, we'll keep you up to date about future campaigns, including with your MP.",
    link: (link: string) => `Thanks, and welcome! Here's the link to join our WhatsApp community: ${link}`,
    // Under the link, to someone who gave no postcode, or no email, or neither: asking for what's missing.
    missing: (what: "postcode" | "email" | "both") =>
      `If you send us your ${{ postcode: "postcode", email: "email", both: "postcode and email" }[what]}, we'll  .`,
    // Once, to someone to check who writes again.
    checking: "Thanks, someone will check and get back to you soon.",
  },
  page: {
    intro: "People joining our WhatsApp community",
    tabsLabel: "Who's in the waiting room",
    tabs: {
      held: "To check",
      "let-in": "Approved",
      dismissed: "Rejected",
      asked: "Gone quiet",
    } satisfies Record<WaitingState, string>,
    none: {
      held: "Nobody to check.",
      "let-in": "Nobody approved yet.",
      dismissed: "Nobody rejected.",
      asked: "Nobody has gone quiet.",
    } satisfies Record<WaitingState, string>,

    heldWhy: "Why it needs checking",
    // When the check couldn't be asked, or no community link was set.
    heldUnasked: "It couldn't be checked automatically.",
    letIn: "Approve",
    dismiss: "Reject",
    letInBy: (who: string, when: string) => `Approved by ${who}, ${when}`,
    letInByCheck: (when: string) => `Approved automatically, ${when}`,
    dismissedBy: (who: string, when: string) => `Rejected by ${who}, ${when}`,
    // Approved more than a day after they last wrote, when WhatsApp no longer takes our own words.
    linkNotSent: "Link not sent, it's been over a day since they last wrote. DM them instead.",
    link: {
      title: "Community link",
      // The button while no link is set.
      set: "Set the community link",
      setBy: (who: string, when: string) => `Set by ${who}, ${when}`,
      label: "New link",
      hint: "Reset the community's invite link in WhatsApp every month or so, then paste the new one here.",
      save: "Save",
    },
    refused: {
      gone: "Their record has been erased, so there's nothing to approve or reject.",
      "not-a-link": "That isn't a WhatsApp invite link. They start https://chat.whatsapp.com/",
      "no-link": "Set the community link first.",
    },
  },
  // Once a day, while anyone is to check.
  heldEmail: {
    // How every subject ends, which says whether one went lately.
    subjectEnd: "to check in the WhatsApp waiting room",
    subject: (held: number) => `${count(held, "person", "people")} ${waitingRoomCopy.heldEmail.subjectEnd}`,
    body: (held: number, link: string) =>
      `${count(held, "person is", "people are")} waiting in the WhatsApp waiting room for someone to approve or reject them.\n\n${link}`,
  },
};

/** The places on the site a join button is, by the code it gives (whatsappJoinPath), as staff would say them. */
const PLACES: Record<string, string> = {
  footer: "the site's footer",
  "get-involved": "the home page",
  people: "the People page",
  blog: "a blog post",
  site: "the site",
};

/**
 * Where someone came from, by the code of the button they pressed: a place
 * on the site, or a page named by it ("parents", the Parents page).
 */
export function cameFromWords(code: string): string {
  const place =
    PLACES[code] ??
    `the ${code
      .split("-")
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(" ")} page`;
  return `came from ${place}`;
}

export const waitingRoomProblems = defineProblems("waiting-room", {
  // A reply wasn't checked, as Claude couldn't be asked. It goes to staff to check.
  checkFailed: "The waiting room's check couldn't be asked",
  // A message to someone in the waiting room didn't go. A link waits for their next message.
  notSent: (p: { code: number }) =>
    `A message to someone in the WhatsApp waiting room didn't go: WhatsApp's error ${p.code}`,
});
