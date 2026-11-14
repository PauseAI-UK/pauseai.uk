import { expect, it } from "vitest";
import { eventsCopy } from "./copy";

it("names the event whose guests or hosts Luma wouldn't give", () => {
  expect(eventsCopy.problems.eventGuests("evt-1")).toContain("evt-1");
  expect(eventsCopy.problems.eventHosts("evt-1")).toContain("evt-1");
});
