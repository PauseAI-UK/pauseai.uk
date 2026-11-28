import { expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { campaignBySlug } from "@/lib/email-your-mp";
import { query } from "@/lib/server/db.server";
import { campaignDraft } from "./campaign-letters.server";
import type { MailingDoc } from "./doc";
import { createCampaign, madeCampaign, siteCampaign } from "./made-campaigns.server";

const LETTER: MailingDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
};

describeWithDatabase("campaigns staff make", () => {
  useTestDatabase();

  it("makes one with its slug from its title and its letter's draft, by whom and when", async () => {
    const slug = await createCampaign(
      { title: "Stop the race", ask: "frontier-ai-letter", subject: "Please", body: LETTER },
      "jo@pauseai.uk",
    );
    expect(slug).toBe("stop-the-race");
    const [row] = await query<{ created_by: string; made: boolean }>(
      "SELECT created_by, created_at IS NOT NULL AS made FROM campaigns WHERE slug = $1",
      [slug],
    );
    expect(row).toEqual({ created_by: "jo@pauseai.uk", made: true });
    expect(await campaignDraft(slug)).toMatchObject({ subject: "Please", body: LETTER, updatedBy: "jo@pauseai.uk" });
    expect(await madeCampaign(slug)).toEqual({
      slug,
      title: "Stop the race",
      ask: "frontier-ai-letter",
      attachments: [],
    });
  });

  it("never takes a slug a campaign, or a page in the code, has", async () => {
    const made = (title: string) => createCampaign({ title, ask: null, subject: "", body: LETTER }, "jo@pauseai.uk");
    expect(await made("Regulate letter PM")).toBe("regulate-letter-pm-2");
    expect(await made("Briefings")).toBe("briefings-2");
    expect(await made("New")).toBe("new-2");
    // pauseai.info's old campaigns have a row, and no code.
    expect(await made("PauseAI info liability")).toBe("pauseai-info-liability-2");
    // At once, with one title, each waits for the other.
    expect((await Promise.all([made("Twice"), made("Twice")])).toSorted()).toEqual(["twice", "twice-2"]);
    expect(await madeCampaign("new-2")).toEqual({ slug: "new-2", title: "New", attachments: [] });
  });

  it("finds a campaign with a page on the site: in the code or made by staff, never pauseai.info's", async () => {
    await createCampaign({ title: "Stop", ask: null, subject: "", body: LETTER }, "jo@pauseai.uk");
    expect(await siteCampaign("regulate-letter-pm")).toBe(campaignBySlug("regulate-letter-pm"));
    expect(await siteCampaign("stop")).toMatchObject({ slug: "stop", title: "Stop" });
    expect(await siteCampaign("pauseai-info-liability")).toBeUndefined();
    expect(await madeCampaign("regulate-letter-pm")).toBeUndefined();
    expect(await siteCampaign("nope")).toBeUndefined();
  });
});
