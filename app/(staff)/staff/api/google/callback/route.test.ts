import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { sessionEmail } from "@/lib/accounts/auth.server";
import { accountProblems } from "@/lib/accounts/copy";
import { readLogin } from "@/lib/accounts/google-login.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { TEST_LOGIN_SIGNING_KEY } from "@/tests/login-keys";
import { GET } from "./route";

vi.mock("next/headers", () => import("@/tests/next-headers"));
vi.mock("@/lib/accounts/live-login-key", () => import("@/tests/login-keys"));

const PREVIEW = "https://deploy-preview-12--pauseaiuk.netlify.app";
const STARTED = JSON.stringify({ state: "st", remember: false, next: "/staff/letters" });
const FOR_PREVIEW = JSON.stringify({ state: "st", preview: PREVIEW, nonce: "n", remember: false, next: "/staff" });

/** The callback, with `params` from Google, and the cookie the start left (`cookie`). */
function callback(params: Record<string, string>, cookie: string | null = STARTED) {
  const request = new NextRequest(`https://pauseai.uk/staff/api/google/callback?${new URLSearchParams(params)}`);
  if (cookie !== null) request.cookies.set("staff_google_login", cookie);
  return GET(request);
}

/** Google answering the code with an ID token for `email`, verified or not, named Jo Bloggs. */
function googleSays(email: string, verified = true) {
  const claims = Buffer.from(JSON.stringify({ email, email_verified: verified, name: "Jo Bloggs" })).toString(
    "base64url",
  );
  server.use(
    http.post("https://oauth2.googleapis.com/token", () => HttpResponse.json({ id_token: `e30.${claims}.s` })),
  );
}

describeWithDatabase("GET /staff/api/google/callback", () => {
  useTestDatabase();
  beforeEach(() => {
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
    vi.stubEnv("GOOGLE_LOGIN_SIGNING_KEY", TEST_LOGIN_SIGNING_KEY);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("on the live site", () => {
    it("logs in the pauseai.uk account chosen, and goes on to the page, forgetting the login under way", async () => {
      googleSays("Jo@pauseai.uk");
      const res = await callback({ code: "c", state: "st" });
      expect(res.headers.get("location")).toBe("https://pauseai.uk/staff/letters");
      expect(await sessionEmail(res.cookies.get("staff_session")!.value)).toBe("jo@pauseai.uk");
      expect(res.cookies.get("staff_google_login")?.value).toBe("");
    });

    it("says when the account isn't pauseai.uk's, and logs nobody in", async () => {
      googleSays("sam@gmail.com");
      const res = await callback({ code: "c", state: "st" });
      expect(res.headers.get("location")).toBe("https://pauseai.uk/staff/login?other=1");
      expect(res.cookies.get("staff_session")).toBeUndefined();
    });

    it("goes back to the login page, saying nothing, when they went back from Google without choosing", async () => {
      const res = await callback({ error: "access_denied", state: "st" });
      expect(res.headers.get("location")).toBe("https://pauseai.uk/staff/login");
      expect(res.cookies.get("staff_google_login")?.value).toBe("");
    });

    it("fails without the state this browser started with", async () => {
      for (const [params, cookie] of [
        [{ code: "fixture:jo@pauseai.uk", state: "other" }, STARTED],
        [{ code: "fixture:jo@pauseai.uk" }, STARTED],
        [{ code: "fixture:jo@pauseai.uk", state: "st" }, null],
        [{ code: "fixture:jo@pauseai.uk", state: "st" }, "not json"],
        [{ code: "fixture:jo@pauseai.uk", state: "st" }, JSON.stringify({ remember: true })],
      ] as const) {
        const res = await callback(params, cookie);
        expect(res.headers.get("location")).toBe("https://pauseai.uk/staff/login?failed=1");
        expect(res.cookies.get("staff_session")).toBeUndefined();
      }
    });

    it("fails, logging nobody in, when Google won't say who it was", async () => {
      googleSays("jo@pauseai.uk", false);
      expect((await callback({ code: "c", state: "st" })).headers.get("location")).toMatch(/\?failed=1$/);
    });

    it("fails when Google refuses the code, reporting it as a problem", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      server.use(http.post("https://oauth2.googleapis.com/token", () => HttpResponse.json({}, { status: 400 })));
      expect((await callback({ code: "c", state: "st" })).headers.get("location")).toMatch(/\?failed=1$/);
      expect(error).toHaveBeenCalledWith(
        accountProblems.googleLoginFailed().what,
        "Google refused the token request: 400",
      );
    });
  });

  describe("for a preview", () => {
    it("passes the login on to the preview's handoff, signed for its address and nonce, logging nobody in here", async () => {
      googleSays("jo@pauseai.uk");
      const res = await callback({ code: "c", state: "st" }, FOR_PREVIEW);
      const to = new URL(res.headers.get("location")!);
      expect(to.origin + to.pathname).toBe(`${PREVIEW}/staff/api/google/handoff`);
      expect(readLogin(to.searchParams.get("login")!, PREVIEW, "n")).toEqual({
        email: "jo@pauseai.uk",
        name: "Jo Bloggs",
      });
      expect(res.cookies.get("staff_session")).toBeUndefined();
      expect(res.cookies.get("staff_google_login")?.value).toBe("");
    });

    it("sends them back to the preview's login page when it doesn't work", async () => {
      googleSays("sam@gmail.com");
      expect((await callback({ code: "c", state: "st" }, FOR_PREVIEW)).headers.get("location")).toBe(
        `${PREVIEW}/staff/login?other=1`,
      );
      expect((await callback({ code: "c", state: "other" }, FOR_PREVIEW)).headers.get("location")).toBe(
        `${PREVIEW}/staff/login?failed=1`,
      );
      expect((await callback({ state: "st" }, FOR_PREVIEW)).headers.get("location")).toBe(`${PREVIEW}/staff/login`);
    });

    it("fails on the live site, signing nothing, for a cookie naming an address that isn't a preview's", async () => {
      googleSays("jo@pauseai.uk");
      const cookie = JSON.stringify({
        state: "st",
        preview: "https://evil.example",
        nonce: "n",
        remember: false,
        next: "/staff",
      });
      const res = await callback({ code: "c", state: "st" }, cookie);
      expect(res.headers.get("location")).toBe("https://pauseai.uk/staff/login?failed=1");
      expect(res.cookies.get("staff_session")).toBeUndefined();
    });

    it("fails, reporting it, when the live site can't sign the login", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubEnv("GOOGLE_LOGIN_SIGNING_KEY", "");
      googleSays("jo@pauseai.uk");
      expect((await callback({ code: "c", state: "st" }, FOR_PREVIEW)).headers.get("location")).toBe(
        `${PREVIEW}/staff/login?failed=1`,
      );
      expect(error).toHaveBeenCalledWith(
        accountProblems.googleLoginFailed().what,
        "GOOGLE_LOGIN_SIGNING_KEY isn't set",
      );
    });
  });
});
