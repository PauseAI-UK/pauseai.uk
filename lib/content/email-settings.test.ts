import { expect, it } from "vitest";
import { emailSettingsCopy as copy, settingsDate } from "./email-settings";

it("says a date as a day, and nothing for none", () => {
  expect(settingsDate(new Date("2026-11-02T10:00:00Z"))).toBe("2 November 2026");
  expect(settingsDate(null)).toBe("");
});

it("words each reason, and No bulk emails with or without its date", () => {
  const where = copy.sourceWords("march-2026-11");
  for (const words of Object.values(copy.why.reasons)) expect(words!(where)).not.toBe("");
  expect(copy.sourceWords(null)).toBe("");
  expect(copy.noBulk.body(new Date("2026-03-03T12:00:00Z"))).toContain("3 March 2026");
  expect(copy.noBulk.body(null)).not.toContain("recorded");
});
