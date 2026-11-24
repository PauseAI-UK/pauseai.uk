import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { describeError } from "@/lib/server/problems.server";
import { OutsideFailure } from "./outside-failure.server";
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

    const res = await outsideFetch("luma", CALENDAR, { headers: { authorization: "x" } });

    expect(await res.json()).toEqual({ live: true });
    expect(auth).toBe("x");
  });

  it("gives up on a service that doesn't answer in time, so a run gets to record its failure", async () => {
    server.use(http.get("https://public-api.luma.com/v1/calendars/events/list", () => new Promise<never>(() => {})));
    const short = AbortSignal.timeout(20);
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(short);

    const failed = await outsideFetch("luma", CALENDAR).catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(OutsideFailure);
    expect(failed).toMatchObject({
      service: "luma",
      kind: "timeout",
      status: 0,
      message: "Luma didn't answer in time",
      cause: { name: "TimeoutError" },
    });
    expect(timeout).toHaveBeenCalledWith(OUTSIDE_TIMEOUT_MS);
    timeout.mockRestore();
  });

  it("says a service that can't be reached is unreachable, keeping why as the cause", async () => {
    server.use(http.get("https://public-api.luma.com/v1/calendars/events/list", () => HttpResponse.error()));
    const failed = await outsideFetch("luma", CALENDAR).catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(OutsideFailure);
    expect(failed).toMatchObject({ service: "luma", kind: "unreachable", status: 0 });
    expect(describeError(failed)).toMatch(/^Luma couldn't be reached \(.+\)/);
  });

  it("hands back an answer that isn't ok, for the binding to say what kind of refusal it is", async () => {
    server.use(
      http.get("https://public-api.luma.com/v1/calendars/events/list", () => new HttpResponse(null, { status: 503 })),
    );
    expect((await outsideFetch("luma", CALENDAR)).status).toBe(503);
  });

  it("asks again after a 429 or a 503 when told it may, waiting as the answer says or longer each time", async () => {
    vi.useFakeTimers();
    const answers = [
      new HttpResponse(null, { status: 429, headers: { "retry-after": "7" } }),
      new HttpResponse(null, { status: 503 }),
      new HttpResponse(null, { status: 503 }),
      HttpResponse.json({ live: true }),
    ];
    let asked = 0;
    server.use(http.get("https://public-api.luma.com/v1/calendars/events/list", () => answers[asked++]));
    const waits = vi.spyOn(globalThis, "setTimeout");
    const answered = outsideFetch("luma", CALENDAR, { retries: 3 });
    await vi.runAllTimersAsync();
    expect(await (await answered).json()).toEqual({ live: true });
    expect(asked).toBe(4);
    // Seven seconds as the first answer said, then two and four.
    expect(waits.mock.calls.map(([, ms]) => ms)).toEqual(expect.arrayContaining([7000, 2000, 4000]));
    expect(waits.mock.calls.map(([, ms]) => ms)).not.toContain(1000);
    vi.useRealTimers();
  });

  it("gives up asking again after as many tries as it was allowed, with the last answer", async () => {
    vi.useFakeTimers();
    let asked = 0;
    server.use(
      http.get("https://public-api.luma.com/v1/calendars/events/list", () => {
        asked++;
        return new HttpResponse(null, { status: 503 });
      }),
    );
    const answered = outsideFetch("luma", CALENDAR, { retries: 2 });
    await vi.runAllTimersAsync();
    expect((await answered).status).toBe(503);
    expect(asked).toBe(3);
    // Any other refusal isn't asked again.
    server.use(
      http.get("https://public-api.luma.com/v1/calendars/events/list", () => new HttpResponse(null, { status: 500 })),
    );
    asked = 0;
    expect((await outsideFetch("luma", CALENDAR, { retries: 2 })).status).toBe(500);
    vi.useRealTimers();
  });

  it("leaves a caller's own time limit as it is", async () => {
    server.use(http.get("https://public-api.luma.com/v1/calendars/events/list", () => HttpResponse.json({})));
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const own = new AbortController().signal;

    expect((await outsideFetch("luma", CALENDAR, { signal: own })).ok).toBe(true);
    expect(timeout).not.toHaveBeenCalled();
    timeout.mockRestore();
  });

  describe("with DATA_FIXTURES=1", () => {
    it("answers from the fixtures without touching the network", async () => {
      vi.stubEnv("DATA_FIXTURES", "1");
      server.use(http.all("*", () => HttpResponse.error()));

      const res = await outsideFetch("luma", CALENDAR);

      const data = await res.json();
      expect(data.entries.length).toBeGreaterThan(0);
    });

    it("returns a 404 for a URL with no fixture", async () => {
      vi.stubEnv("DATA_FIXTURES", "1");

      const res = await outsideFetch("luma", "https://example.com/anything");

      expect(res.status).toBe(404);
    });
  });
});
