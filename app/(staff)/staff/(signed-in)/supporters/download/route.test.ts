import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { addTestContact, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { requestCookies } from "@/tests/next-headers";
import { downloadAs } from "@/tests/staff-download";
import { query } from "@/lib/server/db";
import { linkSupporters } from "@/lib/supporters/records";
import { GET } from "./route";

vi.mock("next/headers", () => import("@/tests/next-headers"));

describeWithDatabase("GET /staff/supporters/download", () => {
  useTestDatabase();
  beforeEach(() => {
    requestCookies.clear();
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("gives every supporter the filters find, as cards too, with the numbers the Consent filter finds, each download logged", async () => {
    await addTestContact(1, "ann@example.com", {
      name: "Ann",
      phone: "+447700900001",
      city: "Leeds",
      joined: "2026-09-01",
      intent: "volunteer",
      newsletter: "subscribed",
    });
    await linkSupporters();
    // A volunteer's number.
    const found = "contact=email%3Anewsletter%3Ayes&contact=call%3Avolunteering%3Ayes";
    const csv = await downloadAs(GET, `https://pauseai.uk/staff/supporters/download?format=csv&${found}`, [
      "supporters",
    ]);
    expect(await csv.text()).toContain("Ann,ann@example.com,'+447700900001");
    const cards = await (
      await downloadAs(GET, `https://pauseai.uk/staff/supporters/download?format=vcf&${found}`, ["supporters"])
    ).text();
    expect(cards).toMatch(/^FN:PauseAI \w{4} - Ann$/m);
    expect(cards).toContain("TEL;TYPE=CELL,PREF:+447700900001");
    expect(
      await query(
        "SELECT details->>'format' AS format FROM audit_log WHERE action = 'download supporters' ORDER BY id",
      ),
    ).toEqual([{ format: "csv" }, { format: "vcf" }]);
  });
});
