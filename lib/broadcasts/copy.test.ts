import { describe, expect, it } from "vitest";
import { mailingsCopy } from "@/lib/mailings/copy";
import { broadcastsCopy } from "./copy";

it("names WhatsApp as what holds back a text, and what sends it for an email", () => {
  const { body } = broadcastsCopy.notifications.broadcastHeldBack;
  expect(body("Rain", "text", "10:18", "Rate limit hit", "Mon", "")).toContain("WhatsApp");
  expect(body("Rain", "email", "10:18", "Quota", "Mon", "")).not.toContain("WhatsApp");
});

it("ends WhatsApp's reason for refusing a template with one full stop, whether its own has one or not", () => {
  for (const reason of ["Message too long.", "Message too long"]) {
    expect(broadcastsCopy.broadcastPages.submitFailed(reason)).toContain("saying “Message too long.” Change it");
  }
});

it("says why a broadcast waits", () => {
  const waiting = broadcastsCopy.notifications.broadcastWaiting;
  expect(waiting.body("Hi", "civicrm", "3 Nov", "link")).toContain("CiviCRM isn't answering");
  expect(waiting.body("Hi", "pull", "3 Nov", "link")).toContain("our import from CiviCRM hasn't worked");
  expect(broadcastsCopy.broadcastPages.waiting("civicrm", "5 Nov")).toContain("Waiting for CiviCRM to work again");
  expect(broadcastsCopy.broadcastPages.waiting("pull", "5 Nov")).toContain("Waiting for an import");
});

describe("the words of messages to supporters", () => {
  const copy = broadcastsCopy.broadcastPages;

  it("count one and many, by channel", () => {
    for (const n of [1, 2]) {
      for (const channel of ["email", "text"] as const) {
        const said = [
          mailingsCopy.mailingPages.sendFacts.count(n, channel),
          copy.schedule(n, channel),
          copy.scheduledLine(n, channel, "PauseAI UK"),
        ];
        for (const words of said) expect(words).toEqual(expect.any(String));
      }
      const others = [
        copy.willGet(n, "text"),
        copy.broadcastButton(n),
        copy.choosingCount(n),
        copy.recipientsCount(n),
        copy.templateUsed("1 Oct 2026", n),
      ];
      for (const words of others) expect(words).toContain(String(n));
    }
    expect(copy.schedule(1, "email")).not.toEqual(copy.schedule(2, "email"));
    expect(copy.willGet(1, "email")).toBe("1 supporter will be emailed.");
    expect(copy.willGet(2, "text")).toBe("2 supporters will be texted.");
  });
});
