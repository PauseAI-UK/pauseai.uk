import { expect, it } from "vitest";
import { addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "@/lib/server/db.server";
import { EMPTY_MAILING_DOC, type MailingDoc } from "./doc";
import { createCampaign } from "./made-campaigns.server";
import {
  campaignDraft,
  unpublishedDraft,
  campaignLetterChangesFrom,
  campaignWriterData,
  discardCampaignDraft,
  openDraft,
  publishCampaignDraft,
  publishedLetter,
  publishedVersion,
  saveCampaignDraft,
} from "./campaign-letters.server";

const BILL = "support-sobel-bill";
const words = (text: string): MailingDoc => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describeWithDatabase("campaign letters", () => {
  useTestDatabase();

  it("gives the version supporters start from, the latest published, with its subject and letter", async () => {
    const first = (await publishedLetter(BILL))!;
    expect(first.subject).toBe("Request to support the Artificial Superintelligence Bill");
    expect(first.body.content).toContainEqual({
      type: "onlyFor",
      attrs: { condition: "controlai-letter:signed" },
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Thank you for signing the ControlAI letter to the Prime Minister in support of the Bill.",
            },
          ],
        },
      ],
    });
    const draft = await openDraft(BILL, "jane@pauseai.uk", "Dear");
    await saveCampaignDraft(draft.id, draft.version, { subject: "Newer" }, "jane@pauseai.uk");
    // A draft isn't what supporters start from until it's published.
    expect((await publishedLetter(BILL))!.id).toBe(first.id);
    await publishCampaignDraft(draft.id, draft.version + 1, "jane@pauseai.uk");
    expect(await publishedLetter(BILL)).toMatchObject({ id: draft.id, subject: "Newer" });
    expect(await publishedLetter("pauseai-info-liability")).toBeNull();
  });

  it("finds a published version by its ID, only for its own campaign, and never a draft", async () => {
    const bill = (await publishedLetter(BILL))!;
    expect(await publishedVersion(BILL, bill.id)).toEqual(bill);
    expect(await publishedVersion("regulate-letter-pm", bill.id)).toBeUndefined();
    const draft = await openDraft(BILL, "jane@pauseai.uk", "Dear");
    expect(await publishedVersion(BILL, draft.id)).toBeUndefined();
  });

  it("opens a draft as a copy of the latest version, once, and keeps it till it's published or discarded", async () => {
    const latest = (await publishedLetter(BILL))!;
    expect(await campaignDraft(BILL)).toBeUndefined();
    const draft = await openDraft(BILL, "jane@pauseai.uk", "Dear");
    expect(draft).toMatchObject({
      campaign: BILL,
      subject: latest.subject,
      body: latest.body,
      version: 1,
      updatedBy: "jane@pauseai.uk",
      publishedAt: null,
      publishedBy: null,
    });
    // Opened again, by anyone, it's the same draft.
    expect((await openDraft(BILL, "sam@pauseai.uk", "Dear")).id).toBe(draft.id);
    expect((await campaignDraft(BILL))!.id).toBe(draft.id);
  });

  it("finds a draft with changes that aren't published, and not one left as it was opened", async () => {
    expect(await unpublishedDraft(BILL)).toBeNull();
    const draft = await openDraft(BILL, "jane@pauseai.uk", "Dear");
    expect(await unpublishedDraft(BILL)).toBeNull();
    await saveCampaignDraft(draft.id, 1, { subject: "Newer" }, "sam@pauseai.uk");
    expect(await unpublishedDraft(BILL)).toEqual({
      id: draft.id,
      updatedAt: expect.any(Date),
      updatedBy: "sam@pauseai.uk",
    });
    expect(await unpublishedDraft("pauseai-info-liability")).toBeUndefined();
    // One staff made has its draft from the start, waiting to be published.
    const body = EMPTY_MAILING_DOC;
    const made = await createCampaign({ title: "Stop", ask: null, subject: "", body }, "jo@pauseai.uk");
    expect(await unpublishedDraft(made)).toMatchObject({ updatedBy: "jo@pauseai.uk" });
  });

  it("opens a campaign with no letter yet on a greeting to the MP, with no subject", async () => {
    const draft = await openDraft("pauseai-info-liability", "jane@pauseai.uk", "Dear");
    expect(draft.subject).toBe("");
    expect(draft.body.content[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Dear " },
        { type: "field", attrs: { field: "salutation" } },
        { type: "text", text: "," },
      ],
    });
  });

  it("saves a draft at its version, refusing a save from behind, and says why once it's published or gone", async () => {
    const draft = await openDraft(BILL, "jane@pauseai.uk", "Dear");
    expect(await saveCampaignDraft(draft.id, 1, { body: words("New") }, "sam@pauseai.uk")).toEqual({
      saved: true,
      version: 2,
    });
    expect(await campaignDraft(BILL)).toMatchObject({
      body: words("New"),
      subject: draft.subject,
      updatedBy: "sam@pauseai.uk",
    });
    expect(await saveCampaignDraft(draft.id, 1, { subject: "Old" }, "jane@pauseai.uk")).toEqual({
      saved: false,
      reason: "conflict",
    });
    await publishCampaignDraft(draft.id, 2, "sam@pauseai.uk");
    expect(await saveCampaignDraft(draft.id, 2, { subject: "Late" }, "jane@pauseai.uk")).toEqual({
      saved: false,
      reason: "not-draft",
    });
    expect(await saveCampaignDraft(999_999, 1, { subject: "Gone" }, "jane@pauseai.uk")).toEqual({
      saved: false,
      reason: "gone",
    });
  });

  it("publishes a draft with a subject and a letter, by whom, and then never changes it", async () => {
    const draft = await openDraft(BILL, "jane@pauseai.uk", "Dear");
    await saveCampaignDraft(draft.id, 1, { subject: " " }, "jane@pauseai.uk");
    expect(await publishCampaignDraft(draft.id, 2, "jane@pauseai.uk")).toEqual({ saved: false, reason: "no-subject" });
    await saveCampaignDraft(draft.id, 2, { subject: "Come", body: EMPTY_MAILING_DOC }, "jane@pauseai.uk");
    expect(await publishCampaignDraft(draft.id, 3, "jane@pauseai.uk")).toEqual({ saved: false, reason: "no-letter" });
    await saveCampaignDraft(draft.id, 3, { body: words("Please come.") }, "jane@pauseai.uk");
    expect(await publishCampaignDraft(draft.id, 3, "jane@pauseai.uk")).toEqual({ saved: false, reason: "conflict" });
    expect(await publishCampaignDraft(draft.id, 4, "sam@pauseai.uk")).toEqual({ saved: true, version: 4 });
    const [row] = await query<{ by: string; at: boolean }>(
      `SELECT published_by AS by, published_at IS NOT NULL AS at FROM campaign_letters WHERE id = $1`,
      [draft.id],
    );
    expect(row).toEqual({ by: "sam@pauseai.uk", at: true });
    expect(await publishCampaignDraft(draft.id, 4, "sam@pauseai.uk")).toEqual({ saved: false, reason: "not-draft" });
    await expect(query("UPDATE campaign_letters SET subject = 'Changed' WHERE id = $1", [draft.id])).rejects.toThrow(
      /is published/,
    );
    await expect(query("UPDATE campaign_letters SET body = '{}' WHERE id = $1", [draft.id])).rejects.toThrow(
      /is published/,
    );
    // Its times can be set, as the storyboard's fixed clock does.
    await query("UPDATE campaign_letters SET published_at = '2026-10-16T12:00:00Z' WHERE id = $1", [draft.id]);
    expect(await campaignDraft(BILL)).toBeUndefined();
  });

  it("discards a draft, but never a published version", async () => {
    const draft = await openDraft(BILL, "jane@pauseai.uk", "Dear");
    expect(await discardCampaignDraft(draft.id)).toBe(true);
    expect(await campaignDraft(BILL)).toBeUndefined();
    expect(await discardCampaignDraft(draft.id)).toBe(false);
    const published = (await publishedLetter(BILL))!;
    expect(await discardCampaignDraft(published.id)).toBe(false);
    expect(await publishedLetter(BILL)).toEqual(published);
  });

  it("keeps a campaign to one draft", async () => {
    await openDraft(BILL, "jane@pauseai.uk", "Dear");
    await expect(
      query(
        `INSERT INTO campaign_letters (campaign, subject, body) VALUES ($1, 'Another', '{"type":"doc","content":[]}')`,
        [BILL],
      ),
    ).rejects.toThrow(/campaign_letters_one_draft/);
  });

  it("takes a save's subject and letter, and nothing else", () => {
    expect(campaignLetterChangesFrom({ subject: "Come", body: words("Hi") })).toEqual({
      subject: "Come",
      body: words("Hi"),
    });
    expect(campaignLetterChangesFrom({ subject: 4 })).toBeUndefined();
    expect(campaignLetterChangesFrom({ body: { type: "nope" } })).toBeUndefined();
    expect(campaignLetterChangesFrom({ dueAt: null })).toBeUndefined();
    expect(campaignLetterChangesFrom(null)).toBeUndefined();
    expect(campaignLetterChangesFrom("subject")).toBeUndefined();
  });

  it("offers every MP in office for the preview, test ones too, with their answers, and the asks' answers to choose", async () => {
    const polly = await addTestPolitician({ constituency: null });
    await addTestPolitician({
      name: "Testy McTestface MP",
      salutation: "Mr McTestface",
      testPostcode: "ZZ99ZZ",
      airtableId: null,
    });
    await addTestPolitician({ name: "Gone MP", status: "retired", airtableId: "c" });
    await addTestPolitician({ name: "A Lord", house: "lords", airtableId: "d" });
    await query(
      `INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, updated_by)
       VALUES ($1, 'controlai-letter', 'letter', 'signed', 'test')`,
      [polly],
    );
    const { mps, asks, conditions } = await campaignWriterData();
    expect(mps).toEqual([
      {
        id: polly,
        name: "Polly Placeholder",
        constituency: null,
        values: { salutation: "Ms Placeholder", name: "Polly Placeholder", constituency: "" },
        meets: ["controlai-letter:signed"],
      },
      expect.objectContaining({ name: "Testy McTestface MP", meets: [] }),
    ]);
    expect(asks.map((ask) => ask.slug)).toContain("controlai-letter");
    expect(conditions.find((choice) => choice.id === "controlai-letter:signed")).toMatchObject({ covers: 1 });
  });
});
