import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { THEYWORKFORYOU_PEOPLE, WIKIDATA_QUERY } from "@/lib/politicians/wikidata";
import { memberHonours, mspPeople, seneddPeople } from "./wikidata.server";

it("finds Senedd members by their Senedd ID, and only those Wikidata knows", async () => {
  expect(await seneddPeople([92001, 1])).toEqual(new Map([[92001, { gender: "female", surname: "Example" }]]));
});

it("finds MSPs through TheyWorkForYou's IDs for them, and only those both know", async () => {
  expect(await mspPeople([91001, 2])).toEqual(new Map([[91001, { gender: "female", surname: "Example" }]]));
});

it("finds who's Sir or Dame by the ID each body gives them, as Wikidata keeps it", async () => {
  const asked: string[] = [];
  server.use(
    http.post(WIKIDATA_QUERY, async ({ request }) => {
      asked.push(new URLSearchParams(await request.text()).get("query") ?? "");
      return HttpResponse.json({
        results: {
          bindings: [
            { id: { value: "1446" }, honour: { value: "http://www.wikidata.org/entity/Q209690" } },
            { id: { value: "99001" }, honour: { value: "http://www.wikidata.org/entity/Q901407" } },
          ],
        },
      });
    }),
  );
  expect(await memberHonours("parliament", [1446, 373])).toEqual(new Map([[1446, "Sir"]]));
  expect(asked[0]).toContain("wdt:P10428");
  expect(await memberHonours("scottish-parliament", [91001])).toEqual(new Map([[91001, "Dame"]]));
  expect(asked[1]).toContain('"99001"');
  await memberHonours("ni-assembly", [93001]);
  expect(asked[2]).toContain("wdt:P5870");
});

it("asks nothing for no one", async () => {
  server.use(
    http.get(THEYWORKFORYOU_PEOPLE, () => new HttpResponse(null, { status: 500 })),
    http.post(WIKIDATA_QUERY, () => new HttpResponse(null, { status: 500 })),
  );
  expect(await seneddPeople([])).toEqual(new Map());
  expect(await mspPeople([])).toEqual(new Map());
  await expect(mspPeople([2])).rejects.toThrow("returned 500");
  server.use(http.get(THEYWORKFORYOU_PEOPLE, () => HttpResponse.json({ persons: [] })));
  // An MSP TheyWorkForYou doesn't know can't be found in Wikidata, so it isn't asked.
  expect(await mspPeople([2])).toEqual(new Map());
  await expect(seneddPeople([1])).rejects.toThrow("returned 500");
});
