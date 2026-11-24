import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sessionEmail } from "@/lib/accounts/auth.server";
import { signLogin } from "@/lib/accounts/google-login.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { TEST_LOGIN_SIGNING_KEY } from "@/tests/login-keys";
import { GET } from "./route";

vi.mock("next/headers", () => import("@/tests/next-headers"));
vi.mock("@/lib/accounts/live-login-key", () => import("@/tests/login-keys"));

const JO = { email: "jo@pauseai.uk", name: "Jo Bloggs" };
const PREVIEW = "https://deploy-preview-12--pauseaiuk.netlify.app";
const STARTED = JSON.stringify({ nonce: "n", remember: true, next: "/staff/letters" });

/** The handoff, on the preview, with `note`, and the cookie its start left (`cookie`). */
function handoff(note: string | null, cookie: string | null = STARTED) {
  const params = note === null ? "" : `?${new URLSearchParams({ login: note })}`;
  const request = new NextRequest(`${PREVIEW}/staff/api/google/handoff${params}`);
  if (cookie !== null) request.cookies.set("staff_google_login", cookie);
  return GET(request);
}

describeWithDatabase("GET /staff/api/google/handoff", () => {
  useTestDatabase();
  beforeEach(() => {
    vi.stubEnv("GOOGLE_LOGIN_SIGNING_KEY", TEST_LOGIN_SIGNING_KEY);
    vi.stubEnv("DEPLOY_CONTEXT", "deploy-preview");
    vi.stubEnv("SITE_ORIGIN", PREVIEW);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("logs in who the live site's note says, kept as they asked, and goes on to the page", async () => {
    const res = await handoff(signLogin(JO, PREVIEW, "n"));
    expect(res.headers.get("location")).toBe(`${PREVIEW}/staff/letters`);
    expect(await sessionEmail(res.cookies.get("staff_session")!.value)).toBe("jo@pauseai.uk");
    expect(res.cookies.get("staff_keep")?.value).toBe("1");
    expect(res.cookies.get("staff_google_login")?.value).toBe("");
  });

  it("fails on the live site, even with a note signed for it, so the key logs in only on previews", async () => {
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    const request = new NextRequest(
      `https://pauseai.uk/staff/api/google/handoff?${new URLSearchParams({ login: signLogin(JO, "https://pauseai.uk", "n") })}`,
    );
    request.cookies.set("staff_google_login", STARTED);
    const res = await GET(request);
    expect(res.headers.get("location")).toBe("https://pauseai.uk/staff/login?failed=1");
    expect(res.cookies.get("staff_session")).toBeUndefined();
  });

  it("fails for a note for another preview or browser, or none, or without this browser's nonce", async () => {
    for (const [note, cookie] of [
      [signLogin(JO, "https://other--pauseaiuk.netlify.app", "n"), STARTED],
      [signLogin(JO, PREVIEW, "other"), STARTED],
      [null, STARTED],
      [signLogin(JO, PREVIEW, "n"), null],
      [signLogin(JO, PREVIEW, "n"), JSON.stringify({ state: "st" })],
    ] as const) {
      const res = await handoff(note, cookie);
      expect(res.headers.get("location")).toBe(`${PREVIEW}/staff/login?failed=1`);
      expect(res.cookies.get("staff_session")).toBeUndefined();
      expect(res.cookies.get("staff_google_login")?.value).toBe("");
    }
  });
});
