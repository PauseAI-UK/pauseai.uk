import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import runJobBackground from "./run-job-background";

beforeEach(() => {
  vi.stubEnv("URL", "https://pauseai.uk");
  vi.stubEnv("CRON_SECRET", "s3cret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

// Called on a deploy preview's own address, which is where it asks the site to run the job.
const PREVIEW = "https://deploy-preview-7--pauseaiuk.netlify.app";

/** Starts it with `body`, sending `authorization`, or no such header when it's empty. */
const start = (body: object, authorization = "Bearer s3cret") =>
  runJobBackground(
    new Request(`${PREVIEW}/.netlify/functions/run-job-background`, {
      method: "POST",
      headers: authorization ? { authorization } : {},
      body: JSON.stringify(body),
    }),
  );

/** The site answering each call to `job` with the next of `answers`, the last over and over. Returns the calls' bodies. */
function site(job: string, ...answers: object[]) {
  const calls: unknown[] = [];
  server.use(
    http.post(`${PREVIEW}/api/cron/${job}`, async ({ request }) => {
      expect(request.headers.get("authorization")).toBe("Bearer s3cret");
      calls.push(await request.json());
      return HttpResponse.json(answers[Math.min(calls.length, answers.length) - 1]);
    }),
  );
  return calls;
}

describe("the background function that runs every job", () => {
  it("asks the site to run the job once, as whoever started it, for a job a call does whole", async () => {
    const calls = site("import-luma", { events: 1 });
    await start({ job: "import-luma", startedBy: "nightly" });
    expect(calls).toEqual([{ startedBy: "nightly", marked: false }]);
  });

  it("asks again while the press survey has finds left to read, the job marked by the staff member only for the first call", async () => {
    const calls = site("import-press", { read: 10, left: 15 }, { read: 10, left: 5 }, { read: 5, left: 0 });
    await start({ job: "import-press", startedBy: "jo@pauseai.uk", marked: true });
    expect(calls).toEqual([
      { startedBy: "jo@pauseai.uk", marked: true },
      { startedBy: "jo@pauseai.uk", marked: false },
      { startedBy: "jo@pauseai.uk", marked: false },
    ]);
  });

  it("asks again while there's more to send, stopping when a call sends nothing", async () => {
    const calls = site("send-mailings", { sent: 7, left: 3 }, { sent: 0, left: 3 });
    await start({ job: "send-mailings", startedBy: "nightly" });
    expect(calls).toHaveLength(2);
  });

  it("stops short of Netlify's 15 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const calls: unknown[] = [];
    server.use(
      http.post(`${PREVIEW}/api/cron/import-press`, () => {
        calls.push(1);
        vi.setSystemTime(Date.now() + 5 * 60_000);
        return HttpResponse.json({ read: 1, left: 900 });
      }),
    );
    await start({ job: "import-press", startedBy: "nightly" });
    expect(calls).toHaveLength(3);
  });

  it("does nothing for a call without the secret, or with none set", async () => {
    const calls = site("import-luma", {});
    await start({ job: "import-luma", startedBy: "nightly" }, "Bearer guess");
    await start({ job: "import-luma", startedBy: "nightly" }, "");
    vi.stubEnv("CRON_SECRET", "");
    await start({ job: "import-luma", startedBy: "nightly" }, "Bearer ");
    expect(calls).toEqual([]);
  });

  it("fails loudly if the site does", async () => {
    server.use(http.post(`${PREVIEW}/api/cron/import-luma`, () => new HttpResponse("nope", { status: 500 })));
    await expect(start({ job: "import-luma", startedBy: "nightly" })).rejects.toThrow(
      "/api/cron/import-luma returned 500: nope",
    );
  });
});
