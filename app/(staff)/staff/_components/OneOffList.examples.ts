import type { OneOffThread, OneOffThreadRow } from "@/lib/server/one-off-emails.server";

// Fake one-off emails with politicians, for their tests and the gallery.

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
