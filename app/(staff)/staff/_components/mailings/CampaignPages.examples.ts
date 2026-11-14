import type { CampaignSummary, CampaignVersion } from "@/lib/mailings/campaigns.server";

// Fake data for the pages of campaigns, for their tests and the gallery.

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
