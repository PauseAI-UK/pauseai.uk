import { expect, it } from "vitest";
import { outsideId, publicText } from "@/lib/problems";
import { eventProblems } from "./copy";

it("names the event whose guests or hosts Luma wouldn't give, or wouldn't tag", () => {
  expect(eventProblems.eventGuests({ event: outsideId("evt-1") }).what).toContain("evt-1");
  expect(eventProblems.eventHosts({ event: outsideId("evt-1") }).what).toContain("evt-1");
  expect(eventProblems.lumaTagRefused({ event: publicText("Leeds protest") }).what).toContain("Leeds protest");
});
