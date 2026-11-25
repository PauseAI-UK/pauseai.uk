import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse, passthrough } from "msw";
import { createServer } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { server } from "@/tests/fixtures/msw";
import { describeError } from "@/lib/server/problems.server";
import { OutsideFailure } from "./outside-failure.server";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { failService } from "@/lib/server/fixtures/failing-services";
import { lumaFake } from "@/lib/server/fixtures/fakes/luma";
import { OUTSIDE_TIMEOUT_MS, outsideFetch, type Outside } from "./outside-fetch.server";

const LUMA: Outside = { service: "luma", fake: lumaFake };
const CALENDAR = "https://public-api.luma.com/v1/calendars/events/list?after=2026-01-01T00:00:00.000Z";

/** The storyboard flow a request is from, as its cookie says. */
const flow = vi.hoisted(() => ({ database: undefined as string | undefined }));
vi.mock("../flow-database.server", () => ({ flowDatabase: async () => flow.database }));

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

    const res = await outsideFetch(LUMA, CALENDAR, { headers: { authorization: "x" } });

    expect(await res.json()).toEqual({ live: true });
    expect(auth).toBe("x");
  });

  it("gives up on a service that doesn't answer in time, so a run gets to record its failure", async () => {
    server.use(http.get("https://public-api.luma.com/v1/calendars/events/list", () => new Promise<never>(() => {})));
    const short = AbortSignal.timeout(20);
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(short);

    const failed = await outsideFetch(LUMA, CALENDAR).catch((error: unknown) => error);
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
    const failed = await outsideFetch(LUMA, CALENDAR).catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(OutsideFailure);
    expect(failed).toMatchObject({ service: "luma", kind: "unreachable", status: 0 });
    expect(describeError(failed)).toMatch(/^Luma couldn't be reached \(.+\)/);
  });

  describe("an answer whose body is cut short", () => {
    /** A real server on this machine, which sends its headers and part of a body, then does what `then` says. */
    async function partway(then: (socket: Socket) => void): Promise<{ url: string; close: () => void }> {
      const site = createServer((_, res) => {
        res.writeHead(200, { "content-type": "application/json", "content-length": "1000" });
        res.write('{"entries": [');
        then(res.socket!);
      });
      await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", resolve));
      const { port } = site.address() as AddressInfo;
      server.use(http.all(`http://127.0.0.1:${port}/*`, () => passthrough()));
      return { url: `http://127.0.0.1:${port}/list`, close: () => site.close() };
    }

    it("says a service whose answer breaks off is unreachable, rather than leaving the binding to read it", async () => {
      const site = await partway((socket) => setTimeout(() => socket.destroy(), 20));
      const failed = await outsideFetch(LUMA, site.url).catch((error: unknown) => error);
      site.close();
      expect(failed).toBeInstanceOf(OutsideFailure);
      expect(failed).toMatchObject({ service: "luma", kind: "unreachable", status: 0 });
    });

    it("gives up on one that doesn't finish in time", async () => {
      const open: Socket[] = [];
      const site = await partway((socket) => open.push(socket));
      const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.timeout(100));
      const failed = await outsideFetch(LUMA, site.url).catch((error: unknown) => error);
      timeout.mockRestore();
      for (const socket of open) socket.destroy();
      site.close();
      expect(failed).toBeInstanceOf(OutsideFailure);
      expect(failed).toMatchObject({ service: "luma", kind: "timeout" });
    });
  });

  it("hands back an answer with no body, such as a 204, as it came", async () => {
    server.use(
      http.get("https://public-api.luma.com/v1/calendars/events/list", () => new HttpResponse(null, { status: 204 })),
    );
    const res = await outsideFetch(LUMA, CALENDAR);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("asked for public addresses only, sends nothing to an internal one, and asks a public one", async () => {
    let asked = 0;
    server.use(
      http.get("http://127.0.0.1/", () => {
        asked++;
        return HttpResponse.text("inside");
      }),
      http.get("http://93.184.215.14/", () => HttpResponse.text("outside")),
    );
    const failed = await outsideFetch(LUMA, "http://127.0.0.1/", { publicOnly: true }).catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(OutsideFailure);
    expect(failed).toMatchObject({ service: "luma", kind: "unreachable" });
    expect(asked).toBe(0);
    expect(await (await outsideFetch(LUMA, "http://93.184.215.14/", { publicOnly: true })).text()).toBe("outside");
  });

  it("hands back an answer that isn't ok, for the binding to say what kind of refusal it is", async () => {
    server.use(
      http.get("https://public-api.luma.com/v1/calendars/events/list", () => new HttpResponse(null, { status: 503 })),
    );
    expect((await outsideFetch(LUMA, CALENDAR)).status).toBe(503);
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
    const answered = outsideFetch(LUMA, CALENDAR, { retries: 3 });
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
    const answered = outsideFetch(LUMA, CALENDAR, { retries: 2 });
    await vi.runAllTimersAsync();
    expect((await answered).status).toBe(503);
    expect(asked).toBe(3);
    // Any other refusal isn't asked again.
    server.use(
      http.get("https://public-api.luma.com/v1/calendars/events/list", () => new HttpResponse(null, { status: 500 })),
    );
    asked = 0;
    expect((await outsideFetch(LUMA, CALENDAR, { retries: 2 })).status).toBe(500);
    vi.useRealTimers();
  });

  it("leaves a caller's own time limit as it is", async () => {
    server.use(http.get("https://public-api.luma.com/v1/calendars/events/list", () => HttpResponse.json({})));
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const own = new AbortController().signal;

    expect((await outsideFetch(LUMA, CALENDAR, { signal: own })).ok).toBe(true);
    expect(timeout).not.toHaveBeenCalled();
    timeout.mockRestore();
  });

  describe("with DATA_FIXTURES=1", () => {
    it("answers from the fixtures without touching the network", async () => {
      vi.stubEnv("DATA_FIXTURES", "1");
      server.use(http.all("*", () => HttpResponse.error()));

      const res = await outsideFetch(LUMA, CALENDAR);

      const data = await res.json();
      expect(data.entries.length).toBeGreaterThan(0);
    });

    it("returns a 404 for a URL with no fixture", async () => {
      vi.stubEnv("DATA_FIXTURES", "1");

      const res = await outsideFetch(LUMA, "https://example.com/anything");

      expect(res.status).toBe(404);
    });

    it("answers as the service does when it's down, for the flow that made it fail", async () => {
      vi.stubEnv("DATA_FIXTURES", "1");
      const dir = mkdtempSync(join(tmpdir(), "failing-"));
      vi.stubEnv("FAILING_DIR", dir);
      failService("flow_fetch", "public-api.luma.com", dir);
      flow.database = "flow_fetch";

      expect((await outsideFetch(LUMA, CALENDAR)).status).toBe(503);
      flow.database = undefined;
      rmSync(dir, { recursive: true, force: true });
    });
  });
});
