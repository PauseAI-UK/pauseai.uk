import { describe, expect, it } from "vitest";
import { campaigns } from "@/lib/content/email-your-mp";
import { exampleLetters } from "@/app/(site)/campaigns/_components/draft.examples";
import {
  addressLines,
  campaignBySlug,
  campaignForAsk,
  codeCampaign,
  campaignToMoveTo,
  chooseCampaign,
  trackedAsks,
  trackedCampaigns,
  draftLetter,
  isDone,
  letterValues,
  signatureAddress,
  unpublishable,
} from "./email-your-mp";
import { EMPTY_MAILING_DOC } from "@/lib/mailings/doc";
import { toHtml, toText } from "@/lib/letters/format";

const [letterToPm, bill] = campaigns;
const ADDRESS = ["1 High St", "SW1A 1AA"];
const details = {
  salutation: "Ms Dummy",
  mpName: "Diane Dummy MP",
  constituency: "Hackney North",
  senderName: "Jane Smith",
  statuses: {},
};

describe("campaigns", () => {
  it("finds a campaign by slug", () => {
    expect(campaignBySlug(bill.slug)).toBe(bill);
    expect(campaignBySlug("nope")).toBeUndefined();
    expect(codeCampaign(bill.slug)).toBe(bill);
    expect(() => codeCampaign("nope")).toThrow();
  });

  it("counts a campaign done only with the status it asks for", () => {
    expect(isDone(letterToPm, { [letterToPm.ask!]: "signed" })).toBe(true);
    expect(isDone(letterToPm, { [letterToPm.ask!]: "declined" })).toBe(false);
    expect(isDone(letterToPm, { "controlai-letter": "signed" })).toBe(false);
    expect(isDone(letterToPm, {})).toBe(false);
  });

  it("never counts a campaign without a done status as done", () => {
    expect(bill.done).toBeUndefined();
    expect(isDone(bill, {})).toBe(false);
    expect(isDone(bill, { "controlai-letter": "signed" })).toBe(false);
  });

  it("leaves campaigns nobody has done out of the staff interface, which records their asks", () => {
    expect(trackedCampaigns).toEqual([letterToPm]);
    expect(trackedAsks).toEqual(["frontier-ai-letter"]);
  });

  it("finds the campaign that makes an ask", () => {
    expect(campaignForAsk("frontier-ai-letter")).toBe(letterToPm);
    expect(campaignForAsk("controlai-letter")).toBeUndefined();
    expect(campaignForAsk("deepmind-letter")).toBeUndefined();
  });

  it("ends with a campaign nobody has done, so there's always one to move on to", () => {
    expect(campaigns.at(-1)!.done).toBeUndefined();
  });

  it("picks the first campaign the MP hasn't done", () => {
    expect(chooseCampaign({})).toBe(letterToPm);
    expect(chooseCampaign({ [letterToPm.ask!]: "signed" })).toBe(bill);
  });

  it("moves on from a campaign the MP has done to the first they haven't", () => {
    expect(campaignToMoveTo(letterToPm, {})).toBeUndefined();
    expect(campaignToMoveTo(letterToPm, { [letterToPm.ask!]: "signed" })).toBe(bill);
    expect(campaignToMoveTo(bill, { [letterToPm.ask!]: "signed", "controlai-letter": "signed" })).toBeUndefined();
  });
});

describe("letters", () => {
  it("fills a campaign's letter in with the MP's details and the sender's name", () => {
    const draft = toText(draftLetter(exampleLetters[letterToPm.slug].body, details, ADDRESS));
    expect(draft).toContain("Dear Ms Dummy,");
    expect(draft).toContain("I live in Hackney North.");
    expect(letterValues(details).values).toEqual({
      salutation: "Ms Dummy",
      name: "Diane Dummy MP",
      constituency: "Hackney North",
      sender: "Jane Smith",
    });
  });

  it("keeps a part only for MPs with an answer for those who gave it, and none for an ask with no answer", () => {
    const body = exampleLetters[bill.slug].body;
    const signed = { ...details, statuses: { "controlai-letter": "signed" as const, "frontier-ai-letter": undefined } };
    expect(letterValues(signed).meets).toEqual(["controlai-letter:signed"]);
    expect(toText(draftLetter(body, signed, ADDRESS))).toContain("Thank you for signing.");
    expect(toText(draftLetter(body, signed, ADDRESS))).toContain("Please come to the debate.");
    expect(toText(draftLetter(body, details, ADDRESS))).not.toContain("Thank you for signing.");
  });

  it("ends each draft with the sender's name, then their address, a line each", () => {
    for (const campaign of campaigns) {
      const draft = draftLetter(exampleLetters[campaign.slug].body, details, ADDRESS);
      expect(toText(draft).endsWith("\n\nJane Smith\n\n1 High St\nSW1A 1AA")).toBe(true);
      expect(toHtml(draft).endsWith("<p>Jane Smith</p>\n<p>1 High St<br>SW1A 1AA</p>")).toBe(true);
    }
  });

  it("publishes a draft only with a subject and a letter", () => {
    const { body } = exampleLetters[bill.slug];
    expect(unpublishable({ subject: "Come", body })).toBeUndefined();
    expect(unpublishable({ subject: " ", body })).toBe("no-subject");
    expect(unpublishable({ subject: "Come", body: EMPTY_MAILING_DOC })).toBe("no-letter");
  });

  it("ends the address with the postcode, unless it's already there", () => {
    expect(signatureAddress("1 High St\nLondon", "sw1a 1aa ")).toEqual(["1 High St", "London", "SW1A 1AA"]);
    expect(signatureAddress("1 High St\nLondon SW1A1AA", "SW1A 1AA")).toEqual(["1 High St", "London SW1A1AA"]);
  });

  it("turns a typed address into lines", () => {
    expect(addressLines(" 1 High St \n\n London\nSW1A 1AA\n")).toEqual(["1 High St", "London", "SW1A 1AA"]);
  });
});
