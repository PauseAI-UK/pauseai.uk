import type { CampaignSummary, CampaignVersion } from "@/lib/server/campaigns";
import type { OneOffThread, OneOffThreadRow } from "@/lib/server/one-off-emails";
import type { SentEmail } from "@/lib/server/sent-emails";

// Fake data for the pages of campaigns, sent emails and one-off emails,
// for their tests and the gallery.

/** A campaign with an ask, a letter that bounced, and its letters over several months. */
export const exampleCampaign: CampaignSummary = {
  slug: "pauseai-info-frontier-ai",
  title: "Regulate AI developers now (Airtable)",
  ask: "frontier-ai-letter",
  askTitle: "Frontier AI letter to the Prime Minister",
  askKind: "letter",
  url: null,
  letters: 12,
  // Three answered of the politicians written to, two letters' replies, and a bounce.
  states: { sent: 7, replied: 2, answered: 2, spam: 0, error: 0, unreached: 1, "not-sent": 0 },
  answered: 3,
  politicians: 9,
  supporters: 10,
  firstAt: new Date("2026-06-18T09:00:00Z"),
  lastAt: new Date("2026-10-22T09:00:00Z"),
};

/** A campaign with no ask, whose letters are from last year. */
export const exampleCampaignNoAsk: CampaignSummary = {
  ...exampleCampaign,
  slug: "pauseai-info-liability",
  title: "Legislate for liability for AI model severe harm",
  ask: null,
  askTitle: null,
  askKind: null,
  answered: 0,
  states: { sent: 10, replied: 2, answered: 0, spam: 0, error: 0, unreached: 0, "not-sent": 0 },
  firstAt: new Date("2025-05-20T09:00:00Z"),
  lastAt: new Date("2025-06-17T09:00:00Z"),
};

/** A campaign nobody has written to anyone for. */
export const exampleCampaignEmpty: CampaignSummary = {
  ...exampleCampaignNoAsk,
  slug: "support-sobel-bill",
  title: "Support the bill",
  letters: 0,
  states: { sent: 0, replied: 0, answered: 0, spam: 0, error: 0, unreached: 0, "not-sent": 0 },
  politicians: 0,
  supporters: 0,
  firstAt: null,
  lastAt: null,
};

export const exampleVersions: CampaignVersion[] = [
  {
    key: "newer",
    from: new Date("2026-09-23T02:00:00Z"),
    letters: 4,
    subject: "Request to co-sign letter on frontier AI risks",
    text: "Dear {salutation}\n\nI'm a resident of {constituency} and a supporter of **PauseAI**.\n\n{name}\n\n{postcode}",
  },
  {
    key: "older",
    from: new Date("2026-06-18T02:00:00Z"),
    letters: 8,
    subject: "Please sign the letter",
    text: "Dear {salutation}\n\nPlease sign the letter.\n\n{name}",
  },
];

export const exampleChanged = 6;

/** A thread only with PauseAI, and one with someone else in it. */
export const exampleOneOffs: OneOffThreadRow[] = [
  {
    id: 1,
    subject: "Meeting about the bill",
    someoneElse: false,
    latestAt: new Date("2026-10-20T09:00:00Z"),
    messages: 2,
    people: [{ id: 1, name: "Polly Placeholder", isTest: false }],
    participants: ["Joseph Example", "Polly Placeholder"],
    mailboxes: ["joseph@pauseai.uk", "policy@pauseai.uk"],
    answered: true,
  },
  {
    id: 2,
    subject: "Fwd: my MP's answer",
    someoneElse: true,
    latestAt: new Date("2026-10-19T09:00:00Z"),
    messages: 1,
    people: [],
    participants: ["Jane Smith"],
    mailboxes: ["policy@pauseai.uk"],
    answered: false,
  },
];

/** A thread as staff without `supporters` see one with someone else in it. */
export const exampleHiddenOneOff: OneOffThreadRow = {
  ...exampleOneOffs[1],
  subject: null,
  participants: null,
  mailboxes: null,
  answered: null,
};

export const exampleOneOffThread: OneOffThread = {
  ...exampleOneOffs[0],
  messages_: [
    {
      id: 1,
      at: new Date("2026-10-19T09:00:00Z"),
      fromName: "Joseph Example",
      fromAddress: "joseph@pauseai.uk",
      to: '"Placeholder, Polly" <polly.placeholder.mp@parliament.uk>, Jane Smith <jane.smith@example.com>',
      cc: "",
      subject: "Meeting about the bill",
      account: "joseph@pauseai.uk",
      politicians: { "polly.placeholder.mp@parliament.uk": 1 },
      text: "Dear Polly,\n\nCould we meet?",
      quoted: "",
      auto: false,
      forwarded: [],
    },
    {
      id: 2,
      at: new Date("2026-10-20T09:00:00Z"),
      fromName: "",
      fromAddress: "polly.placeholder.mp@parliament.uk",
      to: "joseph@pauseai.uk",
      cc: "someone@example.com",
      subject: "Re: Meeting about the bill",
      account: "joseph@pauseai.uk",
      politicians: { "polly.placeholder.mp@parliament.uk": 1 },
      text: null,
      quoted: "",
      auto: false,
      forwarded: [],
    },
    {
      id: 3,
      at: new Date("2026-10-20T09:01:00Z"),
      fromName: "Polly Placeholder",
      fromAddress: "polly.placeholder.mp@parliament.uk",
      to: "joseph@pauseai.uk",
      cc: "",
      subject: "Automatic reply: Meeting about the bill",
      account: "joseph@pauseai.uk",
      politicians: { "polly.placeholder.mp@parliament.uk": 1 },
      text: "I'm away until Monday.\n\nThis email may be confidential.",
      quoted: "> Could we meet?",
      auto: true,
      forwarded: [],
    },
  ],
};

/**
 * A supporter's forward of their MP's answer to policy@: the letter and the
 * answer rebuilt before it, the letter from an "On … wrote:" line, which says
 * nothing of whom it was to.
 */
export const exampleForwardThread: OneOffThread = {
  ...exampleOneOffs[1],
  people: [{ id: 1, name: "Polly Placeholder", isTest: false }],
  messages_: [
    {
      id: 4,
      at: new Date("2026-10-19T09:00:00Z"),
      fromName: "Jane Smith",
      fromAddress: "jane.smith@example.com",
      to: "policy@pauseai.uk",
      cc: "",
      subject: "Fwd: my MP's answer",
      account: "policy@pauseai.uk",
      politicians: {},
      text: "",
      quoted: "",
      auto: false,
      forwarded: [
        {
          fromName: "Jane Smith",
          fromAddress: "jane.smith@example.com",
          to: "",
          cc: "",
          sent: "15 Oct 2026, at 11:17",
          subject: "Can we meet?",
          politicians: {},
          text: "Dear Polly,\n\nI'm a constituent. Could we meet in Westminster Hall?",
          quoted: "",
        },
        {
          fromName: "Polly Placeholder MP",
          fromAddress: "pollyplaceholdermp@parliament.uk",
          to: "Jane Smith <jane.smith@example.com>",
          cc: "",
          sent: "Fri, Oct 16, 2026 at 12:13 PM",
          subject: "Re: Can we meet?",
          politicians: { "pollyplaceholdermp@parliament.uk": 1 },
          text: "Dear Jane,\n\nThank you for writing. I'm sorry I can't meet this week.\n\nPolly",
          quoted: "UK Parliament Disclaimer: this e-mail is confidential to the intended recipient.",
        },
      ],
    },
  ],
};

const SENT_ROW: SentEmail = {
  id: 1,
  at: new Date("2026-11-04T10:50:00Z"),
  purpose: "letter",
  imported: false,
  address: "polly.placeholder.mp@parliament.uk",
  outcome: "sent",
  problem: null,
  backend: "gmail",
  fromAddress: "write.to+jane.smith@pauseai.uk",
  subject: "Request to support the bill",
  letterId: 7,
  letterHref: "/staff/letters/7",
  campaignHref: "/staff/campaigns/support-sobel-bill",
  mailingHref: null,
  to: { name: "Polly Placeholder", href: "/staff/politicians/1" },
  from: { name: "Jane Smith", href: "/staff/supporters/5" },
};

/** Each kind of row: a letter; one bounced, with a supporter's name but no link; an imported mailing's; a sign-in. */
export const exampleSentEmails: SentEmail[] = [
  SENT_ROW,
  {
    ...SENT_ROW,
    id: 2,
    outcome: "bounced",
    problem: "hard",
    backend: "postmark",
    from: { name: "Sam Brown", href: null },
  },
  {
    ...SENT_ROW,
    id: 3,
    at: new Date("2025-06-20T09:00:00Z"),
    purpose: "mailing",
    imported: true,
    fromAddress: "joseph@pauseai.info",
    letterHref: "/staff/mailings/3/letters/9",
    campaignHref: null,
    mailingHref: "/staff/mailings/3",
    from: null,
  },
  {
    ...SENT_ROW,
    id: 4,
    purpose: "staff-login",
    address: "jo@pauseai.uk",
    fromAddress: "noreply@notify.pauseai.uk",
    backend: "postmark",
    subject: "Confirm sign in",
    letterId: null,
    letterHref: null,
    campaignHref: null,
    mailingHref: null,
    to: null,
    from: null,
  },
];
