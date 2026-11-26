import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import importPressBackground from "./import-press-background";

beforeEach(() => {
  vi.stubEnv("URL", "https://pauseai.uk");
  vi.stubEnv("CRON_SECRET", "s3cret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const start = (authorization?: string) =>
  importPressBackground(
    new Request("https://pauseai.uk/.netlify/functions/import-press-background", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
  );

/** The site reading `each` finds per call until `left` is gone. Returns how many calls it took. */
function site(left: number, each: number) {
  const calls = { count: 0 };
  server.use(
    http.post("https://pauseai.uk/api/cron/import-press", ({ request }) => {
      expect(request.headers.get("authorization")).toBe("Bearer s3cret");
      calls.count++;
      const read = Math.min(each, left);
      left -= read;
      return HttpResponse.json({ read, known: 0, unreadable: 0, left });
    }),
  );
  return calls;
}

describe("the background press survey function", () => {
  it("asks the site to read until there's nothing left", async () => {
    const calls = site(25, 10);
    await start("Bearer s3cret");
    expect(calls.count).toBe(3);
  });

  it("stops when a call reads nothing", async () => {
    const calls = site(25, 0);
    await start("Bearer s3cret");
    expect(calls.count).toBe(1);
  });

  it("stops short of Netlify's 15 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const calls = { count: 0 };
    server.use(
      http.post("https://pauseai.uk/api/cron/import-press", () => {
        calls.count++;
        vi.setSystemTime(Date.now() + 5 * 60_000);
        return HttpResponse.json({ read: 1, known: 0, unreadable: 0, left: 900 });
      }),
    );
    await start("Bearer s3cret");
    expect(calls.count).toBe(3);
  });

  it("does nothing for a call without the secret", async () => {
    const calls = site(5, 5);
    await start("Bearer guess");
    await start();
    expect(calls.count).toBe(0);
  });
});
