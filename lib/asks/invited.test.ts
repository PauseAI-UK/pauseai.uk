import { expect, it } from "vitest";
import { ARRIVED, IN_FLIGHT, LETTER_STATUSES, NEVER_WENT } from "@/lib/letters/status";
import { answerSql, askingLetters, ASKING_STATUSES } from "./invited";

it("counts a letter as asking once it arrived, may have, or is on its way, never one that bounced or never went", () => {
  for (const status of ASKING_STATUSES) expect(LETTER_STATUSES).toContain(status);
  for (const status of [...ARRIVED, ...IN_FLIGHT, "uncertain", "queued"]) expect(ASKING_STATUSES).toContain(status);
  // Waiting in the queue is on its way; the rest that never went, and one that bounced, didn't reach them.
  const never = NEVER_WENT.filter((status) => status !== "queued" && status !== "scheduled");
  for (const status of [...never, "bounced"]) expect(ASKING_STATUSES).not.toContain(status);
});

it("narrows the letters that asked by what it's given, and says what isn't an answer", () => {
  expect(askingLetters("l.notable_person_id = 7")).toMatch(/AND l\.notable_person_id = 7$/);
  expect(askingLetters("true")).toContain("l.status IN ('queued', 'scheduled', 'sending', 'sent'");
  expect(answerSql("s.status")).toBe("s.status <> 'invited'");
});
