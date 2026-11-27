// Made-up people in the WhatsApp waiting room, for the gallery and the tests
// (WaitingRoom.gallery.tsx, WaitingRoom.browser.test.tsx): one held, one let
// in by the check, one let in by staff whose link waits, one dismissed, one
// who hasn't replied; and the community's link.
import { waitingRoomCopy } from "@/lib/broadcasts/waiting-room-copy";
import type { CommunityLink, WaitingPerson } from "@/lib/broadcasts/waiting-room.server";

const texts = waitingRoomCopy.texts;
const LINK = "https://chat.whatsapp.com/ExampleInvite";
const at = (minutes: number) => new Date(Date.UTC(2026, 10, 26, 10, minutes));

let ids = 0;
/** A chat: their messages and ours, in turn, a minute apart. */
const chat = (...said: [ours: boolean, body: string | null][]) =>
  said.map(([ours, body], i) => ({ id: ++ids, at: at(i), ours, kind: body ? null : "voice", body }));

export const exampleLink: CommunityLink = { link: LINK, setBy: "jo@pauseai.uk", setAt: at(0) };

const person = (id: number, more: Partial<WaitingPerson>): WaitingPerson => ({
  id,
  number: "+447700900123",
  profileName: "Jane",
  cameFrom: "parents",
  askedAt: at(0),
  state: "held",
  heldWhy: null,
  decidedBy: null,
  decidedAt: null,
  linkSentAt: null,
  supporterId: null,
  messages: [],
  ...more,
});

export const exampleHeld = person(1, {
  profileName: "Sam",
  number: "+447700900456",
  cameFrom: "footer",
  heldWhy: "It gives no reason for joining.",
  messages: chat(
    [false, "Hi PauseAI UK, I'd like to join (footer)"],
    [true, texts.welcome],
    [false, "hi"],
    [false, null],
    [true, texts.checking],
  ),
});

export const exampleLetIn = person(2, {
  state: "let-in",
  decidedAt: at(3),
  linkSentAt: at(3),
  supporterId: 7,
  messages: chat(
    [false, "Hi PauseAI UK, I'd like to join (parents)"],
    [true, texts.welcome],
    [false, "I'm a mum of two and AI scares me. LS6 1AA"],
    [true, texts.link(LINK)],
  ),
});

export const exampleLetInByStaff = person(3, {
  profileName: "",
  number: "+33612345678",
  cameFrom: null,
  state: "let-in",
  decidedBy: "jo@pauseai.uk",
  decidedAt: at(9),
  supporterId: 8,
  messages: chat([false, "Can I join the WhatsApp group?"], [true, texts.welcome], [false, "Je suis inquiète."]),
});

export const exampleDismissed = person(4, {
  profileName: "Crypto Gains",
  state: "dismissed",
  decidedBy: "jo@pauseai.uk",
  decidedAt: at(5),
  heldWhy: null,
  messages: chat(
    [false, "join (site)"],
    [true, texts.welcome],
    [false, "Investment club, all welcome: https://chat.whatsapp.com/AbC123"],
  ),
});

export const exampleAsked = person(5, {
  state: "asked",
  messages: chat([false, "Hi PauseAI UK, I'd like to join (parents)"], [true, texts.welcome]),
});

export const exampleCounts = { held: 1, "let-in": 37, dismissed: 9, asked: 5 };
