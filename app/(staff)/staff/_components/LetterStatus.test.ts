import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { staffCopy } from "@/lib/content/staff-interface";
import { letterStatus, statusOf } from "./LetterStatus";

const schema = readFileSync(path.resolve(import.meta.dirname, "../../../../netlify/database/schema.sql"), "utf8");

/** Every value a CHECK constraint in the schema allows, by the constraint's name. */
function allowed(constraint: string): string[] {
  const line = schema.split("\n").find((one) => one.includes(`CONSTRAINT ${constraint} CHECK`));
  return [...line!.matchAll(/'([^']+)'::text/g)].map((m) => m[1]!).filter((v) => v !== "pauseai" && v !== "supporter");
}

describe("letterStatus", () => {
  it("gives every status the database allows its words and colour", () => {
    const statuses = [...new Set(allowed("letters_status_check"))].sort();
    expect(Object.fromEntries(statuses.map((status) => [status, letterStatus({ status })]))).toEqual({
      bounced: { words: "Bounced", tone: "red" },
      cancelled: { words: "Cancelled: we stopped the mailing", tone: "amber" },
      not_sent: { words: "Not sent", tone: "red" },
      queued: { words: "Queued", tone: undefined },
      scheduled: { words: "Scheduled", tone: "blue" },
      sending: { words: "Sending", tone: "blue" },
      sent: { words: "Sent", tone: undefined },
      skipped: { words: "Skipped", tone: "red" },
      spam_complaint: { words: "Spam complaint", tone: "red" },
      uncertain: { words: "Uncertain", tone: "red" },
    });
  });

  it("gives every skip reason the database allows its words, in red", () => {
    const reasons = allowed("letters_from_pauseai_skip_reason_check");
    expect(reasons).toEqual(["blocked", "left-office", "no-email"]);
    for (const reason of reasons) {
      const { words, tone } = letterStatus({ status: "skipped", skipReason: reason as "blocked" });
      expect(words).toBe(staffCopy.mailingPages.skipReasons[reason]);
      expect(words).toMatch(/^Skipped: /);
      expect(tone).toBe("red");
    }
  });

  it("says a status nobody knows as it's stored, in grey", () => {
    expect(letterStatus({ status: "mislaid", skipReason: null })).toEqual({ words: "mislaid", tone: undefined });
    expect(statusOf("replied")).toBe(staffCopy.letters.status.replied);
  });
});
