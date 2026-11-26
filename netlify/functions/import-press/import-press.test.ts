import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { JOBS } from "@/lib/import-runs";
import { moreToRead } from "./more-to-read";
import importPress, { config } from "./import-press";

beforeEach(() => {
  vi.stubEnv("URL", "https://pauseai.uk");
  vi.stubEnv("CRON_SECRET", "s3cret");
});
afterEach(() => vi.unstubAllEnvs());

const CALL = { searched: 0, found: 0, read: 0, known: 0, unreadable: 0, waiting: 0, notOurs: 0, left: 0, told: 0 };
const BACKGROUND = "https://pauseai.uk/.netlify/functions/import-press-background";

/** The site answering each call with `call`, and the background function's calls, with their authorisation. */
function site(call: object, background = 202) {
  const calls: (string | null)[] = [];
  server.use(
    http.post("https://pauseai.uk/api/cron/import-press", () => HttpResponse.json(call)),
    http.post(BACKGROUND, ({ request }) => {
      calls.push(request.headers.get("authorization"));
      return new HttpResponse(null, { status: background });
    }),
  );
  return calls;
}

describe("the press survey function", () => {
  it("runs nightly, and hands on to the background function only while finds are left to read", async () => {
    expect(config.schedule).toBe(JOBS["import-press"].cron);
    expect(site(CALL).length).toBe(0);
    expect(await (await importPress()).json()).toEqual(CALL);
    const calls = site({ ...CALL, read: 4, left: 9 });
    await importPress();
    expect(calls).toEqual(["Bearer s3cret"]);
  });

  it("fails loudly if the background function won't start", async () => {
    site({ ...CALL, read: 1, left: 1 }, 500);
    await expect(importPress()).rejects.toThrow("import-press-background returned 500");
  });
});

describe("moreToRead", () => {
  it("is while finds are left and the last call searched, or read, found known or failed to read some", () => {
    expect(moreToRead({ ...CALL, left: 2, read: 1 })).toBe(true);
    // A call whose time went on searching, as the night's first can, has read none yet, and Google has answered it.
    expect(moreToRead({ ...CALL, left: 26, searched: 3 })).toBe(true);
    expect(moreToRead({ ...CALL, left: 2, known: 1 })).toBe(true);
    expect(moreToRead({ ...CALL, left: 2, unreadable: 1 })).toBe(true);
    expect(moreToRead({ ...CALL, left: 2 })).toBe(false);
    expect(moreToRead({ ...CALL, read: 3 })).toBe(false);
  });

  it("isn't when another run was going, which answers without counts", () => {
    expect(moreToRead({})).toBe(false);
  });
});
