import type { LetterThread } from "@/lib/letters/threads.server";
import type { GmailAccount } from "@/lib/accounts/gmail-accounts.server";

/** Jo's letter to Polly, from Jo's Gmail, which Polly answered and Jo answered back. */
export const exampleThread: LetterThread = {
  approximate: false,
  mailingTitle: "Edinburgh follow-up",
  to: { name: "Polly Placeholder", email: "polly.placeholder.mp@parliament.uk" },
  sentAt: new Date("2026-10-09T09:00:00Z"),
  subject: "Edinburgh follow-up",
  letter: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Dear Ms Placeholder," }] },
      { type: "paragraph", content: [{ type: "text", text: "Will you come and meet us?" }] },
    ],
  },
  sentFrom: "jo@pauseai.uk",
  fromName: "Jo Seed",
  gmailThreadId: "thread-seed-2",
  messages: [
    {
      id: 1,
      at: new Date("2026-10-10T09:00:00Z"),
      fromName: "Polly Placeholder",
      fromAddress: "polly.placeholder.mp@parliament.uk",
      fromUs: false,
      fromSupporter: false,
      auto: false,
      subject: "Re: Edinburgh follow-up",
      text: "Dear Jo,\n\nThank you for writing to me. I'd be glad to meet.\n\nPolly",
      quoted: "On 5 Jun 2026, Jo wrote:\n> Will you come and meet us?",
      cc: null,
    },
    {
      id: 2,
      at: new Date("2026-10-10T11:30:00Z"),
      fromName: "Jo Seed",
      fromAddress: "jo@pauseai.uk",
      fromUs: true,
      fromSupporter: false,
      auto: false,
      subject: "Re: Edinburgh follow-up",
      text: null,
      quoted: "",
      cc: null,
    },
  ],
};

/** An imported letter: no text, never sent from a Gmail, no replies. */
export const exampleImportedThread: LetterThread = {
  ...exampleThread,
  letter: null,
  sentFrom: null,
  fromName: null,
  gmailThreadId: null,
  sentAt: null,
  messages: [],
};

/** Jo's Gmail, connected, with some sent today. */
export const exampleGmailAccount: GmailAccount = {
  email: "jo@pauseai.uk",
  name: "Jo Seed",
  connectedAt: new Date("2026-10-01T09:00:00Z"),
  sentToday: 120,
  remaining: 1680,
};
