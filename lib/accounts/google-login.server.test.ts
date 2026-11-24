import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sessionEmail } from "./auth.server";
import {
  goesToGoogle,
  isPreviewOrigin,
  loggedIn,
  newSecret,
  readLogin,
  readStarted,
  signLogin,
  startedCookie,
} from "./google-login.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { TEST_LOGIN_SIGNING_KEY } from "@/tests/login-keys";

vi.mock("next/headers", () => import("@/tests/next-headers"));
vi.mock("@/lib/accounts/live-login-key", () => import("@/tests/login-keys"));

const PREVIEW = "https://deploy-preview-12--pauseaiuk.netlify.app";
const NOW = Date.parse("2026-11-24T12:00:00Z");

beforeEach(() => vi.stubEnv("GOOGLE_LOGIN_SIGNING_KEY", TEST_LOGIN_SIGNING_KEY));
afterEach(() => vi.unstubAllEnvs());

describe("where a login goes", () => {
  it("goes to Google itself on the live site and in a fixture build, and nowhere else", () => {
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    expect(goesToGoogle()).toBe(true);
    vi.stubEnv("DEPLOY_CONTEXT", "deploy-preview");
    expect(goesToGoogle()).toBe(false);
    vi.stubEnv("DATA_FIXTURES", "1");
    expect(goesToGoogle()).toBe(true);
  });

  it("passes a login on only to the site's own previews and branch deploys", () => {
    expect(isPreviewOrigin(PREVIEW)).toBe(true);
    expect(isPreviewOrigin("https://google-login--pauseaiuk.netlify.app")).toBe(true);
    for (const origin of [
      "https://pauseai.uk",
      "http://deploy-preview-12--pauseaiuk.netlify.app",
      "https://deploy-preview-12--evil.netlify.app",
      "https://evil.example/--pauseaiuk.netlify.app",
      "https://deploy-preview-12--pauseaiuk.netlify.app.evil.example",
      `${PREVIEW}/`,
    ]) {
      expect(isPreviewOrigin(origin), origin).toBe(false);
    }
  });

  it("makes a new random secret each time", () => {
    expect(newSecret()).toMatch(/^[\w-]{32}$/);
    expect(newSecret()).not.toBe(newSecret());
  });
});

describe("the login under way", () => {
  it("is kept in a cookie only the login's routes see, for 15 minutes", () => {
    const cookie = startedCookie({ state: "st", remember: true, next: "/staff/letters" });
    expect(cookie).toMatchObject({
      name: "staff_google_login",
      httpOnly: true,
      path: "/staff/api/google",
      maxAge: 900,
    });
    expect(readStarted(cookie.value)).toEqual({
      state: "st",
      preview: undefined,
      nonce: undefined,
      remember: true,
      next: "/staff/letters",
    });
  });

  it("reads each field only as what it should be, and the page to go to only if it's a staff page", () => {
    expect(
      readStarted(JSON.stringify({ preview: PREVIEW, nonce: "n", remember: "yes", next: "https://evil.example" })),
    ).toEqual({ state: undefined, preview: PREVIEW, nonce: "n", remember: false, next: "/staff" });
    expect(readStarted(JSON.stringify({ state: 1 }))?.state).toBeUndefined();
  });

  it("is nothing without a cookie, or one that isn't an object", () => {
    for (const cookie of [undefined, "", "not json", "null", "3"]) expect(readStarted(cookie), cookie).toBeUndefined();
  });
});

describe("the note the live site passes on", () => {
  it("says who logged in, for the preview and nonce it was signed for, for a minute", () => {
    const note = signLogin("jo@pauseai.uk", PREVIEW, "n", NOW);
    expect(readLogin(note, PREVIEW, "n", NOW + 59_000)).toBe("jo@pauseai.uk");
    expect(readLogin(note, PREVIEW, "n", NOW + 60_000)).toBeUndefined();
    expect(readLogin(note, "https://other--pauseaiuk.netlify.app", "n", NOW)).toBeUndefined();
    expect(readLogin(note, PREVIEW, "other", NOW)).toBeUndefined();
  });

  it("is refused if it's been changed, or isn't signed with the live site's key", () => {
    const note = signLogin("jo@pauseai.uk", PREVIEW, "n", NOW);
    const [, signature] = note.split(".");
    const forged = Buffer.from(
      JSON.stringify({ email: "admin@pauseai.uk", origin: PREVIEW, nonce: "n", expires: NOW + 60_000 }),
    ).toString("base64url");
    expect(readLogin(`${forged}.${signature}`, PREVIEW, "n", NOW)).toBeUndefined();
    for (const bad of ["", "no-signature", `${forged}.`, `${forged}.AAAA`]) {
      expect(readLogin(bad, PREVIEW, "n", NOW), bad).toBeUndefined();
    }
  });

  it("can't be signed without the key, as on a preview", () => {
    vi.stubEnv("GOOGLE_LOGIN_SIGNING_KEY", "");
    expect(() => signLogin("jo@pauseai.uk", PREVIEW, "n")).toThrow("GOOGLE_LOGIN_SIGNING_KEY isn't set");
  });

  it("lasts a minute from now unless told otherwise", () => {
    expect(readLogin(signLogin("jo@pauseai.uk", PREVIEW, "n"), PREVIEW, "n")).toBe("jo@pauseai.uk");
  });
});

describeWithDatabase("logging in", () => {
  useTestDatabase();

  it("starts a session and goes on, forgetting the login under way", async () => {
    const request = new NextRequest("https://pauseai.uk/staff/api/google/callback", {
      headers: { "user-agent": "Firefox" },
    });
    const to = new URL("https://pauseai.uk/staff/letters");
    const res = await loggedIn(request, "jo@pauseai.uk", { remember: false, next: "/staff/letters" }, to);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://pauseai.uk/staff/letters");
    expect(await sessionEmail(res.cookies.get("staff_session")!.value)).toBe("jo@pauseai.uk");
    expect(res.cookies.get("staff_session")?.maxAge).toBeUndefined();
    expect(res.cookies.get("staff_keep")).toBeUndefined();
    expect(res.cookies.get("staff_google_login")?.value).toBe("");
  });

  it("keeps them signed in for 30 days if they asked", async () => {
    const request = new NextRequest("https://pauseai.uk/staff/api/google/callback");
    const res = await loggedIn(
      request,
      "jo@pauseai.uk",
      { remember: true, next: "/staff" },
      new URL("https://pauseai.uk/staff"),
    );
    expect(res.cookies.get("staff_session")?.maxAge).toBe(30 * 86_400);
    expect(res.cookies.get("staff_keep")?.value).toBe("1");
  });
});
