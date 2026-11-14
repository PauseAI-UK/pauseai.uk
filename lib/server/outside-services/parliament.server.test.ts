import { expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { memberUrl } from "@/lib/politicians/parliament";
import { parliamentEndings, parliamentMembersNow } from "./parliament.server";

const LISTS = "https://data.parliament.uk/membersdataplatform/services/mnis/members/query/:query/Addresses/";

it("reads both Houses' members, past the byte-order mark Parliament starts its JSON with", async () => {
  const members = await parliamentMembersNow();
  expect(members.map((m) => [m.house, m.name])).toEqual([
    ["commons", "Ms Dora Dummy"],
    ["commons", "Polly Placeholder"],
    ["commons", "Mo Example"],
    ["lords", "Lord Seedling of Example"],
  ]);
});

it("asks why each member left, a few at a time", async () => {
  const ids = [1, 2, 3, 4, 5, 6];
  const endings = await parliamentEndings(ids);
  expect([...endings.keys()]).toEqual(ids);
  expect(endings.get(6)).toEqual({ status: "retired", date: "2026-10-01", reason: "Retirement" });
});

it("waits and tries again when Parliament is busy", async () => {
  let calls = 0;
  server.use(
    http.get(LISTS, () =>
      ++calls === 1 ? new HttpResponse(null, { status: 429, headers: { "Retry-After": "0" } }) : undefined,
    ),
    http.get(memberUrl(7), () =>
      ++calls === 4 ? new HttpResponse(null, { status: 503, headers: { "Retry-After": "0" } }) : undefined,
    ),
  );
  expect(await parliamentMembersNow()).toHaveLength(4);
  expect((await parliamentEndings([7])).get(7)?.status).toBe("retired");
  expect(calls).toBeGreaterThanOrEqual(5);
});

it("gives up after five busy answers, waiting longer each time without Retry-After, and at once on another failure", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  let calls = 0;
  server.use(http.get(memberUrl(8), () => (calls++, new HttpResponse(null, { status: 429 }))));
  const failed = expect(parliamentEndings([8])).rejects.toThrow("returned 429");
  await vi.runAllTimersAsync();
  await failed;
  vi.useRealTimers();
  expect(calls).toBe(5);
  server.use(http.get(LISTS, () => new HttpResponse(null, { status: 500 })));
  await expect(parliamentMembersNow()).rejects.toThrow("returned 500");
});
