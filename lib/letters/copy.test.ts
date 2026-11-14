import { expect, it } from "vitest";
import { lettersCopy } from "./copy";

it("names a letter's page by whom it was from and to, and a supporter's letters' by who wrote them", () => {
  expect(lettersCopy.letters.oneTitle("Jane Smith", "Testy MP")).toContain("Jane Smith");
  expect(lettersCopy.letters.oneTitle("Jane Smith", "Testy MP")).toContain("Testy MP");
  expect(lettersCopy.letters.fromTitle("Jane Smith")).toContain("Jane Smith");
});

it("puts the number in the letters list's total", () => {
  expect(lettersCopy.letters.total(7)).toContain("7");
});

it("says which inbox the one-off emails are copied to", () => {
  expect(lettersCopy.allLetters.intro("policy@example.org")).toContain("policy@example.org");
});

it("names the letter a problem is about", () => {
  expect(lettersCopy.problems.letterNotSent(7)).toContain("7");
});

it("ends a bounced letter's reason with one full stop, whether Postmark's has one or not", () => {
  for (const reason of ["Mailbox not found.", "Mailbox not found"]) {
    expect(lettersCopy.alert.body("Testy MP", "testy@example.org", reason, "https://example.org")).toContain(
      "The mail server said: “Mailbox not found.”",
    );
  }
});
