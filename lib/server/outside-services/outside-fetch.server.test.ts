import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { OUTSIDE_TIMEOUT_MS, outsideFetch } from "./outside-fetch.server";

const CALENDAR = "https://public-api.luma.com/v1/calendars/events/list?after=2026-01-01T00:00:00.000Z";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("outsideFetch", () => {
  it("makes a real request, passing init through", async () => {
    let auth: string | null = null;
    server.use(
      http.get("https://public-api.luma.com/v1/calendars/events/list", ({ request }) => {
        auth = request.headers.get("authorization");
        return HttpResponse.json({ live: true });
      }),
    );

    const res = await outsideFetch(CALENDAR, { headers: { authorization: "x" } });

    expect(await res.json()).toEqual({ live: true });
    expect(auth).toBe("x");
  });

  it("gives up on a service that doesn't answer in time, so a run gets to record its failure", async () => {
    server.use(http.get("https://public-api.luma.com/v1/calendars/events/list", () => new Promise<never>(() => {})));
    const short = AbortSignal.timeout(20);
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(short);

    await expect(outsideFetch(CALENDAR)).rejects.toMatchObject({ name: "TimeoutError" });
    expect(timeout).toHaveBeenCalledWith(OUTSIDE_TIMEOUT_MS);
    timeout.mockRestore();
  });

  it("leaves a caller's own time limit as it is", async () => {
    server.use(http.get("https://public-api.luma.com/v1/calendars/events/list", () => HttpResponse.json({})));
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const own = new AbortController().signal;

    expect((await outsideFetch(CALENDAR, { signal: own })).ok).toBe(true);
    expect(timeout).not.toHaveBeenCalled();
    timeout.mockRestore();
  });

  describe("with DATA_FIXTURES=1", () => {
    it("answers from the fixtures without touching the network", async () => {
      vi.stubEnv("DATA_FIXTURES", "1");
      server.use(http.all("*", () => HttpResponse.error()));

      const res = await outsideFetch(CALENDAR);

      const data = await res.json();
      expect(data.entries.length).toBeGreaterThan(0);
    });

    it("returns a 404 for a URL with no fixture", async () => {
      vi.stubEnv("DATA_FIXTURES", "1");

      const res = await outsideFetch("https://example.com/anything");

      expect(res.status).toBe(404);
    });
  });
});
