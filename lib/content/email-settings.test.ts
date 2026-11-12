import { expect, it } from "vitest";
import { emailSettingsCopy as copy, settingsDate } from "./email-settings";

it("says a date as a day, and nothing for none", () => {
  expect(settingsDate(new Date("2026-11-02T10:00:00Z"))).toBe("2 November 2026");
  expect(settingsDate(null)).toBe("");
});

it("words each reason", () => {
  const where = copy.sourceWords("march-2026-11");
  for (const words of Object.values(copy.why.reasons)) expect(words!(where)).not.toBe("");
  expect(copy.sourceWords(null)).toBe("");
});
