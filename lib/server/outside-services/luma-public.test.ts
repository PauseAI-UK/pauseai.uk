import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { getEventGoing } from "./luma-public";

const EVENT = "https://api.lu.ma/event/get";

describe("getEventGoing", () => {
  it("counts who's going and names the guests Luma features, leaving out a photo next/image can't show and a guest with no name", async () => {
    expect(await getEventGoing("evt-x")).toEqual({
      count: 1234,
      guests: [
        { name: "Jane Fixture", avatar: null },
        { name: "Sam Fixture", avatar: null },
      ],
    });
  });

  it("asks for the event by its ID, and keeps a photo from Luma's CDN", async () => {
    let request: Request | undefined;
    server.use(
      http.get(EVENT, ({ request: r }) => {
        request = r;
        return HttpResponse.json({
          guest_count: 2,
          featured_guests: [{ name: "Jane Fixture", avatar_url: "https://images.lumacdn.com/avatars/jane.jpg" }],
        });
      }),
    );
    expect(await getEventGoing("evt-x")).toEqual({
      count: 2,
      guests: [{ name: "Jane Fixture", avatar: "https://images.lumacdn.com/avatars/jane.jpg" }],
    });
    expect(new URL(request!.url).searchParams.get("event_api_id")).toBe("evt-x");
  });

  it("names no one when Luma features no one", async () => {
    server.use(http.get(EVENT, () => HttpResponse.json({ guest_count: 0 })));
    expect(await getEventGoing("evt-x")).toEqual({ count: 0, guests: [] });
  });

  it("returns null when Luma gives no count", async () => {
    server.use(http.get(EVENT, () => HttpResponse.json({ featured_guests: [] })));
    expect(await getEventGoing("evt-x")).toBeNull();
  });

  it("returns null when Luma errs", async () => {
    server.use(http.get(EVENT, () => new HttpResponse(null, { status: 404 })));
    expect(await getEventGoing("evt-x")).toBeNull();
  });

  it("returns null when the request throws", async () => {
    server.use(http.get(EVENT, () => HttpResponse.error()));
    expect(await getEventGoing("evt-x")).toBeNull();
  });
});
