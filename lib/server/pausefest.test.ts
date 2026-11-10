import { describe, expect, it } from "vitest";
import { pausefest } from "@/lib/content/pausefest";
import { getPauseFestGoing } from "./pausefest";

describe("getPauseFestGoing", () => {
  it("asks Luma who's going to every event, by its ID", async () => {
    const going = await getPauseFestGoing();
    const ids = pausefest.days.flatMap((day) => day.events.map((event) => event.lumaId));
    expect(Object.keys(going)).toEqual(ids);
    expect(going[ids[0]]?.count).toBe(1234);
  });
});
