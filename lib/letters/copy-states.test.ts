import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DIDNT_GO, LETTER_STATES, letterState, STATE_TONES } from "./copy-states";
import { lettersCopy } from "./copy";

const schema = readFileSync(path.resolve(import.meta.dirname, "../../netlify/database/schema.sql"), "utf8");

/** Every value a CHECK constraint in the schema allows, by the constraint's name. */
function allowed(constraint: string): string[] {
  const line = schema.split("\n").find((one) => one.includes(`CONSTRAINT ${constraint} CHECK`));
  return [...line!.matchAll(/'([^']+)'::text/g)].map((m) => m[1]!).filter((v) => v !== "pauseai" && v !== "supporter");
}

const plain = { answered: false, replied: false };

describe("letterState", () => {
  it("puts every status the database allows in a state, with why where it has one", () => {
    const statuses = [...new Set(allowed("letters_status_check"))].sort();
    expect(Object.fromEntries(statuses.map((status) => [status, letterState({ status, ...plain })]))).toEqual({
      bounced: { state: "unreached", why: "bounced" },
      cancelled: { state: "not-sent", why: "cancelled" },
      not_sent: { state: "error", why: null },
      queued: { state: "queued", why: null },
      scheduled: { state: "scheduled", why: null },
      sending: { state: "sending", why: null },
      sent: { state: "sent", why: null },
      skipped: { state: "not-sent", why: null },
      spam_complaint: { state: "spam", why: null },
      uncertain: { state: "error", why: "unfinished" },
    });
  });

  it("says one sent that only an automatic reply came back to, but not one replied to as well", () => {
    expect(letterState({ status: "sent", autoReplied: true, ...plain })).toEqual({ state: "sent", why: "auto-reply" });
    expect(letterState({ status: "sent", answered: false, replied: true, autoReplied: true }).state).toBe("replied");
  });

  it("says what refused one that failed, where that's known", () => {
    expect(letterState({ status: "not_sent", sentBy: "gmail", ...plain })).toEqual({ state: "error", why: "gmail" });
    expect(letterState({ status: "not_sent", sentBy: null, ...plain })).toEqual({ state: "error", why: null });
  });

  it("says why one was skipped, for every reason the database allows, as a tag", () => {
    const reasons = allowed("letters_from_pauseai_skip_reason_check");
    expect(reasons).toEqual(["blocked", "left-office", "no-email"]);
    for (const reason of reasons) {
      const { state, why } = letterState({ status: "skipped", skipReason: reason as "blocked", ...plain });
      expect(state).toBe("not-sent");
      expect(lettersCopy.copyStates.tags[`${state}:${why}`]).toMatch(/^Not sent: /);
    }
  });

  it("puts an answer before a reply, and both after anything that didn't go", () => {
    expect(letterState({ status: "sent", answered: true, replied: true }).state).toBe("answered");
    expect(letterState({ status: "sent", answered: false, replied: true }).state).toBe("replied");
    expect(letterState({ status: "bounced", answered: true, replied: true }).state).toBe("unreached");
    expect(letterState({ status: "spam_complaint", answered: true, replied: false }).state).toBe("spam");
  });
});

describe("the states", () => {
  it("has a count and a tab for each of a letter's states, and a tag for each state it can have without a why", () => {
    for (const state of LETTER_STATES) {
      expect(lettersCopy.copyStates.counts[state]).toBeDefined();
      expect(lettersCopy.copyStates.tabs[state]).toBeDefined();
    }
    // A letter that didn't reach them always bounced, so has its why.
    for (const state of LETTER_STATES.filter((one) => one !== "unreached")) {
      expect(lettersCopy.copyStates.tags[state]).toBeDefined();
    }
  });

  it("colours what didn't go red or amber, but not sent, which is expected", () => {
    expect([...DIDNT_GO].map((state) => STATE_TONES[state])).toEqual(["red", "amber", undefined]);
  });
});
