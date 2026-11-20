import { describe, expect, it } from "vitest";
import type { MailingSummary } from "./records.server";
import { mailingGroups, mailingWhen } from "./groups";
import { mailingsCopy } from "./copy";

const base: MailingSummary = {
  id: 0,
  title: "",
  ask: null,
  askTitle: null,
  askKind: null,
  importedText: null,
  importedSubject: "",
  importedTextApproximate: false,
  imported: false,
  state: "sent",
  createdBy: null,
  fromName: null,
  sentFrom: null,
  dueAt: null,
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  to: 1,
  sentAt: null,
  sent: 1,
  failed: 0,
  answered: 0,
  states: { sent: 1, replied: 0, answered: 0, spam: 0, error: 0, unreached: 0, "not-sent": 0 },
};
const one = (id: number, more: Partial<MailingSummary>): MailingSummary => ({ ...base, id, ...more });
const ids = (mailings: MailingSummary[]) => mailings.map((m) => m.id);

describe("mailingWhen", () => {
  it("is when its first letter went, or else when it was due, or last changed", () => {
    const sent = new Date("2026-10-01T09:00:00Z");
    const due = new Date("2026-09-01T09:00:00Z");
    expect(mailingWhen(one(1, { sentAt: sent, dueAt: due }))).toBe(sent);
    expect(mailingWhen(one(1, { dueAt: due }))).toBe(due);
    expect(mailingWhen(one(1, {}))).toBe(base.updatedAt);
  });
});

describe("mailingGroups", () => {
  const now = new Date("2026-10-30T12:00:00Z");

  it("puts each group in the order given: Scheduled, Sending, Drafts, Just finished; then each month of the last year, then each year", () => {
    const groups = mailingGroups(
      {
        scheduled: [one(1, { state: "scheduled" })],
        sending: [one(2, { state: "sending" })],
        drafts: [one(3, { state: "draft" })],
        done: [
          // Started sending a day ago to the minute, so just finished; a moment longer, and it isn't.
          one(9, { sentAt: new Date("2026-10-29T12:00:00Z") }),
          one(10, { sentAt: new Date("2026-10-30T11:00:00Z"), state: "cancelled" }),
          one(5, { sentAt: new Date("2026-10-29T11:59:59Z") }),
          one(4, { sentAt: new Date("2026-10-01T09:00:00Z") }),
          one(6, { sentAt: new Date("2025-11-01T00:00:00Z") }),
          one(7, { sentAt: new Date("2025-10-31T23:00:00Z") }),
          // Stopped before any went: never just finished, under when it was due.
          one(8, { state: "cancelled", dueAt: new Date("2024-03-01T00:00:00Z") }),
        ],
      },
      now,
    );
    const words = mailingsCopy.mailingPages;
    expect(groups.map((g) => [g.key, g.heading, ids(g.mailings)])).toEqual([
      ["scheduled", words.scheduled, [1]],
      ["sending", words.sending, [2]],
      ["drafts", words.drafts, [3]],
      ["just-finished", words.justFinished, [9, 10]],
      ["2026-10", "October 2026", [5, 4]],
      ["2025-11", "November 2025", [6]],
      ["2025", "2025", [7]],
      ["2024", "2024", [8]],
    ]);
  });

  it("leaves out each group with none in it, and has nothing for none", () => {
    expect(mailingGroups({ scheduled: [], sending: [], drafts: [], done: [] }, now)).toEqual([]);
    expect(
      mailingGroups(
        { scheduled: [], sending: [], drafts: [], done: [one(1, { sentAt: new Date("2026-10-01T00:00:00Z") })] },
        now,
      ).map((g) => g.key),
    ).toEqual(["2026-10"]);
  });
});
