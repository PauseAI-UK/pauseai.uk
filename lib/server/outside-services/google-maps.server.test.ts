import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { FULL_MAPS_LINK, SHORT_MAPS_LINK } from "@/lib/server/fixtures/places";
import { whereLinkLeads } from "./google-maps.server";

const SHORT = "https://maps.app.goo.gl/abc";

describe("whereLinkLeads", () => {
  it("gives the full link a short one redirects to", async () => {
    expect(await whereLinkLeads(SHORT_MAPS_LINK)).toBe(FULL_MAPS_LINK);
  });

  it("reads the redirect rather than following it, and resolves one relative to the link", async () => {
    let asked = 0;
    server.use(
      http.get(SHORT, () => {
        asked++;
        return new HttpResponse(null, { status: 301, headers: { Location: "/next" } });
      }),
    );
    expect(await whereLinkLeads(SHORT)).toBe("https://maps.app.goo.gl/next");
    expect(asked).toBe(1);
  });

  it("gives null for a link that leads nowhere: Google's 404, or a page that isn't a redirect", async () => {
    expect(await whereLinkLeads(SHORT)).toBeNull();
    server.use(http.get(SHORT, () => new HttpResponse("A page", { status: 200 })));
    expect(await whereLinkLeads(SHORT)).toBeNull();
  });

  it("throws Google's failure for any other answer, a redirect without a Location among them", async () => {
    server.use(http.get(SHORT, () => new HttpResponse(null, { status: 302 })));
    await expect(whereLinkLeads(SHORT)).rejects.toMatchObject({ service: "google-maps", status: 302 });
    server.use(http.get(SHORT, () => new HttpResponse(null, { status: 503 })));
    const failure = await whereLinkLeads(SHORT).catch((error: unknown) => error);
    expect(failure).toMatchObject({ service: "google-maps", kind: "refused", status: 503 });
    expect(String(failure)).toContain(`Google Maps answered 503 for ${SHORT}`);
  });
});
