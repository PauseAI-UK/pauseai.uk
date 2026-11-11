import { describe, expect, it } from "vitest";
import { ASK_STATUSES } from "@/lib/asks";
import { COUNTRIES, PERSON_STATUSES } from "@/lib/server/politicians";
import { staffCopy } from "./staff-interface";

describe("staff interface copy", () => {
  it("counts the errors a night's tidying deleted, none for a run kept from before it did", () => {
    const counts = { importRuns: 12, auditEntries: 3, drafts: 4 };
    expect(staffCopy.tidying.result({ ...counts, errors: 5 })).toContain("5 errors");
    expect(staffCopy.tidying.result(counts)).toContain("0 errors");
  });

  it("puts the number in each list's total", () => {
    const { letters, politicians, supporters, mailings, changes } = staffCopy;
    for (const list of [letters, politicians, supporters, mailings, changes]) expect(list.total(7)).toContain("7");
  });

  it("names what each change counts", () => {
    for (const [key, say] of Object.entries(staffCopy.changes.counts)) expect(say(2), key).not.toBe("");
  });

  it("says who the mailing leaves out, and why", () => {
    const { leftOut } = staffCopy.mailingPages;
    expect(leftOut(3, 1, 0)).toContain("filter");
    expect(leftOut(3, 0, 2, true)).not.toContain("filter");
  });

  it("names the ask being edited", () => {
    expect(staffCopy.asks.editTitle("Winter reception")).toContain("Winter reception");
  });

  it("ends the bounce's reason with one full stop, whether Postmark's has one or not", () => {
    for (const reason of ["Mailbox not found.", "Mailbox not found"]) {
      expect(staffCopy.alert.body("Testy MP", "testy@example.org", reason, "https://example.org")).toContain(
        "The mail server said: “Mailbox not found.”",
      );
    }
  });

  it("names a letter's page by whom it was from and to, and a supporter's letters' by who wrote them", () => {
    expect(staffCopy.letters.oneTitle("Jane Smith", "Testy MP")).toContain("Jane Smith");
    expect(staffCopy.letters.oneTitle("Jane Smith", "Testy MP")).toContain("Testy MP");
    expect(staffCopy.letters.fromTitle("Jane Smith")).toContain("Jane Smith");
  });

  it("names every house and status", () => {
    expect(Object.keys(staffCopy.houses)).toEqual([
      "commons",
      "lords",
      "scottish-parliament",
      "senedd",
      "ni-assembly",
      "other",
    ]);
    // Every status any kind of ask allows, and the words for no answer.
    expect(Object.keys(staffCopy.statuses).sort()).toEqual(
      [...new Set(Object.values(ASK_STATUSES).flat()), "noAnswer"].sort(),
    );
    expect(Object.keys(staffCopy.personStatuses)).toEqual([...PERSON_STATUSES]);
    expect(Object.keys(staffCopy.countries)).toEqual([...COUNTRIES]);
  });
});

it("words the runs' times, problems and results", () => {
  const { runs } = staffCopy;
  expect(runs.range("09:00", "09:00")).toBe("09:00");
  expect(runs.range("09:00", "09:05")).toBe("09:00–09:05");
  const { job, anywhere, logs } = staffCopy.problems;
  for (const words of [job.couldntRead, job.nameUnknown, logs.tokenNotRevoked]) {
    expect(words("jo@pauseai.uk")).toContain("jo@pauseai.uk");
  }
  expect(job.eventGuests("evt-1")).toContain("evt-1");
  expect(job.eventHosts("evt-1")).toContain("evt-1");
  expect(anywhere.sendFailed("mailing")).toContain("mailing");
  expect(logs.badBody("Postmark")).toContain("Postmark");
  expect(anywhere.letterNotSent(7)).toContain("7");
  expect(anywhere.charsetUnknown("x-mac")).toContain("x-mac");
});

it("says which inbox the one-off emails are copied to", () => {
  expect(staffCopy.allLetters.intro("policy@example.org")).toContain("policy@example.org");
});

describe("the words of messages to supporters", () => {
  const copy = staffCopy.broadcastPages;

  it("count one and many, by channel", () => {
    for (const n of [1, 2]) {
      for (const channel of ["email", "text"] as const) {
        const said = [
          copy.summary(n, channel, "PauseAI UK", null),
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
