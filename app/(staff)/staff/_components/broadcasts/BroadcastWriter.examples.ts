import type { TextPlace } from "@/lib/broadcasts/text-parts";
import type { BroadcastAnswer, BroadcastReaction } from "@/lib/broadcasts/answers.server";
import type { BroadcastReply } from "@/lib/broadcasts/replies.server";
import type { LetterDoc } from "@/lib/letters/format";
import type { LinkCard } from "@/lib/broadcasts/link-card";
import type { MailingDoc } from "@/lib/mailings/doc";
import { TEMPLATE_FOOTER } from "@/lib/broadcasts/whatsapp-template";
import type { WhatsAppTemplate, WrittenBroadcast } from "@/lib/broadcasts/drafts.server";
import type {
  MessageCopy,
  BroadcastPageData,
  BroadcastSummary,
  BroadcastWriterData,
} from "@/lib/broadcasts/pages.server";
import type { BroadcastPart } from "@/lib/broadcasts/recipients.server";
import type { SupporterChoices } from "@/lib/supporters/records.server";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

/** An email with a first name, a part only for those with a local group, and their MP. */
const exampleBroadcastWords: MailingDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hi " },
        { type: "field", attrs: { field: "firstName" } },
        { type: "text", text: "," },
      ],
    },
    { type: "paragraph", content: [{ type: "text", text: "Here's what's on near you this month." }] },
    {
      type: "onlyFor",
      attrs: { condition: "!wrote:regulate-ai" },
      content: [{ type: "paragraph", content: [{ type: "text", text: "Could you write to your MP?" }] }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "See you soon, " },
        { type: "field", attrs: { field: "name" } },
        { type: "text", text: "." },
      ],
    },
  ],
};

/** A text's words with all WhatsApp's formatting: bold, italic, a web address, a list and a quote; and a link's mark, which a text doesn't show. */
export const exampleWhatsAppWords: LetterDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hi Jane, the march meets at " },
        { type: "text", text: "11:00", marks: [{ type: "bold" }] },
        { type: "text", text: " at " },
        { type: "text", text: "Parliament Square", marks: [{ type: "italic" }, { type: "bold" }] },
        { type: "text", text: "." },
        { type: "hardBreak" },
        { type: "text", text: "Details: https://pauseai.uk/march" },
      ],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Bring water" }] }] },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Wear orange", marks: [{ type: "link", attrs: { href: "https://pauseai.uk" } }] },
              ],
            },
          ],
        },
      ],
    },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Pause AI now." }] }] },
    { type: "paragraph" },
  ],
};

/**
 * A picture for a text's top in the examples, a march's banner drawn: given
 * whole, as a data: address, as the gallery has no picture kept to fetch
 * (pictureSource).
 */
export const examplePictureId =
  "data:image/png;base64,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";

/** A place a text's map shows: where a march meets, as the place lookup's fake finds it. */
export const examplePlace: TextPlace = {
  name: "Parliament Square",
  address: "Westminster, London SW1P 3BD",
  latitude: 51.5005,
  longitude: -0.1268,
};

/** The card WhatsApp shows for a text's link to a page about the march. */
export const exampleLinkCard: LinkCard = {
  title: "March Against AI Extinction",
  description: "Join thousands in London to call for a pause on the race to superintelligence.",
  site: "pauseai.uk",
};

/** A text's words, with only a first name. */
export const exampleTextWords: MailingDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hi " },
        { type: "field", attrs: { field: "firstName" } },
        { type: "text", text: ", the march meets at 11:00 at Parliament Square. Look for the orange flags." },
      ],
    },
  ],
};

/** An approved template's words: not quite the words above, which are new words, not yet a template. */
const exampleTemplateWords: MailingDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hi " },
        { type: "field", attrs: { field: "firstName" } },
        { type: "text", text: ", the march meets at 11:00 at Parliament Square." },
      ],
    },
  ],
};

const template = (id: number, name: string, more: Partial<WhatsAppTemplate> = {}): WhatsAppTemplate => ({
  id,
  name,
  body: exampleTemplateWords,
  status: "approved",
  category: "MARKETING",
  metaName: null,
  createdBy: "jo@pauseai.uk",
  approvedAt: new Date("2026-10-20T10:00:00Z"),
  requestedAt: new Date("2026-10-19T10:00:00Z"),
  rejectedAt: null,
  rejectedReason: null,
  footer: TEMPLATE_FOOTER,
  header: null,
  buttons: [],
  lastUsedAt: null,
  lastUsedTo: 0,
  nextScheduledAt: null,
  uses: { sent: 0, scheduled: 0, drafts: 0 },
  ...more,
});

/** More templates than show at first: one used, one made in WhatsApp Manager. */
export const exampleTemplates: WhatsAppTemplate[] = [
  template(1, "The march meets at 11:00 at Parliament Square.", {
    lastUsedAt: new Date("2026-11-02T08:00:00Z"),
    lastUsedTo: 318,
    uses: { sent: 2, scheduled: 1, drafts: 1 },
  }),
  template(2, "PauseCon room change", { createdBy: null, footer: null }),
  template(3, "Our next event is on Saturday."),
  template(4, "Local group meetup"),
  template(5, "write_to_your_mp"),
  template(6, "Thank you for coming."),
];

export const exampleSupporterChoices: SupporterChoices = {
  events: [{ id: "evt-3", name: "PauseAI London March", startAt: new Date("2026-11-07T11:00:00Z") }],
  mps: [{ id: 7, name: "Alex Sobel", constituency: "Leeds Central and Headingley" }],
};

/** The parts a broadcast's words can be only for: a campaign, and two events, one past and one to come. */
const exampleParts: BroadcastPart[] = [
  {
    id: "wrote:regulate-ai",
    label: broadcastsCopy.broadcastPages.conditions.wrote("Regulate AI"),
    group: broadcastsCopy.broadcastPages.conditions.wroteGroup,
    option: "Regulate AI",
  },
  {
    id: "event:evt-pausecon",
    label: broadcastsCopy.broadcastPages.conditions.registered("PauseCon 2026"),
    group: broadcastsCopy.broadcastPages.conditions.registeredGroup,
    option: "PauseCon 2026, 14 Feb 2026",
    searchable: true,
  },
  {
    id: "event:evt-leeds",
    label: broadcastsCopy.broadcastPages.conditions.registered("Leeds talk"),
    group: broadcastsCopy.broadcastPages.conditions.registeredGroup,
    option: "Leeds talk, 12 Dec 2026",
    searchable: true,
  },
];

/** Those parts, as many of a broadcast's 412 recipients as each covers. */
const examplePartsCovering = exampleParts.map((part, i) => ({ ...part, covers: [120, 85, 12][i] }));

/**
 * Those a broadcast finds, 23 of them with no name.
 */
export const exampleBroadcastData: BroadcastWriterData = {
  filter: { list: "supporters", params: { contact: "email:newsletter:yes", near: "LS1" } },
  choices: exampleSupporterChoices,
  unknown: [],
  count: 412,
  fields: [
    { id: "firstName", label: "First name", lacking: 23, fallback: true },
    { id: "name", label: "Name", lacking: 23, fallback: true },
  ],
  conditions: examplePartsCovering,
  // hello@'s Gmail, connected, with most of a day's emails still to send.
  sender: { byGmail: true, connected: true, remaining: 1788, daily: 1800 },
  me: "jo@pauseai.uk",
  sends: true,
  textsSend: true,
  templates: exampleTemplates,
  textNumber: "+447700900000",
  pairs: [],
  realMaps: false,
};

/** What sends a text: our WhatsApp number, at Meta's lowest daily limit, with a few texted today. */
export const exampleTextSender: BroadcastWriterData["sender"] = {
  byGmail: false,
  connected: false,
  remaining: 238,
  daily: 250,
};

/** A draft email, written. */
export const exampleBroadcastEmail: WrittenBroadcast = {
  id: 3,
  title: "Events near you this month",
  filter: exampleBroadcastData.filter,
  subject: "Events near you this month",
  body: exampleBroadcastWords,
  ask: null,
  createdBy: "jo@pauseai.uk",
  sentFrom: "hello@pauseai.uk",
  fromName: "PauseAI UK",
  dueAt: new Date("2099-11-12T09:18:00.000Z"),
  state: "draft",
  version: 4,
  attachments: [],
  channel: "email",
  topics: ["newsletter"],
  template: null,
  sendBy: "gmail",
  finishMinutes: null,
  waitingSince: null,
  waitReason: null,
  waitSaid: null,
  gaveUp: false,
  header: null,
  place: null,
  pictureId: null,
  buttons: [],
  textVersion: null,
};

/** A draft text with nothing chosen. */
export const exampleBroadcastText: WrittenBroadcast = {
  ...exampleBroadcastEmail,
  id: 4,
  title: "",
  subject: "",
  body: { type: "doc", content: [] },
  sentFrom: "+447700900000",
  channel: "text",
  topics: ["events"],
  filter: { list: "supporters", params: { contact: "text:events:yes" } },
};

const summary: BroadcastSummary = {
  id: 5,
  title: "Thank you for marching",
  ask: null,
  askTitle: null,
  askKind: null,
  importedText: null,
  importedSubject: "",
  importedTextApproximate: false,
  imported: false,
  state: "sent",
  createdBy: "jo@pauseai.uk",
  fromName: "PauseAI UK",
  sentFrom: "hello@pauseai.uk",
  dueAt: new Date("2026-10-18T10:00:00Z"),
  finishMinutes: null,
  updatedAt: new Date("2026-10-18T10:00:00Z"),
  to: 290,
  sentAt: new Date("2026-10-18T10:00:00Z"),
  sent: 276,
  failed: 6,
  answered: 0,
  channel: "email",
  sendBy: "gmail",
  waiting: false,
  approved: false,
  rejected: false,
  gaveUp: false,
  waitReason: null,
  states: {
    look: 0,
    "opted-out": 1,
    error: 4,
    unreached: 2,
    "not-sent": 8,
    replied: 0,
    read: 0,
    delivered: 0,
    sent: 275,
    held: 0,
    "to-go": 0,
  },
  pause: null,
};

/** A broadcast as the list has it. */
export const exampleBroadcastSummary = summary;

/** A broadcast's page, sent: Jane read it, Sam's failed, Pat's skipped, Tom stopped and someone's erased. */
export const exampleBroadcastSent: Extract<BroadcastPageData, { kind: "written" }> = {
  kind: "written",
  written: { ...exampleBroadcastEmail, id: 5, title: summary.title, subject: summary.title, state: "sent" },
  summary,
  choices: exampleSupporterChoices,
  parts: Object.fromEntries(exampleParts.map((part) => [part.id, part.label])),
  tab: "all",
  sort: { key: "who", dir: "asc" },
  recipientsTotal: 5,
  page: 1,
  pages: 1,
  pageSize: 100,
  recipients: [
    {
      copyId: 21,
      supporterId: 7,
      name: "Jane Example",
      place: "Leeds",
      status: "delivered",
      skipReason: null,
      sentAt: new Date("2026-10-18T10:00:00Z"),
      changedAt: new Date("2026-10-18T14:02:00Z"),
      heldTill: null,
      state: "read",
      why: null,
    },
    {
      copyId: 22,
      supporterId: 8,
      name: "Sam",
      place: null,
      status: "failed",
      skipReason: null,
      sentAt: new Date("2026-10-18T10:00:00Z"),
      changedAt: new Date("2026-10-18T10:00:00Z"),
      heldTill: null,
      state: "error",
      why: "gmail",
    },
    {
      copyId: 23,
      supporterId: 9,
      name: null,
      place: null,
      status: "skipped",
      skipReason: "blocked",
      sentAt: null,
      changedAt: null,
      heldTill: null,
      state: "not-sent",
      why: "blocked",
    },
    {
      copyId: 24,
      supporterId: 11,
      name: "Tom Sample",
      place: null,
      status: "skipped",
      skipReason: "unsubscribed",
      sentAt: null,
      changedAt: null,
      heldTill: null,
      state: "not-sent",
      why: "unsubscribed",
    },
    {
      copyId: 25,
      supporterId: null,
      name: null,
      place: null,
      status: "delivered",
      skipReason: null,
      sentAt: new Date("2026-10-18T10:00:00Z"),
      changedAt: new Date("2026-10-18T10:05:00Z"),
      heldTill: null,
      state: "delivered",
      why: null,
    },
  ],
};

/** A text sent to Jane, who read it. */
export const exampleMessageCopy: MessageCopy = {
  id: 21,
  messageId: 5,
  title: "March day: where to meet",
  channel: "text",
  sendBy: "gmail",
  subject: "",
  body: exampleTextWords,
  fromName: "PauseAI UK",
  sentFrom: "+447700900000",
  supporterId: 7,
  name: "Jane Example",
  address: "+447700900001",
  merge: { values: { firstName: "Jane" }, meets: ["has:firstName"] },
  status: "delivered",
  skipReason: null,
  state: "read",
  why: null,
  footer: TEMPLATE_FOOTER,
  place: "Leeds",
  sentAt: new Date("2026-11-07T07:18:00Z"),
  providerId: "wamid.example",
  events: [
    { at: new Date("2026-11-07T07:40:00Z"), kind: "read", details: {} },
    { at: new Date("2026-11-07T07:18:30Z"), kind: "delivered", details: {} },
    { at: new Date("2026-11-07T07:18:00Z"), kind: "sent", details: {} },
  ],
  topics: ["events"],
  replies: [],
  answers: [],
  reactions: [],
  // Its broadcast as written: a map of where to meet, and a reply button.
  written: {
    ...exampleBroadcastText,
    body: exampleTextWords,
    header: "location",
    place: examplePlace,
    buttons: [{ text: "I'm coming" }],
  },
};

/** Replies to an email, oldest first, as a thread shows them: an automatic reply; Jane's thanks, which Jo said needed nothing; her question, which Jo answered; and her asking to stop, waiting for staff. */
export const exampleBroadcastReplies: BroadcastReply[] = [
  {
    id: 3,
    providerId: "wamid.example-3",
    receivedAt: new Date("2026-11-07T07:19:00Z"),
    from: "jane@example.com",
    subject: "Automatic reply: Thank you for marching",
    text: "I'm away until Monday.",
    automatic: true,
    outcome: null,
    dealtBy: null,
    dealtAt: null,
    doNotEmail: false,
    account: "hello@pauseai.uk",
    answerable: true,
    reactable: false,
    kind: null,
    reactionTo: null,
    removedAt: null,
  },
  {
    id: 2,
    providerId: "wamid.example-2",
    receivedAt: new Date("2026-11-07T08:10:00Z"),
    from: "jane@example.com",
    subject: "Re: Thank you for marching",
    text: "It was a great day.",
    automatic: false,
    outcome: "nothing",
    dealtBy: "jo@pauseai.uk",
    dealtAt: new Date("2026-11-07T10:00:00Z"),
    doNotEmail: false,
    account: "hello@pauseai.uk",
    answerable: true,
    reactable: false,
    kind: null,
    reactionTo: null,
    removedAt: null,
  },
  {
    id: 4,
    providerId: "wamid.example-4",
    receivedAt: new Date("2026-11-07T08:40:00Z"),
    from: "jane@example.com",
    subject: "Re: Thank you for marching",
    text: "When's the next one?",
    automatic: false,
    outcome: "answered",
    dealtBy: "jo@pauseai.uk",
    dealtAt: new Date("2026-11-07T10:05:00Z"),
    doNotEmail: false,
    account: "hello@pauseai.uk",
    answerable: true,
    reactable: false,
    kind: null,
    reactionTo: null,
    removedAt: null,
  },
  {
    id: 1,
    providerId: "wamid.example-1",
    receivedAt: new Date("2026-11-07T09:30:00Z"),
    from: "jane@example.com",
    subject: "Re: Thank you for marching",
    text: "Could you take me off this list please?",
    automatic: false,
    outcome: null,
    dealtBy: null,
    dealtAt: null,
    doNotEmail: false,
    account: "hello@pauseai.uk",
    answerable: true,
    reactable: false,
    kind: null,
    reactionTo: null,
    removedAt: null,
  },
];

/** Jo's answer to Jane's question (exampleBroadcastReplies). */
export const exampleBroadcastAnswers: BroadcastAnswer[] = [
  {
    id: 1,
    providerId: "wamid.example-1",
    replyId: 4,
    sentBy: "jo@pauseai.uk",
    sentAt: new Date("2026-11-07T10:05:00Z"),
    body: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hi Jane, it's on 6 December. See you there!" }] },
      ],
    },
    // An email's answer: nothing more is heard of it.
    events: [],
    fromGmail: false,
  },
];

/**
 * Replies to a text, by WhatsApp, oldest first: Jane's question, which Jo
 * answered, and her thanks, waiting for staff, still within WhatsApp's day.
 */
export const exampleTextReplies: BroadcastReply[] = [
  {
    id: 11,
    providerId: "wamid.example-11",
    receivedAt: new Date("2026-11-07T07:30:00Z"),
    from: "+447700900001",
    subject: "",
    text: "Is it the same place as last time?",
    automatic: false,
    outcome: "answered",
    dealtBy: "jo@pauseai.uk",
    dealtAt: new Date("2026-11-07T07:45:00Z"),
    doNotEmail: false,
    account: null,
    answerable: true,
    reactable: true,
    kind: null,
    reactionTo: null,
    removedAt: null,
  },
  {
    id: 12,
    providerId: "wamid.example-12",
    receivedAt: new Date("2026-11-07T08:00:00Z"),
    from: "+447700900001",
    subject: "",
    text: "Great, thanks!",
    automatic: false,
    outcome: null,
    dealtBy: null,
    dealtAt: null,
    doNotEmail: false,
    account: null,
    answerable: true,
    reactable: true,
    kind: null,
    reactionTo: null,
    removedAt: null,
  },
];

/** Jo's answer to Jane's question by text (exampleTextReplies). */
export const exampleTextAnswers: BroadcastAnswer[] = [
  {
    id: 11,
    providerId: "wamid.example-11",
    replyId: 11,
    sentBy: "jo@pauseai.uk",
    fromGmail: false,
    sentAt: new Date("2026-11-07T07:45:00Z"),
    body: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Yes, Parliament Square, by the statue." }] }],
    },
    // Read by Jane, newest first.
    events: [
      { at: new Date("2026-11-07T07:50:00Z"), kind: "read", details: {} },
      { at: new Date("2026-11-07T07:46:00Z"), kind: "delivered", details: {} },
    ],
  },
];

/**
 * Replies to a text that are more than words, oldest first: a thumbs up to
 * the broadcast, which Jane then took back; a heart to Jo's answer
 * (exampleTextAnswers); a reaction from before emojis were kept; a photo
 * with a caption; a place; a voice note; and a kind with no name here.
 */
export const exampleTextKinds: BroadcastReply[] = [
  {
    ...exampleTextReplies[1],
    id: 21,
    providerId: "wamid.example-21",
    receivedAt: new Date("2026-11-07T08:05:00Z"),
    text: "👍",
    kind: "reaction",
    reactable: false,
    reactionTo: exampleMessageCopy.providerId,
    removedAt: new Date("2026-11-07T08:06:00Z"),
    outcome: "nothing",
    dealtBy: "jo@pauseai.uk",
    dealtAt: new Date("2026-11-07T08:30:00Z"),
  },
  {
    ...exampleTextReplies[1],
    id: 22,
    providerId: "wamid.example-22",
    receivedAt: new Date("2026-11-07T08:07:00Z"),
    text: "❤️",
    kind: "reaction",
    reactable: false,
    reactionTo: exampleTextAnswers[0].providerId,
    outcome: "nothing",
    dealtBy: "jo@pauseai.uk",
    dealtAt: new Date("2026-11-07T08:30:00Z"),
  },
  {
    ...exampleTextReplies[1],
    id: 23,
    providerId: "wamid.example-23",
    receivedAt: new Date("2026-11-07T08:08:00Z"),
    text: null,
    kind: "reaction",
    reactable: false,
    outcome: "nothing",
    dealtBy: "jo@pauseai.uk",
    dealtAt: new Date("2026-11-07T08:30:00Z"),
  },
  {
    ...exampleTextReplies[1],
    id: 24,
    providerId: "wamid.example-24",
    receivedAt: new Date("2026-11-07T08:10:00Z"),
    text: "Our banner from last time",
    kind: "image",
    outcome: "nothing",
    dealtBy: "jo@pauseai.uk",
    dealtAt: new Date("2026-11-07T08:30:00Z"),
  },
  {
    ...exampleTextReplies[1],
    id: 25,
    providerId: "wamid.example-25",
    receivedAt: new Date("2026-11-07T08:12:00Z"),
    text: "Parliament Square\nLondon SW1P 3JX\nhttps://www.google.com/maps/search/?api=1&query=51.5007,-0.1268",
    kind: "location",
    outcome: "nothing",
    dealtBy: "jo@pauseai.uk",
    dealtAt: new Date("2026-11-07T08:30:00Z"),
  },
  {
    ...exampleTextReplies[1],
    id: 26,
    providerId: "wamid.example-26",
    receivedAt: new Date("2026-11-07T08:14:00Z"),
    text: null,
    kind: "voice",
    outcome: "nothing",
    dealtBy: "jo@pauseai.uk",
    dealtAt: new Date("2026-11-07T08:30:00Z"),
  },
  {
    ...exampleTextReplies[1],
    id: 27,
    providerId: "wamid.example-27",
    receivedAt: new Date("2026-11-07T08:16:00Z"),
    text: null,
    kind: "poll",
  },
];

/** A reply to a text more than a day old, which WhatsApp takes no answer to. */
export const exampleTextReplyPastDay: BroadcastReply = { ...exampleTextReplies[1], id: 13, answerable: false };

/** Jo's 👍 on Jane's thanks (exampleTextReplies), which first went as a ❤️; and a 🙏 WhatsApp couldn't deliver. */
export const exampleTextReactions: BroadcastReaction[] = [
  {
    id: 31,
    replyId: 12,
    emoji: "❤️",
    sentBy: "jo@pauseai.uk",
    sentAt: new Date("2026-11-07T08:20:00Z"),
    removedAt: new Date("2026-11-07T08:21:00Z"),
    events: [],
  },
  {
    id: 32,
    replyId: 12,
    emoji: "👍",
    sentBy: "jo@pauseai.uk",
    sentAt: new Date("2026-11-07T08:21:00Z"),
    removedAt: null,
    events: [],
  },
];

/** A 🙏 on Jane's thanks that WhatsApp couldn't deliver. */
export const exampleUndeliveredReaction: BroadcastReaction = {
  ...exampleTextReactions[1],
  id: 33,
  emoji: "🙏",
  events: [
    {
      at: new Date("2026-11-07T08:22:00Z"),
      kind: "failed",
      details: { code: 131009, title: "Parameter value is not valid" },
    },
  ],
};
