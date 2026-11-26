import { beforeEach, expect, it, vi } from "vitest";
import type { GroupFound } from "@/lib/oversight/health";
import { checkHealth } from "@/lib/oversight/health.server";
import { GET, HEAD } from "./route";

vi.mock("@/lib/oversight/health.server", () => ({ checkHealth: vi.fn() }));

const replies = (status: "ok" | "bad"): GroupFound => ({
  group: "product/replies",
  status,
  checks: { "letter-replies": { status, hoursSinceLast: 3, limitHours: 72 } },
});

const ask = (kind: string, group: string) =>
  GET(new Request(`https://pauseai.uk/api/health/${kind}/${group}`), { params: Promise.resolve({ kind, group }) });

beforeEach(() => vi.stubEnv("FIXTURE_NOW", "2026-11-26T12:00:00Z"));

it("answers 200 with what the group's checks found when all are good, never cached", async () => {
  vi.mocked(checkHealth).mockResolvedValue(replies("ok"));
  const res = await ask("product", "replies");
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ ...replies("ok"), checkedAt: "2026-11-26T12:00:00.000Z" });
  expect(checkHealth).toHaveBeenCalledWith("product/replies", new Date("2026-11-26T12:00:00Z"));
});

it("answers 503 when a check in the group is bad", async () => {
  vi.mocked(checkHealth).mockResolvedValue(replies("bad"));
  const res = await ask("product", "replies");
  expect(res.status).toBe(503);
  expect(await res.json()).toMatchObject({ status: "bad" });
});

it("answers 404 for a group there isn't", async () => {
  vi.mocked(checkHealth).mockClear();
  expect((await ask("product", "nothing")).status).toBe(404);
  expect(checkHealth).not.toHaveBeenCalled();
});

it("answers HEAD as it does GET", () => {
  expect(HEAD).toBe(GET);
});
