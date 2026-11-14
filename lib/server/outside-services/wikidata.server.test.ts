import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { THEYWORKFORYOU_PEOPLE, WIKIDATA_QUERY } from "@/lib/politicians/wikidata";
import { mspPeople, seneddPeople } from "./wikidata.server";

it("finds Senedd members by their Senedd ID, and only those Wikidata knows", async () => {
  expect(await seneddPeople([92001, 1])).toEqual(new Map([[92001, { gender: "female", surname: "Example" }]]));
});

it("finds MSPs through TheyWorkForYou's IDs for them, and only those both know", async () => {
  expect(await mspPeople([91001, 2])).toEqual(new Map([[91001, { gender: "female", surname: "Example" }]]));
});

it("asks nothing for no one", async () => {
  server.use(
    http.get(THEYWORKFORYOU_PEOPLE, () => new HttpResponse(null, { status: 500 })),
    http.post(WIKIDATA_QUERY, () => new HttpResponse(null, { status: 500 })),
  );
  expect(await seneddPeople([])).toEqual(new Map());
  expect(await mspPeople([])).toEqual(new Map());
  await expect(seneddPeople([1])).rejects.toThrow("returned 500");
});
