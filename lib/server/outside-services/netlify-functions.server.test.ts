import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/tests/fixtures/msw";
import { startLumaImport } from "./netlify-functions.server";
import { serverProblems } from "@/lib/server/copy";

const BACKGROUND = "https://pauseai.uk/.netlify/functions/run-job-background";

describe("startLumaImport", () => {
  afterEach(() => vi.unstubAllEnvs());

  /** Netlify's build, with its address and our secret, unless `env` says otherwise; and what the call sent. */
  async function start(env: Record<string, string> = {}) {
    vi.stubEnv("DEPLOY_CONTEXT", "deploy-preview");
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    vi.stubEnv("CRON_SECRET", "secret");
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const calls: unknown[] = [];
    server.use(
      http.post(BACKGROUND, async ({ request }) => {
        calls.push([request.headers.get("authorization"), await request.json()]);
        return new HttpResponse(null, { status: 202 });
      }),
    );
    await startLumaImport();
    return calls;
  }

  it("starts the background function on Netlify, with our secret, to import as the schedule would", async () => {
    expect(await start()).toEqual([["Bearer secret", { job: "import-luma", startedBy: "nightly" }]]);
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
    expect(error).toHaveBeenCalledWith(serverProblems.lumaImportNotStarted().what, "Netlify answered 401");
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
