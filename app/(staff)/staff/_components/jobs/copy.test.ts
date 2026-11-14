import { expect, it } from "vitest";
import { jobsCopy } from "./copy";

it("words a stretch of runs' times as one time when they're the same", () => {
  expect(jobsCopy.runs.range("09:00", "09:00")).toBe("09:00");
  expect(jobsCopy.runs.range("09:00", "09:05")).toBe("09:00–09:05");
});
