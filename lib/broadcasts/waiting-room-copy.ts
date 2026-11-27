// The WhatsApp waiting room's words (docs/domain-concepts.md, "The waiting room"):
// what our number says in the chat, the staff page's, the daily email of
// who's held, and the problems it reports. The /whatsapp/beta page's are
// with the site's (lib/content/whatsapp.ts).
import { count } from "@/lib/content/plural";
import { defineProblems } from "@/lib/problems";
import type { WaitingState } from "./waiting-room";

export const waitingRoomCopy = {
  // What our number says to them, in the chat.
  texts: {
    welcome:
      "⁂ Thanks for asking to join PauseAI UK's WhatsApp community! To help us keep out bots, could you reply with a line about why you're interested in PauseAI? If you tell us your postcode and email too, we can let you know when there's a chance to contact your MP. Joining means you'll get our newsletter by text. Reply STOP any time to stop it.",
    link: (link: string) => `⁂ Thanks, and welcome! Here's the link to join our WhatsApp community: ${link}`,
    // Under the link, to someone who gave no postcode.
    postcode: "⁂ If you send us your postcode, we can tell you when there's a chance to contact your MP.",
    // Once, to someone held who writes again.
    checking: "⁂ Thanks, someone will check and get back to you soon.",
  },
  page: {
    intro:
      "⁂ People who asked to join our WhatsApp community by messaging our number. A check lets in those whose reply reads as a real person, and holds the rest here for you.",
    tabsLabel: "⁂ Who's in the waiting room",
    tabs: {
      held: "⁂ Held",
      "let-in": "⁂ Let in",
      dismissed: "⁂ Dismissed",
      asked: "⁂ No reply",
    } satisfies Record<WaitingState, string>,
    none: {
      held: "⁂ Nobody is held.",
      "let-in": "⁂ Nobody has been let in yet.",
      dismissed: "⁂ Nobody has been dismissed.",
      asked: "⁂ Everyone who asked has replied.",
    } satisfies Record<WaitingState, string>,
    from: (place: string) => `⁂ from ${place}`,
    heldWhy: "⁂ Why it was held",
    // When the check couldn't be asked, or no community link was set.
    heldUnasked: "⁂ The check couldn't be asked, or no community link was set.",
    letIn: "⁂ Let in, send the link",
    dismiss: "⁂ Dismiss",
    letInBy: (who: string, when: string) => `⁂ Let in by ${who}, ${when}`,
    letInByCheck: (when: string) => `⁂ Let in by the check, ${when}`,
    dismissedBy: (who: string, when: string) => `⁂ Dismissed by ${who}, ${when}`,
    linkWaiting:
      "⁂ The link goes when they next write: WhatsApp lets us write only within a day of their last message.",
    supporter: "⁂ Their supporter page",
    link: {
      title: "⁂ The community's link",
      none: "⁂ No link is set, so nobody can be sent one. Everyone who replies is held until one is.",
      setBy: (who: string, when: string) => `⁂ Set by ${who}, ${when}`,
      label: "⁂ New link",
      hint: "⁂ From the community's Invite link in WhatsApp, as https://chat.whatsapp.com/… Reset it there first if the old one has spread.",
      save: "⁂ Use this link",
    },
    refused: {
      gone: "⁂ They've gone from the waiting room: their record was erased.",
      "not-a-link": "⁂ That isn't a WhatsApp invite link. It starts https://chat.whatsapp.com/",
      "no-link": "⁂ Set the community's link first, so there's one to send.",
    },
    // On a supporter's page, their chat with the waiting room.
    chat: "⁂ WhatsApp waiting room",
  },
  // Once a day, while anyone is held.
  heldEmail: {
    // How every subject ends, which says whether one went lately.
    subjectEnd: "⁂ held in the WhatsApp waiting room",
    subject: (held: number) => `${count(held, "person", "people")} ${waitingRoomCopy.heldEmail.subjectEnd}`,
    body: (held: number, link: string) =>
      `⁂ ${count(held, "person is", "people are")} waiting for someone to let them into the WhatsApp community, or dismiss them.\n\n${link}`,
  },
};

export const waitingRoomProblems = defineProblems("waiting-room", {
  // A reply wasn't checked, as Claude couldn't be asked. It's held for staff.
  checkFailed: "The waiting room's check couldn't be asked",
  // A message to someone in the waiting room didn't go. A link waits for their next message.
  notSent: (p: { code: number }) =>
    `A message to someone in the WhatsApp waiting room didn't go: WhatsApp's error ${p.code}`,
});
