import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { SENEDD_MEMBERS_URL } from "@/lib/politicians/senedd";
import { niAssemblyMembersNow, scottishParliamentMembersNow, seneddMembersNow } from "./devolved-bodies.server";

it("reads each body's sitting members", async () => {
  expect((await scottishParliamentMembersNow(new Date("2026-11-13"))).map((m) => m.name)).toEqual(["Morag Example"]);
  expect((await seneddMembersNow()).map((m) => m.name)).toEqual(["Gwen Example"]);
  expect((await niAssemblyMembersNow()).map((m) => m.name)).toEqual(["Aoife Example"]);
});

it("asks the Senedd with a User-Agent of our own, as it refuses curl's", async () => {
  let agent: string | null = null;
  server.use(
    http.get(SENEDD_MEMBERS_URL, ({ request }) => {
      agent = request.headers.get("user-agent");
      return undefined;
    }),
  );
  await seneddMembersNow();
  expect(agent).toBe("PauseAI UK (https://pauseai.uk)");
});

it("fails when a body refuses", async () => {
  server.use(http.get(SENEDD_MEMBERS_URL, () => new HttpResponse("Forbidden", { status: 403 })));
  await expect(seneddMembersNow()).rejects.toThrow("returned 403");
});
