import type { LetterDoc } from "@/lib/letter-format";
import { staffCopy } from "@/lib/content/staff-interface";
import type { MailingDoc } from "@/lib/mailing-doc";
import type { WhatsAppTemplate, WrittenBroadcast } from "@/lib/server/broadcast-drafts";
import type {
  MessageCopy,
  BroadcastPageData,
  BroadcastSummary,
  BroadcastWriterData,
} from "@/lib/server/broadcast-pages";
import type { BroadcastPart } from "@/lib/server/broadcast-recipients";
import type { SupporterChoices } from "@/lib/server/supporters";

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

const template = (id: number, name: string, more: Partial<WhatsAppTemplate> = {}): WhatsAppTemplate => ({
  id,
  name,
  body: exampleTextWords,
  status: "approved",
  createdBy: "jo@pauseai.uk",
  approvedAt: new Date("2026-10-20T10:00:00Z"),
  requestedAt: new Date("2026-10-19T10:00:00Z"),
  rejectedAt: null,
  rejectedReason: null,
  lastUsedAt: null,
  lastUsedTo: 0,
  ...more,
});

/** More templates than show at first: one used, one made in WhatsApp Manager. */
export const exampleTemplates: WhatsAppTemplate[] = [
  template(1, "The march meets at 11:00 at Parliament Square.", {
    lastUsedAt: new Date("2026-11-02T08:00:00Z"),
    lastUsedTo: 318,
  }),
  template(2, "PauseCon room change", { createdBy: null }),
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
    label: staffCopy.broadcastPages.conditions.wrote("Regulate AI"),
    group: staffCopy.broadcastPages.conditions.wroteGroup,
    option: "Regulate AI",
  },
  {
    id: "event:evt-pausecon",
    label: staffCopy.broadcastPages.conditions.registered("PauseCon 2026"),
    group: staffCopy.broadcastPages.conditions.registeredGroup,
    option: "PauseCon 2026, 14 Feb 2026",
    searchable: true,
  },
  {
    id: "event:evt-leeds",
    label: staffCopy.broadcastPages.conditions.registered("Leeds talk"),
    group: staffCopy.broadcastPages.conditions.registeredGroup,
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
  filter: { list: "supporters", params: { contact: "email:site-forms:yes", near: "LS1" } },
  choices: exampleSupporterChoices,
  unknown: [],
  count: 412,
  fields: [
    { id: "firstName", label: "First name", lacking: 23, fallback: true },
    { id: "name", label: "Name", lacking: 23, fallback: true },
  ],
  conditions: examplePartsCovering,
  senders: [
    {
      email: "jo@pauseai.uk",
      name: "Jo Example",
      connectedAt: new Date("2026-10-01T10:00:00Z"),
      sentToday: 12,
      remaining: 1988,
    },
  ],
  me: "jo@pauseai.uk",
  sends: true,
  templates: exampleTemplates,
  textNumber: "+447700900000",
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
  topic: "site-forms",
  template: null,
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
  topic: "luma-calendar",
  filter: { list: "supporters", params: { contact: "phone:luma-calendar:yes" } },
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
  updatedAt: new Date("2026-10-18T10:00:00Z"),
  to: 290,
  sentAt: new Date("2026-10-18T10:00:00Z"),
  sent: 276,
  failed: 6,
  stopped: 8,
  replied: 0,
  answered: 0,
  channel: "email",
  delivered: 276,
  read: 0,
  waiting: false,
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
      read: true,
    },
    {
      copyId: 22,
      supporterId: 8,
      name: "Sam",
      place: null,
      status: "failed",
      skipReason: null,
      sentAt: new Date("2026-10-18T10:00:00Z"),
      read: false,
    },
    {
      copyId: 23,
      supporterId: 9,
      name: null,
      place: null,
      status: "skipped",
      skipReason: "blocked",
      sentAt: null,
      read: false,
    },
    {
      copyId: 24,
      supporterId: 11,
      name: "Tom Sample",
      place: null,
      status: "skipped",
      skipReason: "unsubscribed",
      sentAt: null,
      read: false,
    },
    {
      copyId: 25,
      supporterId: null,
      name: null,
      place: null,
      status: "delivered",
      skipReason: null,
      sentAt: new Date("2026-10-18T10:00:00Z"),
      read: false,
    },
  ],
};

/** A text sent to Jane, who read it. */
export const exampleMessageCopy: MessageCopy = {
  id: 21,
  messageId: 5,
  title: "March day: where to meet",
  channel: "text",
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
  place: "Leeds",
  sentAt: new Date("2026-11-07T07:18:00Z"),
  events: [
    { at: new Date("2026-11-07T07:40:00Z"), kind: "read", details: {} },
    { at: new Date("2026-11-07T07:18:30Z"), kind: "delivered", details: {} },
    { at: new Date("2026-11-07T07:18:00Z"), kind: "sent", details: { id: "wamid.example" } },
  ],
};
