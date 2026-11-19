import type { EmailBlock } from "@/lib/email/email.server";
import type { Block } from "@/lib/oversight/blocks.server";

/** The test MP's address, blocked by a letter's hard bounce, with two emails not sent since. */
export const exampleBlock: EmailBlock = {
  address: "no-such-mailbox@pauseai.uk",
  kind: "hard",
  reason: "The server was unable to deliver your message (ex: unknown user, mailbox not found).",
  since: new Date("2026-10-12T09:10:00Z"),
  canReset: true,
  foundInGmail: false,
  mailbox: null,
  politicians: [{ id: 5, name: "Bouncy McTestface MP", isTest: true }],
  supporters: [],
  letter: { id: 17, to: "Bouncy McTestface MP" },
  purpose: "letter",
  copy: null,
  refused: 2,
};

/** A supporter's address, blocked by a spam complaint about a forwarded reply, which can't be unblocked. */
export const exampleComplaint: EmailBlock = {
  address: "sender@example.org",
  kind: "complaint",
  reason: "",
  since: new Date("2026-10-11T15:00:00Z"),
  canReset: false,
  foundInGmail: false,
  mailbox: null,
  politicians: [],
  supporters: [{ id: 7, name: "Jane Example" }],
  letter: null,
  purpose: "forwarded-reply",
  copy: null,
  refused: 0,
};

/** A politician's address, blocked by a mailing's letter that bounced, found in the sender's Gmail, with Gmail's long reason, folded to its first sentence. */
export const exampleGmailBlock: EmailBlock = {
  address: "old.office@parliament.uk",
  kind: "hard",
  reason:
    "550-5.1.1 The email account that you tried to reach does not exist. Please try 550-5.1.1 double-checking the recipient's email address for typos or 550-5.1.1 unnecessary spaces. For more information, go to 550 5.1.1 https://support.google.com/mail/?p=NoSuchUser 9xyz1234a5b6c-7d890ef1234sor5678901e87.1 - gsmtp",
  since: new Date("2026-10-13T10:00:00Z"),
  canReset: true,
  foundInGmail: true,
  mailbox: "policy@pauseai.uk",
  politicians: [{ id: 6, name: "Polly Placeholder", isTest: false }],
  supporters: [],
  letter: { id: 21, to: "Polly Placeholder" },
  purpose: "mailing",
  copy: null,
  refused: 0,
};

/** An address's block as the list gives it: by email, with its history, by default the problem that blocked it. */
export function listed(block: EmailBlock, history?: Block["history"]): Block {
  return {
    ...block,
    channel: "email",
    triesFrom: null,
    history: history ?? [{ at: block.since, what: block.kind, reason: block.reason, mailbox: block.mailbox }],
  };
}

/** A broadcast's copy, by text, that WhatsApp refused. */
const refusedCopy = { id: 41, broadcast: 9, title: "Join us in Manchester" };

/**
 * A supporter's number WhatsApp couldn't deliver a text to, two texts
 * skipped since; texts try it again two months after, which is after the
 * gallery's day. Unblocked once before, after an earlier refusal.
 */
export const exampleNumber: Block = {
  channel: "text",
  address: "+447700900123",
  kind: "not-on-whatsapp",
  reason: "",
  since: new Date("2026-10-14T08:03:00Z"),
  canReset: true,
  foundInGmail: false,
  mailbox: null,
  politicians: [],
  supporters: [{ id: 7, name: "Jane Example" }],
  letter: null,
  purpose: "broadcast",
  copy: refusedCopy,
  refused: 2,
  triesFrom: new Date("2026-12-14T08:03:00Z"),
  history: [
    { at: new Date("2026-10-21T08:03:00Z"), what: "skipped", copy: { id: 52, broadcast: 11, title: "Lobby day" } },
    { at: new Date("2026-10-14T08:03:00Z"), what: "refused", copy: refusedCopy },
    { at: new Date("2026-09-30T12:00:00Z"), what: "unblocked", by: "jo@pauseai.uk", note: "She's on WhatsApp now" },
    { at: new Date("2026-08-01T08:03:00Z"), what: "refused", copy: { id: 12, broadcast: 3, title: "Summer social" } },
  ],
};

/** A supporter's address, blocked by a broadcast's email that bounced, a soft bounce before it. */
export const exampleBroadcastBlock: Block = listed(
  {
    ...exampleComplaint,
    address: "jane@example.com",
    kind: "hard",
    reason: "Unknown user",
    canReset: true,
    since: new Date("2026-10-15T09:00:00Z"),
    purpose: "broadcast",
    copy: { id: 44, broadcast: 9, title: "Join us in Manchester" },
    refused: 1,
  },
  [
    { at: new Date("2026-10-15T09:00:00Z"), what: "hard", reason: "Unknown user", mailbox: null },
    { at: new Date("2026-10-10T09:00:00Z"), what: "soft", reason: "Mailbox full", mailbox: "jo@pauseai.uk" },
  ],
);

/** A supporter's address on hold in CiviCRM, which no email of ours found out. */
export const exampleHold: Block = listed({
  ...exampleComplaint,
  address: "held@example.org",
  kind: "hold",
  reason: "Usually as its emails to it bounced",
  canReset: true,
  purpose: null,
});

/** A bounce read from a staff member's mailbox, of an email the site has no record of sending. */
export const exampleMailboxBlock: Block = listed({
  ...exampleGmailBlock,
  address: "typo@example.org",
  politicians: [],
  supporters: [],
  letter: null,
  purpose: null,
  mailbox: "joseph@pauseai.uk",
});
