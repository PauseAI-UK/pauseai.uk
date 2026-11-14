import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { staffCopy } from "@/lib/content/staff-interface";
import { server } from "@/tests/fixtures/msw";
import { startLumaImport } from "./netlify-functions.server";

const BACKGROUND = "https://pauseai.uk/.netlify/functions/import-luma-background";

describe("startLumaImport", () => {
  afterEach(() => vi.unstubAllEnvs());

  /** Netlify's build, with its address and our secret, unless `env` says otherwise; and what the call sent. */
  async function start(env: Record<string, string> = {}) {
    vi.stubEnv("DEPLOY_CONTEXT", "deploy-preview");
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    vi.stubEnv("CRON_SECRET", "secret");
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const calls: (string | null)[] = [];
    server.use(
      http.post(BACKGROUND, ({ request }) => {
        calls.push(request.headers.get("authorization"));
        return new HttpResponse(null, { status: 202 });
      }),
    );
    await startLumaImport();
    return calls;
  }

  it("starts the background function on Netlify, with our secret", async () => {
    expect(await start()).toEqual(["Bearer secret"]);
  });

  it("does nothing in a local build, without the secret, or without the site's address", async () => {
    expect(await start({ DEPLOY_CONTEXT: "local" })).toEqual([]);
    expect(await start({ CRON_SECRET: "" })).toEqual([]);
    expect(await start({ SITE_ORIGIN: "" })).toEqual([]);
  });

  it("reports a refusal, as the next scheduled run copies it anyway", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(BACKGROUND, () => new HttpResponse(null, { status: 401 })));
    vi.stubEnv("DEPLOY_CONTEXT", "deploy-preview");
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    vi.stubEnv("CRON_SECRET", "secret");
    await startLumaImport();
    expect(error).toHaveBeenCalledWith(staffCopy.problems.logs.lumaImportNotStarted, "It answered 401");
  });

  it("never throws when it can't start it, as the next scheduled run does it anyway", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(BACKGROUND, () => HttpResponse.error()));
    vi.stubEnv("DEPLOY_CONTEXT", "deploy-preview");
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    vi.stubEnv("CRON_SECRET", "secret");
    await expect(startLumaImport()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});
