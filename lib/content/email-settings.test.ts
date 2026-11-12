import { expect, it } from "vitest";
import { emailSettingsCopy as copy, settingsDate } from "./email-settings";

it("says a date as a day, and nothing for none", () => {
  expect(settingsDate(new Date("2026-11-02T10:00:00Z"))).toBe("2 November 2026");
  expect(settingsDate(null)).toBe("");
});

it("says “it” of the newsletter alone, and “them” of any other emails unsubscribed from", () => {
  expect(copy.unsubscribe.doneBody(["newsletter"])).toBe("You won't get it by email any more.");
  expect(copy.unsubscribe.doneBody(["events"])).toBe("You won't get them by email any more.");
  expect(copy.unsubscribe.doneBody(["newsletter", "events"])).toContain("them");
});

it("words each reason", () => {
  const where = copy.sourceWords("march-2026-11");
  for (const words of Object.values(copy.why.reasons)) expect(words!(where)).not.toBe("");
  expect(copy.sourceWords(null)).toBe("");
});
