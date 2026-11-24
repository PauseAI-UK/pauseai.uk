import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const PREVIEW = "https://deploy-preview-12--pauseaiuk.netlify.app";

/** The start, on `origin`, with `params`, and `cookie` as the fixture browser's Google account if given. */
function start(origin: string, params: Record<string, string> = {}, account?: string) {
  const request = new NextRequest(`${origin}/staff/api/google/start?${new URLSearchParams(params)}`);
  if (account) request.cookies.set("fixture_google_account", account);
  return GET(request);
}

/** What the login under way keeps, from a response's cookie. */
function kept(res: Response & { cookies: { get(name: string): { value: string } | undefined } }) {
  return JSON.parse(res.cookies.get("staff_google_login")!.value) as Record<string, unknown>;
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /staff/api/google/start on the live site", () => {
  beforeEach(() => {
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
  });

  it("goes to Google, to come back to the live site, keeping the state, the box and the page to go to", async () => {
    const res = await start("https://pauseai.uk", { remember: "on", next: "/staff/letters" });
    expect(res.status).toBe(303);
    const to = new URL(res.headers.get("location")!);
    expect(to.origin).toBe("https://accounts.google.com");
    expect(to.searchParams.get("redirect_uri")).toBe("https://pauseai.uk/staff/api/google/callback");
    expect(kept(res)).toEqual({ state: to.searchParams.get("state"), remember: true, next: "/staff/letters" });
    expect(res.cookies.get("staff_google_login")?.path).toBe("/staff/api/google");
  });

  it("goes for a preview, keeping its address and nonce, without the box or page, which the preview keeps", async () => {
    const res = await start("https://pauseai.uk", { preview: PREVIEW, nonce: "n" });
    expect(new URL(res.headers.get("location")!).origin).toBe("https://accounts.google.com");
    expect(kept(res)).toMatchObject({ preview: PREVIEW, nonce: "n", remember: false, next: "/staff" });
  });

  it("goes nowhere for an address that isn't a preview's, or without a nonce", async () => {
    for (const params of [
      { preview: "https://evil.example", nonce: "n" },
      { preview: PREVIEW },
      { preview: PREVIEW, nonce: "" },
    ] as Record<string, string>[]) {
      const res = await start("https://pauseai.uk", params);
      expect(res.headers.get("location"), JSON.stringify(params)).toBe("https://pauseai.uk/staff/login?failed=1");
      expect(res.cookies.get("staff_google_login")).toBeUndefined();
    }
  });
});

describe("GET /staff/api/google/start on a preview", () => {
  it("goes to the live site's start, with its address and a nonce it keeps with the box and the page", async () => {
    vi.stubEnv("DEPLOY_CONTEXT", "deploy-preview");
    vi.stubEnv("SITE_ORIGIN", PREVIEW);
    const res = await start(PREVIEW, { remember: "on", next: "/staff/letters" });
    const to = new URL(res.headers.get("location")!);
    expect(to.origin + to.pathname).toBe("https://pauseai.uk/staff/api/google/start");
    expect(to.searchParams.get("preview")).toBe(PREVIEW);
    expect(kept(res)).toEqual({ nonce: to.searchParams.get("nonce"), remember: true, next: "/staff/letters" });
  });
});

describe("GET /staff/api/google/start in a fixture build", () => {
  it("comes straight back as the account the browser is signed in to at Google", async () => {
    vi.stubEnv("DATA_FIXTURES", "1");
    vi.stubEnv("DEPLOY_CONTEXT", "local");
    const res = await start("http://localhost:4840", {}, "jo@pauseai.uk");
    const to = new URL(res.headers.get("location")!);
    expect(to.origin + to.pathname).toBe("http://localhost:4840/staff/api/google/callback");
    expect(to.searchParams.get("code")).toBe("fixture:jo@pauseai.uk");
    expect(to.searchParams.get("state")).toBe(kept(res).state);
  });
});
