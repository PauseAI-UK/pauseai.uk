import { describe, expect, it } from "vitest";
import { pausefest } from "@/lib/content/pausefest";
import { getPauseFestGoing } from "./pausefest";

describe("getPauseFestGoing", () => {
  it("asks Luma who's going to every event with a Luma ID, by that ID", async () => {
    const going = await getPauseFestGoing();
    const events = pausefest.days.flatMap((day) => day.events);
    const ids = events.flatMap((event) => (event.lumaId ? [event.lumaId] : []));
    expect(ids.length).toBeLessThan(events.length);
    expect(Object.keys(going)).toEqual(ids);
    expect(going[ids[0]]?.count).toBe(1234);
  });
});
