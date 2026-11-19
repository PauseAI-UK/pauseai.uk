import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { requestCookies } from "@/tests/next-headers";
import { downloadAs } from "@/tests/staff-download";
import { recordProblem } from "@/lib/email/email.server";
import { query } from "@/lib/server/db.server";
import { GET } from "./route";

vi.mock("next/headers", () => import("@/tests/next-headers"));

describeWithDatabase("GET /staff/supporters/blocked-addresses/download", () => {
  useTestDatabase();
  beforeEach(() => {
    requestCookies.clear();
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("gives the blocked addresses and numbers the filters find, every page", async () => {
    await recordProblem({
      address: "gone@example.org",
      messageId: null,
      kind: "hard",
      reason: "No such mailbox",
      canReset: true,
    });
    await query("INSERT INTO whatsapp_unreachable (number) VALUES ('+447700900001')");
    const download = async (filters: string) => {
      const res = await downloadAs(
        GET,
        `https://pauseai.uk/staff/supporters/blocked-addresses/download?format=json${filters}`,
        ["supporters"],
      );
      expect(res.status).toBe(200);
      return res.text();
    };
    const all = await download("");
    expect(all).toContain("gone@example.org");
    expect(all).toContain("+447700900001");
    expect(await download("&kind=not-on-whatsapp")).not.toContain("gone@example.org");
  });
});
