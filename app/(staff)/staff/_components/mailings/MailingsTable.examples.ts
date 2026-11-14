import type { Mailing, MailingSummary } from "@/lib/mailings/records.server";

/** No letters in any state, for an example to add its own. */
const NO_STATES: MailingSummary["states"] = {
  sent: 0,
  replied: 0,
  answered: 0,
  spam: 0,
  error: 0,
  unreached: 0,
  "not-sent": 0,
};

/** What every mailing has, for the examples to change. */
const mailing: MailingSummary = {
  id: 1,
  title: "",
  ask: null,
  askTitle: null,
  askKind: null,
  importedText: null,
  importedSubject: "",
  importedTextApproximate: false,
  imported: false,
  state: "sent",
  createdBy: null,
  fromName: null,
  sentFrom: null,
  dueAt: null,
  updatedAt: new Date("2026-10-28T10:00:00Z"),
  to: 0,
  sentAt: null,
  sent: 0,
  failed: 0,
  answered: 0,
  states: NO_STATES,
};

/**
 * A mailing written here, sent from Jo with an ask, two bounces, two replies
 * and three answers; one copied from Airtable, with an ask, one answer, one
 * bounce and one Gmail refused; one with no ask, not sent yet.
 */
export const exampleMailings: MailingSummary[] = [
  {
    ...mailing,
    id: 4,
    title: "Invitation: AI safety conference, Edinburgh",
    ask: "edinburgh-conference-2026",
    askKind: "event",
    askTitle: "Edinburgh conference",
    createdBy: "jo@pauseai.uk",
    fromName: "Jo Example",
    sentFrom: "jo@pauseai.uk",
    dueAt: new Date("2026-10-20T08:00:00Z"),
    to: 12,
    sentAt: new Date("2026-10-20T08:00:00Z"),
    sent: 10,
    failed: 2,
    answered: 3,
    states: { ...NO_STATES, sent: 5, replied: 2, answered: 3, unreached: 2 },
  },
  { ...mailing, id: 3, title: "Ben Lake October 2026 Debate", imported: false },
  {
    ...mailing,
    id: 2,
    title: "Edinburgh Conference Nov 26 Invitation",
    ask: "edinburgh-conference-2026",
    askKind: "event",
    askTitle: "Edinburgh conference",
    imported: true,
    to: 4,
    sentAt: new Date("2026-10-01T09:00:00Z"),
    sent: 2,
    failed: 2,
    answered: 1,
    states: { ...NO_STATES, sent: 1, answered: 1, unreached: 1, error: 1 },
  },
];

/** A draft to the Commons, and one scheduled for Thursday, written by Jo, from Jo's Gmail with no name of its own. */
export const exampleDraft: MailingSummary = {
  ...mailing,
  id: 5,
  title: "Meet us in Westminster",
  state: "draft",
  createdBy: "jo@pauseai.uk",
  to: 412,
};
export const exampleScheduled: MailingSummary = {
  ...mailing,
  id: 6,
  title: "Edinburgh: one week to go",
  state: "scheduled",
  createdBy: "jo@pauseai.uk",
  // With no name of its own, the list's name is its address.
  fromName: "jo@pauseai.uk",
  sentFrom: "jo@pauseai.uk",
  dueAt: new Date("2026-10-30T09:00:00Z"),
  to: 72,
};

/** One sending to every MP, a third of the way. */
export const exampleSending: MailingSummary = {
  ...mailing,
  id: 8,
  title: "All MPs: the AI bill's second reading",
  state: "sending",
  createdBy: "jo@pauseai.uk",
  fromName: "Jo Example",
  dueAt: new Date("2026-10-30T09:00:00Z"),
  to: 650,
  sent: 209,
  failed: 5,
  states: { ...NO_STATES, sent: 205, replied: 4, unreached: 3, error: 2 },
};

/** The Edinburgh invitation, with its recipients: one personalised who replied twice, one that bounced, one left out. */
export const exampleMailing: Mailing = {
  ...exampleMailings[2],
  tab: "all",
  recipientsTotal: 3,
  page: 1,
  pages: 1,
  pageSize: 100,
  recipients: [
    {
      letterId: 11,
      politicianId: 7,
      name: "Polly Placeholder",
      isTest: false,
      constituency: "Cities of London and Westminster",
      party: "Labour (Co-op)",
      status: "sent",
      sentAt: new Date("2026-10-01T09:00:00Z"),
      repliedAt: new Date("2026-10-03T14:00:00Z"),
      autoReplied: false,
      replies: 2,
      personalised: true,
      answer: "going",
      skipReason: null,
    },
    {
      letterId: 12,
      politicianId: 8,
      name: "Morag Example",
      isTest: false,
      constituency: "Edinburgh Central",
      party: "SNP",
      status: "bounced",
      sentAt: new Date("2026-10-01T09:00:00Z"),
      repliedAt: null,
      autoReplied: false,
      replies: 0,
      personalised: false,
      answer: null,
      skipReason: null,
    },
    {
      letterId: 13,
      politicianId: 9,
      name: "Dora Dummy",
      isTest: false,
      constituency: null,
      party: "Crossbench",
      status: "not_sent",
      sentAt: null,
      repliedAt: null,
      autoReplied: false,
      replies: 0,
      personalised: false,
      answer: null,
      skipReason: null,
    },
  ],
};
