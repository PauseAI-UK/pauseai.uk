import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { pausefest } from "@/lib/content/pausefest";
import { getPauseFestLive } from "./pausefest";

const EVENT = "https://api.lu.ma/event/get";
const events = pausefest.days.flatMap((day) => day.events);

describe("getPauseFestLive", () => {
  it("gives every event's times and who's going, by its Luma ID, but not the guests of one that hides them", async () => {
    const live = await getPauseFestLive();
    expect(Object.keys(live)).toEqual(events.map((event) => event.lumaId));
    const shown = events.find((event) => !event.hideGuests)!;
    const hidden = events.find((event) => event.hideGuests)!;
    expect(live[shown.lumaId]).toEqual({ time: "6–9pm", going: expect.objectContaining({ count: 1234 }) });
    expect(live[hidden.lumaId]).toEqual({ time: "6–9pm", going: null });
  });

  it("gives no time when Luma gives no end", async () => {
    server.use(http.get(EVENT, () => HttpResponse.json({ event: { start_at: "2026-11-20T18:00:00.000Z" } })));
    expect((await getPauseFestLive())[events[0].lumaId]).toEqual({ time: null, going: null });
  });

  it("gives nothing when Luma errs", async () => {
    server.use(http.get(EVENT, () => new HttpResponse(null, { status: 500 })));
    expect((await getPauseFestLive())[events[0].lumaId]).toEqual({ time: null, going: null });
  });
});
