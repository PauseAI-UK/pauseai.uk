import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { logTiming, thisRequest, timed, timingLine } from "./request-timing.server";
import { newRequest } from "@/tests/request-cache";

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  cache: (await import("@/tests/request-cache")).cache,
}));

const held = vi.hoisted(() => ({ work: [] as (() => unknown)[], outside: false }));
vi.mock("next/server", async (importActual) => ({
  ...(await importActual<typeof import("next/server")>()),
  after: (work: () => unknown) => {
    if (held.outside) throw new Error("`after` was called outside a request scope");
    held.work.push(work);
  },
}));

beforeEach(() => {
  newRequest();
  held.work = [];
  held.outside = false;
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

/** A query that answers after `ms`. */
const answersIn = (ms: number) => timed(() => new Promise((done) => setTimeout(() => done(ms), ms)));

it("counts a request's queries, its time waiting once for those at the same time, and the most at once", async () => {
  const start = thisRequest().start;
  const first = Promise.all([answersIn(100), answersIn(50), answersIn(80)]);
  await vi.advanceTimersByTimeAsync(100);
  expect(await first).toEqual([100, 50, 80]);
  await vi.advanceTimersByTimeAsync(30);
  const second = answersIn(20);
  await vi.advanceTimersByTimeAsync(20);
  await second;
  expect(thisRequest()).toMatchObject({ queries: 4, waited: 120, going: 0, most: 3 });
  expect(timingLine("/staff/supporters/1", thisRequest(), start + 150)).toBe(
    "Staff request /staff/supporters/1: 150 ms, 4 queries, 120 ms waiting on the database, at most 3 at once",
  );
});

it("counts a query that fails, and throws it on", async () => {
  await expect(timed(() => Promise.reject(new Error("down")))).rejects.toThrow("down");
  expect(thisRequest()).toMatchObject({ queries: 1, going: 0 });
});

it("logs a request's timing once, after its response, however often it's asked", async () => {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  logTiming("/staff");
  logTiming("/staff");
  const asked = answersIn(0);
  await vi.advanceTimersByTimeAsync(0);
  await asked;
  expect(held.work).toHaveLength(1);
  held.work[0]();
  expect(info).toHaveBeenCalledWith(expect.stringMatching(/^Staff request \/staff: \d+ ms, 1 queries/));
  info.mockRestore();
});

it("logs nothing outside a request", () => {
  held.outside = true;
  expect(() => logTiming("/staff")).not.toThrow();
  expect(held.work).toEqual([]);
});
