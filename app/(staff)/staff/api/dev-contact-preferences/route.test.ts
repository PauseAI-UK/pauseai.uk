import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { requestCookies } from "@/tests/next-headers";
import { downloadAs } from "@/tests/staff-download";
import { query } from "@/lib/server/db";
import { GET } from "./route";

vi.mock("next/headers", () => import("@/tests/next-headers"));

const URL = "https://pauseai.uk/staff/api/dev-contact-preferences";

describeWithDatabase("GET /staff/api/dev-contact-preferences", () => {
  useTestDatabase();
  beforeEach(() => {
    requestCookies.clear();
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("in a fixture build, makes a fresh link to the address's contact preferences and goes to it", async () => {
    vi.stubEnv("DATA_FIXTURES", "1");
    const res = await downloadAs(GET, `${URL}?address=jane.smith%40example.com`, ["supporters"]);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toMatch(/^https:\/\/pauseai\.uk\/contact-preferences\/[\w-]+$/);
    expect(await query("SELECT address FROM preference_links")).toEqual([{ address: "jane.smith@example.com" }]);
  });

  it("doesn't exist outside a fixture build, or without an address", async () => {
    vi.stubEnv("DATA_FIXTURES", "1");
    expect((await downloadAs(GET, URL, ["supporters"])).status).toBe(404);
    vi.stubEnv("DATA_FIXTURES", "");
    expect((await downloadAs(GET, `${URL}?address=jane.smith%40example.com`, ["supporters"])).status).toBe(404);
    expect(await query("SELECT address FROM preference_links")).toEqual([]);
  });
});
