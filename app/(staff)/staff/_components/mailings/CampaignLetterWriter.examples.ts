import type { Ask } from "@/lib/asks/records.server";
import type { PreviewMp } from "@/lib/mailings/campaign-letters.server";
import type { MailingChoice } from "@/lib/mailings/fields";

// Fake data for writing a campaign's letter (CampaignLetterWriter), for its tests and the gallery.

const words = (text: string) => ({ type: "paragraph" as const, content: [{ type: "text" as const, text }] });

/** The bill's draft, which thanks an MP who signed ControlAI's letter. */
export const exampleCampaignDraft = {
  id: 7,
  version: 3,
  subject: "Please come to the debate",
  body: {
    type: "doc" as const,
    content: [
      {
        type: "paragraph" as const,
        content: [
          { type: "text" as const, text: "Dear " },
          { type: "field" as const, attrs: { field: "salutation" } },
          { type: "text" as const, text: "," },
        ],
      },
      {
        type: "onlyFor" as const,
        attrs: { condition: "controlai-letter:signed" },
        content: [words("Thank you for signing.")],
      },
      words("Please come to the debate."),
      { type: "paragraph" as const, content: [{ type: "field" as const, attrs: { field: "sender" } }] },
    ],
  },
};

/** Two MPs to preview it for: one who signed ControlAI's letter, and one who didn't. */
export const exampleMps: PreviewMp[] = [
  {
    id: 1,
    name: "Backy McTestface MP",
    constituency: "Backshire",
    values: { salutation: "Mx McTestface", name: "Backy McTestface MP", constituency: "Backshire" },
    meets: ["controlai-letter:signed"],
  },
  {
    id: 2,
    name: "Testy McTestface MP",
    constituency: null,
    values: { salutation: "Mr McTestface", name: "Testy McTestface MP", constituency: "" },
    meets: [],
  },
];

/** ControlAI's letter, the ask its part is for. */
export const exampleAsks: Ask[] = [
  {
    slug: "controlai-letter",
    title: "ControlAI's letter to the Prime Minister",
    kind: "letter",
    date: "2026-09-11",
    url: "https://controlai.org/uk-pm-letter",
    askedBy: ["controlai"],
  },
];

/** Who a part can be for, as the editor offers it. */
export const exampleCampaignConditions: MailingChoice[] = [
  {
    id: "controlai-letter:signed",
    label: "signed ControlAI's letter to the Prime Minister",
    covers: 1,
    group: "ControlAI's letter to the Prime Minister",
    option: "Signed",
  },
];
