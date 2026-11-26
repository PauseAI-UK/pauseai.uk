import { beforeEach, expect, it, vi } from "vitest";
import type { GroupFound } from "@/lib/oversight/health";
import { checkAllHealth } from "@/lib/oversight/health.server";
import { GET, HEAD } from "./route";

vi.mock("@/lib/oversight/health.server", () => ({ checkAllHealth: vi.fn() }));

const sending = (status: "ok" | "bad"): GroupFound => ({
  group: "technical/sending",
  status,
  checks: { "email-sending": { status, failedInARow: 0 } },
});
const written: GroupFound = { group: "product/letters-written", status: "ok", checks: {} };

beforeEach(() => vi.stubEnv("FIXTURE_NOW", "2026-11-26T12:00:00Z"));

it("answers 200 with every group when all are good, never cached", async () => {
  vi.mocked(checkAllHealth).mockResolvedValue([sending("ok"), written]);
  const res = await GET();
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({
    status: "ok",
    checkedAt: "2026-11-26T12:00:00.000Z",
    groups: [sending("ok"), written],
  });
  expect(checkAllHealth).toHaveBeenCalledWith(new Date("2026-11-26T12:00:00Z"));
});

it("answers 503 when any group is bad", async () => {
  vi.mocked(checkAllHealth).mockResolvedValue([sending("bad"), written]);
  const res = await GET();
  expect(res.status).toBe(503);
  expect(await res.json()).toMatchObject({ status: "bad" });
});

it("answers HEAD as it does GET", () => {
  expect(HEAD).toBe(GET);
});
