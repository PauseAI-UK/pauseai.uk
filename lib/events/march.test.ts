import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { getMarchGuests, getMarchSignupCount, marchEventId } from "./march";

afterEach(() => vi.unstubAllEnvs());

describe("marchEventId", () => {
  it("is the march's own event in production", () => {
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    expect(marchEventId()).toBe("evt-1HKCXSHaJqGO3Bg");
  });

  it("is the test event on every other deploy", () => {
    vi.stubEnv("DEPLOY_CONTEXT", "deploy-preview");
    expect(marchEventId()).toBe("evt-hfOj1RR5K1gBNEW");
  });
});

describe("getMarchSignupCount", () => {
  it.each(["production", "deploy-preview"])("counts the march's own event's guests on %s", async (context) => {
    vi.stubEnv("LUMA_API_KEY", "k");
    vi.stubEnv("DEPLOY_CONTEXT", context);
    let asked: string | null = null;
    server.use(
      http.get("https://public-api.luma.com/v1/events/get", ({ request }) => {
        asked = new URL(request.url).searchParams.get("event_id");
        return HttpResponse.json({ guest_counts: { approved: { guests: 42, tickets: 42 } } });
      }),
    );
    expect(await getMarchSignupCount()).toBe(42);
    expect(asked).toBe("evt-1HKCXSHaJqGO3Bg");
  });
});

describe("getMarchGuests", () => {
  it("gives the guests Luma features for the march's own event", async () => {
    let asked: string | null = null;
    server.use(
      http.get("https://api.lu.ma/event/get", ({ request }) => {
        asked = new URL(request.url).searchParams.get("event_api_id");
        return HttpResponse.json({ guest_count: 1, featured_guests: [{ name: "Jane Fixture", avatar_url: null }] });
      }),
    );
    expect(await getMarchGuests()).toEqual([{ name: "Jane Fixture", avatar: null }]);
    expect(asked).toBe("evt-1HKCXSHaJqGO3Bg");
  });

  it("gives none when Luma can't say", async () => {
    server.use(http.get("https://api.lu.ma/event/get", () => new HttpResponse(null, { status: 500 })));
    expect(await getMarchGuests()).toEqual([]);
  });
});
