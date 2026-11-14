import { describe, expect, it } from "vitest";
import { staffCopy } from "./staff-interface";

describe("staff interface copy", () => {
  it("counts the errors a night's tidying deleted, none for a run kept from before it did", () => {
    const counts = { importRuns: 12, auditEntries: 3, drafts: 4 };
    expect(staffCopy.tidying.result({ ...counts, errors: 5 })).toContain("5 errors");
    expect(staffCopy.tidying.result(counts)).toContain("0 errors");
  });

  it("puts the number in the changes list's total", () => {
    expect(staffCopy.changes.total(7)).toContain("7");
  });

  it("names what each change counts", () => {
    for (const [key, say] of Object.entries(staffCopy.changes.counts)) expect(say(2), key).not.toBe("");
  });

  it("names WhatsApp as what holds back a text, and what sends it for an email", () => {
    const { body } = staffCopy.notifications.broadcastHeldBack;
    expect(body("Rain", "text", "10:18", "Rate limit hit", "Mon", "")).toContain("WhatsApp");
    expect(body("Rain", "email", "10:18", "Quota", "Mon", "")).not.toContain("WhatsApp");
  });

  it("ends the bounce's reason with one full stop, whether Postmark's has one or not", () => {
    for (const reason of ["Mailbox not found.", "Mailbox not found"]) {
      expect(staffCopy.alert.body("Testy MP", "testy@example.org", reason, "https://example.org")).toContain(
        "The mail server said: “Mailbox not found.”",
      );
    }
  });

  it("ends WhatsApp's reason for refusing a template with one full stop, whether its own has one or not", () => {
    for (const reason of ["Message too long.", "Message too long"]) {
      expect(staffCopy.broadcastPages.submitFailed(reason)).toContain("saying “Message too long.” Change it");
    }
  });
});

it("words the runs' times, problems and results", () => {
  const { runs } = staffCopy;
  expect(runs.range("09:00", "09:00")).toBe("09:00");
  expect(runs.range("09:00", "09:05")).toBe("09:00–09:05");
  const { job, anywhere, logs } = staffCopy.problems;
  for (const words of [job.couldntRead, job.nameUnknown]) {
    expect(words("jo@pauseai.uk")).toContain("jo@pauseai.uk");
  }
  expect(anywhere.sendFailed("mailing")).toContain("mailing");
  expect(logs.badBody("Postmark")).toContain("Postmark");
  expect(anywhere.charsetUnknown("x-mac")).toContain("x-mac");
});

describe("the words of messages to supporters", () => {
  const copy = staffCopy.broadcastPages;

  it("count one and many, by channel", () => {
    for (const n of [1, 2]) {
      for (const channel of ["email", "text"] as const) {
        const said = [
          copy.sendFacts.count(n, channel),
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
