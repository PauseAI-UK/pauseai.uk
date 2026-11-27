import { expect, it } from "vitest";
import { isGuestStatus } from "./guests";

it("takes a registration's statuses, and none of Luma's others", () => {
  expect(["approved", "pending_approval", "waitlist", "declined"].every(isGuestStatus)).toBe(true);
  expect(isGuestStatus("invited")).toBe(false);
});
