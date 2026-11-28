import { EMPTY_MAILING_DOC } from "@/lib/mailings/doc";
import { expect, it } from "vitest";
import { addTestLetter, addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { campaignVersions, getCampaignSummary, listCampaignSummaries } from "./campaigns.server";
import { query } from "@/lib/server/db.server";
import { createCampaign } from "./made-campaigns.server";

describeWithDatabase("campaigns", () => {
  useTestDatabase();

  it("counts each campaign's letters in each state, and who's answered its ask", async () => {
    const polly = await addTestPolitician();
    const dora = await addTestPolitician({ name: "Dora", email: "dora@parliament.uk", airtableId: "b" });
    const slug = "regulate-letter-pm";
    await addTestLetter({ politicianId: polly, campaign: slug, senderEmail: "a@example.com", createdAt: "2026-06-01" });
    await addTestLetter({
      politicianId: polly,
      campaign: slug,
      senderEmail: "A@example.com ",
      status: "bounced",
      createdAt: "2026-07-01",
    });
    await addTestLetter({
      politicianId: dora,
      campaign: slug,
      senderEmail: "b@example.com",
      repliedAt: "2026-08-01",
      createdAt: "2026-08-01",
    });
    await query(
      `INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, updated_by)
       VALUES ($1, 'frontier-ai-letter', 'letter', 'signed', 'test'), ($2, 'frontier-ai-letter', 'letter', 'invited', 'test')`,
      [polly, dora],
    );
    const campaign = await getCampaignSummary(slug);
    // Polly answered, and her letter that bounced is in its own state; Dora replied, and staff marking her as asked
    // is no answer.
    expect(campaign).toMatchObject({
      letters: 3,
      states: { sent: 0, replied: 1, answered: 1, spam: 0, error: 0, unreached: 1, "not-sent": 0 },
      answered: 1,
      politicians: 2,
      supporters: 2,
      ask: "frontier-ai-letter",
      askKind: "letter",
    });
    expect(new Date(campaign!.firstAt!)).toEqual(new Date("2026-06-01"));
    expect(new Date(campaign!.lastAt!)).toEqual(new Date("2026-08-01"));
    expect(await getCampaignSummary("nope")).toBeUndefined();
    const all = await listCampaignSummaries();
    expect(all[0].slug).toBe(slug);
    expect(all.find((c) => c.slug === "support-sobel-bill")?.letters).toBe(0);
  });

  it("gives a site campaign the versions staff published, newest first, each with its letters, then those from before", async () => {
    const polly = await addTestPolitician();
    const [first] = await query<{ id: number }>(
      "SELECT id::int AS id FROM campaign_letters WHERE campaign = 'regulate-letter-pm'",
    );
    const [{ id: newer }] = await query<{ id: number }>(
      `INSERT INTO campaign_letters (campaign, subject, body, published_at, published_by)
       VALUES ('regulate-letter-pm', 'Newer', '{"type":"doc","content":[]}', now() + interval '1 minute', 'jane@pauseai.uk')
       RETURNING id::int AS id`,
    );
    // A draft isn't a version.
    await query(
      `INSERT INTO campaign_letters (campaign, subject, body) VALUES ('regulate-letter-pm', 'Draft', '{"type":"doc","content":[]}')`,
    );
    const letter = async (version: number | null) => {
      const id = await addTestLetter({ politicianId: polly, campaign: "regulate-letter-pm" });
      await query("UPDATE letters_from_supporters SET campaign_letter_id = $2 WHERE id = $1", [id, version]);
    };
    await letter(newer);
    await letter(first.id);
    await letter(first.id);
    await letter(null);
    const { versions } = await campaignVersions("regulate-letter-pm");
    expect(versions.map((v) => [v.key, v.letters, v.subject, v.by])).toEqual([
      [String(newer), 1, "Newer", "jane@pauseai.uk"],
      [String(first.id), 2, "Request to co-sign letter on frontier AI risks", null],
      ["before", 1, "", null],
    ]);
    expect(versions[1].body?.content[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Dear " },
        { type: "field", attrs: { field: "salutation" } },
        { type: "text", text: "," },
      ],
    });
    expect(versions[2].body).toBeNull();
  });

  it("gives a site campaign with no letters from before versions none for them", async () => {
    const { versions } = await campaignVersions("support-sobel-bill");
    expect(versions.map((v) => [v.letters, v.from === null])).toEqual([[0, false]]);
  });

  it("gives an old campaign each version live when its letters were written, newest first, and how much was their own", async () => {
    const polly = await addTestPolitician();
    const slug = "pauseai-info-frontier-ai";
    const letter = async (createdAt: string, own: number | null) => {
      const id = await addTestLetter({ politicianId: polly, campaign: slug, createdAt });
      if (own !== null) {
        await query(
          "UPDATE letters_from_supporters SET draft = 'x', draft_approximate = false, own_words = $2 WHERE id = $1",
          [id, own],
        );
      }
    };
    await letter("2026-06-20T12:00:00Z", 0);
    await letter("2026-06-21T12:00:00Z", 0.05);
    await letter("2026-10-01T12:00:00Z", 0.3);
    await letter("2026-10-02T12:00:00Z", 0.9);
    await letter("2026-10-03T12:00:00Z", null);
    const { versions, changed } = await campaignVersions(slug);
    expect(versions.map((v) => [v.key, v.letters])).toEqual([
      ["1857068e", 3],
      ["77b82616", 2],
    ]);
    expect(changed).toBe(3);
    expect((await campaignVersions("no-such-campaign")).versions).toEqual([]);
  });

  it("gives a campaign staff made who made it, and the versions they published", async () => {
    const body = EMPTY_MAILING_DOC;
    const slug = await createCampaign({ title: "Stop", ask: null, subject: "Please", body }, "jo@pauseai.uk");
    expect(await getCampaignSummary(slug)).toMatchObject({ title: "Stop", createdBy: "jo@pauseai.uk", letters: 0 });
    expect((await getCampaignSummary("regulate-letter-pm"))!.createdBy).toBeNull();
    expect(await campaignVersions(slug)).toEqual({ versions: [], changed: 0 });
    await query(
      "UPDATE campaign_letters SET published_at = now(), published_by = 'jo@pauseai.uk' WHERE campaign = $1",
      [slug],
    );
    expect((await campaignVersions(slug)).versions).toMatchObject([{ subject: "Please", by: "jo@pauseai.uk" }]);
  });
});
