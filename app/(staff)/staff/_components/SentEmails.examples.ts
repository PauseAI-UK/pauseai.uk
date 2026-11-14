import type { SentEmail } from "@/lib/server/sent-emails.server";

// Fake rows of the sent emails page, for its tests and the gallery.

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
