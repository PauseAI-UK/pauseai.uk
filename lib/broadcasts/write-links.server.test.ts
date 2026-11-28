import { EMPTY_MAILING_DOC } from "@/lib/mailings/doc";
import { beforeEach, expect, it, vi } from "vitest";
import { query } from "@/lib/server/db.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { addFollower } from "@/tests/broadcast-fixtures";
import { hashOf } from "@/lib/supporters/email-settings.server";
import { GET } from "@/app/write/[token]/[slug]/route";
import { HAS_MP } from "./broadcasts";
import { createCampaign } from "@/lib/mailings/made-campaigns.server";
import { withWriteLinks, writeLinkPath } from "./write-links.server";

beforeEach(() => vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk"));

/** Where M1 1AE is, as postcodes.io placed it: a postcode places someone only once it's placed. */
const placeM1 = () =>
  query(
    `INSERT INTO postcode_places (postcode, latitude, longitude, place, country)
     VALUES ('M11AE', 53.4794, -2.2353, 'Manchester', 'england')`,
  );

/** A copy of a broadcast to `supporter`, named `name` as sending kept it, sent `daysAgo`: its link's token. */
async function copyTo(supporter: number | null, name: string | null, daysAgo = 1): Promise<string> {
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO mailings (title, audience, channel, topic, filter, body, created_by, state)
     VALUES ('', 'supporters', 'email', 'newsletter', '{}', '{}', 'staff@pauseai.uk', 'draft') RETURNING id::int AS id`,
  );
  await query(
    `INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status, merge_values, link_token_hash, sent_at)
     VALUES ($1, $2, $3, 'sent', $4, $5, now() - make_interval(days => $6))`,
    [
      id,
      supporter,
      supporter && "jane@example.com",
      supporter && { name, values: {}, meets: [] },
      hashOf(`tok-${id}`),
      daysAgo,
    ],
  );
  return `tok-${id}`;
}

it("gives someone with an MP a link to write to them in each campaign, by their copy's token", () => {
  const merge = { name: "Jane Smith", values: { mpName: "Lucy Powell" }, meets: [HAS_MP] };
  expect(withWriteLinks(merge, "tok-1")).toEqual({
    name: "Jane Smith",
    values: {
      mpName: "Lucy Powell",
      "mpLink:regulate-letter-pm": "https://pauseai.uk/write/tok-1/regulate-letter-pm",
      "mpLink:support-sobel-bill": "https://pauseai.uk/write/tok-1/support-sobel-bill",
    },
    meets: [HAS_MP],
  });
  // Someone with no MP is never sent one.
  const without = { values: {}, meets: [] };
  expect(withWriteLinks(without, "tok-1")).toBe(without);
});

describeWithDatabase("where a link to write to their MP goes", () => {
  useTestDatabase();

  it("opens the campaign with the name and postcode of the supporter whose copy it's in, after its #", async () => {
    await placeM1();
    const jane = await addFollower("usr-1", "jane@example.com", "Jane Smith", { postcode: "M1 1AE" });
    const token = await copyTo(jane, "Jane Smith");
    expect(await writeLinkPath(token, "support-sobel-bill")).toBe(
      "/campaigns/support-sobel-bill#name=Jane+Smith&postcode=M1+1AE",
    );
  });

  it("fills in what it knows: no postcode for someone placed by an event, no name for someone with none", async () => {
    const sam = await addFollower("usr-2", "sam@example.com", "Sam");
    expect(await writeLinkPath(await copyTo(sam, "Sam"), "support-sobel-bill")).toBe(
      "/campaigns/support-sobel-bill#name=Sam",
    );
    expect(await writeLinkPath(await copyTo(sam, null), "support-sobel-bill")).toBe("/campaigns/support-sobel-bill");
  });

  it("opens the campaign with nothing filled in for an unknown token, an old copy or an erased supporter", async () => {
    await placeM1();
    const jane = await addFollower("usr-1", "jane@example.com", "Jane Smith", { postcode: "M1 1AE" });
    expect(await writeLinkPath("nobody's", "support-sobel-bill")).toBe("/campaigns/support-sobel-bill");
    expect(await writeLinkPath(await copyTo(jane, "Jane Smith", 40), "support-sobel-bill")).toBe(
      "/campaigns/support-sobel-bill",
    );
    expect(await writeLinkPath(await copyTo(null, null), "support-sobel-bill")).toBe("/campaigns/support-sobel-bill");
  });

  it("goes to the campaigns' own page for a campaign with no page now", async () => {
    expect(await writeLinkPath("nobody's", "an-old-campaign")).toBe("/campaigns");
    expect(await writeLinkPath("nobody's", "pauseai-info-liability")).toBe("/campaigns");
  });

  it("opens a campaign staff made, at its page", async () => {
    const sam = await addFollower("usr-2", "sam@example.com", "Sam");
    const body = EMPTY_MAILING_DOC;
    const slug = await createCampaign({ title: "Stop the race", ask: null, subject: "", body }, "jo@pauseai.uk");
    expect(await writeLinkPath(await copyTo(sam, "Sam"), slug)).toBe("/campaigns/stop-the-race#name=Sam");
  });

  it("is a redirect, by its route", async () => {
    await placeM1();
    const jane = await addFollower("usr-1", "jane@example.com", "Jane Smith", { postcode: "M1 1AE" });
    const token = await copyTo(jane, "Jane Smith");
    const response = await GET(new Request(`https://pauseai.uk/write/${token}/support-sobel-bill`), {
      params: Promise.resolve({ token, slug: "support-sobel-bill" }),
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://pauseai.uk/campaigns/support-sobel-bill#name=Jane+Smith&postcode=M1+1AE",
    );
  });
});
