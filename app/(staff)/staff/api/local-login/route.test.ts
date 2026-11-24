import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sessionEmail } from "@/lib/accounts/auth.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { GET, POST } from "./route";

vi.mock("next/headers", () => import("@/tests/next-headers"));

const BASE = "http://localhost:3000/staff/api/local-login";

/** Posts the login page's local form with `fields`, and returns the token printed, if one was. */
async function ask(fields: Record<string, string>) {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const res = await POST(new NextRequest(BASE, { method: "POST", body: new URLSearchParams(fields) }));
  const token = String(info.mock.calls.at(-1)?.[0] ?? "").match(/token=([\w-]+)$/)?.[1];
  info.mockRestore();
  return { res, token };
}

describeWithDatabase("/staff/api/local-login", () => {
  useTestDatabase();
  beforeEach(() => {
    vi.stubEnv("DEPLOY_CONTEXT", "local");
    vi.stubEnv("DATA_FIXTURES", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("prints a link for the address typed, and says to look for it, then the link logs in as asked", async () => {
    const { res, token } = await ask({ email: " Jo@pauseai.uk ", remember: "on", next: "/staff/letters" });
    expect(res.headers.get("location")).toBe("http://localhost:3000/staff/login?printed=1");
    const used = await GET(new NextRequest(`${BASE}?token=${token}`));
    expect(used.headers.get("location")).toBe("http://localhost:3000/staff/letters");
    expect(await sessionEmail(used.cookies.get("staff_session")!.value)).toBe("jo@pauseai.uk");
    expect(used.cookies.get("staff_keep")?.value).toBe("1");
  });

  it("says the same for an address it prints nothing for, or none, and goes to the staff home", async () => {
    expect((await ask({ email: "sam@gmail.com" })).token).toBeUndefined();
    const { res, token } = await ask({});
    expect(res.headers.get("location")).toBe("http://localhost:3000/staff/login?printed=1");
    expect(token).toBeUndefined();
    const { token: home } = await ask({ email: "jo@pauseai.uk" });
    expect((await GET(new NextRequest(`${BASE}?token=${home}`))).headers.get("location")).toBe(
      "http://localhost:3000/staff",
    );
  });

  it("fails for a link used already, or none", async () => {
    const { token } = await ask({ email: "jo@pauseai.uk" });
    await GET(new NextRequest(`${BASE}?token=${token}`));
    for (const url of [`${BASE}?token=${token}`, BASE]) {
      const res = await GET(new NextRequest(url));
      expect(res.headers.get("location")).toBe("http://localhost:3000/staff/login?failed=1");
      expect(res.cookies.get("staff_session")).toBeUndefined();
    }
  });

  it("doesn't exist anywhere else", async () => {
    vi.stubEnv("DATA_FIXTURES", "1");
    expect((await POST(new NextRequest(BASE, { method: "POST" }))).status).toBe(404);
    vi.stubEnv("DATA_FIXTURES", "");
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    expect((await GET(new NextRequest(`${BASE}?token=t`))).status).toBe(404);
  });
});
