import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { holdService, releaseService, whileHeld } from "./held-services";

describe("an outside service held for one flow", () => {
  const dir = mkdtempSync(join(tmpdir(), "held-"));
  afterEach(() => {
    releaseService("flow_a", dir);
    vi.useRealTimers();
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("holds the flow's calls to the host until the flow lets them go", async () => {
    holdService("flow_a", "public-api.luma.com", dir);
    let answered = false;
    const call = whileHeld("public-api.luma.com", "flow_a", dir).then(() => (answered = true));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(answered).toBe(false);
    releaseService("flow_a", dir);
    await call;
    expect(answered).toBe(true);
  });

  it("holds nothing else: another host, another flow, or no flow or folder", async () => {
    holdService("flow_a", "public-api.luma.com", dir);
    await whileHeld("api.postcodes.io", "flow_a", dir);
    await whileHeld("public-api.luma.com", "flow_b", dir);
    await whileHeld("public-api.luma.com", undefined, dir);
    await whileHeld("public-api.luma.com", "flow_a", undefined);
  });

  it("lets a call go after 30 seconds, held or not", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    holdService("flow_a", "public-api.luma.com", dir);
    const call = whileHeld("public-api.luma.com", "flow_a", dir);
    await vi.advanceTimersByTimeAsync(30_100);
    await call;
  });
});
