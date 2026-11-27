import { CONTROLAI_LETTER_ASK } from "@/lib/asks/asks";
import { campaigns } from "@/lib/content/email-your-mp";
import type { CampaignLetter } from "@/lib/email-your-mp";
import type { MailingParagraph } from "@/lib/mailings/doc";
import type { Draft, Lookup } from "./draft.client";

const [letterToPm, bill] = campaigns;

const words = (text: string): MailingParagraph => ({ type: "paragraph", content: [{ type: "text", text }] });
const greeting: MailingParagraph = {
  type: "paragraph",
  content: [
    { type: "text", text: "Dear " },
    { type: "field", attrs: { field: "salutation" } },
    { type: "text", text: "," },
  ],
};
const signed: MailingParagraph = { type: "paragraph", content: [{ type: "field", attrs: { field: "sender" } }] };

/**
 * A published letter for each campaign, as staff write them, for the tests
 * and the gallery: the bill's thanks an MP who signed ControlAI's letter.
 */
export const exampleLetters: Record<string, CampaignLetter> = {
  [letterToPm.slug]: {
    id: 1,
    subject: "Please sign the open letter",
    body: {
      type: "doc",
      content: [
        greeting,
        {
          type: "paragraph",
          content: [
            { type: "text", text: "I live in " },
            { type: "field", attrs: { field: "constituency" } },
            { type: "text", text: ". Please sign the " },
            { type: "text", text: "open letter", marks: [{ type: "bold" }] },
            { type: "text", text: "." },
          ],
        },
        words("Thank you,"),
        signed,
      ],
    },
  },
  [bill.slug]: {
    id: 2,
    subject: "Please come to the debate",
    body: {
      type: "doc",
      content: [
        greeting,
        {
          type: "onlyFor",
          attrs: { condition: `${CONTROLAI_LETTER_ASK}:signed` },
          content: [words("Thank you for signing.")],
        },
        words("Please come to the debate."),
        signed,
      ],
    },
  },
};

/** An MP, made up, for the tests and the gallery. */
export const exampleMp = {
  name: "Polly Placeholder",
  salutation: "Ms Placeholder",
  constituency: "Cities of London and Westminster",
  email: "polly.placeholder.mp@parliament.uk",
};

/** "Find my MP" done for the letter to the PM: who's writing, and to whom. */
export const exampleLookup: Lookup = {
  campaign: letterToPm.slug,
  name: "Jane Smith",
  address: "1 High St",
  postcode: "SW1A 1AA",
  mp: exampleMp,
  statuses: {},
};

/** A letter to the PM's campaign, written and ready to preview. */
export const exampleDraft: Draft = {
  campaign: letterToPm.slug,
  name: "Jane Smith",
  postcode: "sw1a 1aa",
  mp: exampleMp,
  statuses: {},
  email: "jane@example.com",
  address: "1 High St\nLondon",
  subject: "My subject",
  letter: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "My " },
          { type: "text", text: "letter", marks: [{ type: "bold" }] },
        ],
      },
    ],
  },
  draftHash: "0badcafe",
  campaignLetterId: 1,
  nickname: "",
};
