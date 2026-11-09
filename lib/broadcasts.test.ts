import { describe, expect, it, vi } from "vitest";
import { staffCopy } from "./content/staff-interface";
import { EMPTY_MAILING_DOC, type MailingDoc } from "./mailing-doc";
import {
  fakeRecipient,
  approvalProblems,
  firstWords,
  hasWords,
  BROADCAST_START,
  hasField,
  broadcastCost,
  broadcastScheduleProblems,
  broadcastTerms,
  spacedNumber,
  textReplyUntil,
  textSender,
  textStopsAt,
  type SchedulingBroadcast,
} from "./broadcasts";

const WORDS: MailingDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };

describe("broadcastTerms", () => {
  it("takes the channel and topic from one topic answered yes, a number's being by text", () => {
    expect(broadcastTerms("email:pauseai-updates:yes")).toEqual({ channel: "email", topic: "pauseai-updates" });
    expect(broadcastTerms(["phone:luma-calendar:yes"])).toEqual({ channel: "text", topic: "luma-calendar" });
  });

  it("ignores what the filter leaves out", () => {
    expect(broadcastTerms(["email:site-forms:yes", "!email:luma-calendar:yes"])).toEqual({
      channel: "email",
      topic: "site-forms",
    });
  });

  it("gives none without one topic answered yes, as not sure isn't enough", () => {
    expect(broadcastTerms(undefined)).toBeUndefined();
    expect(broadcastTerms("nonsense")).toBeUndefined();
    expect(broadcastTerms("email:pauseai-updates:unsure")).toBeUndefined();
    expect(broadcastTerms("email:pauseai-updates")).toBeUndefined();
    expect(broadcastTerms(["email:site-forms:yes", "email:luma-calendar:yes"])).toBeUndefined();
  });
});

describe("the fixed limits", () => {
  it("stops a text three days after its time", () => {
    expect(textStopsAt(new Date("2026-11-12T09:18:00.000Z"))).toEqual(new Date("2026-11-15T09:18:00.000Z"));
  });

  it("keeps a reply free for a day after their last message, and none before they've written", () => {
    expect(textReplyUntil(new Date("2026-11-07T08:52:00.000Z"))).toEqual(new Date("2026-11-08T08:52:00.000Z"));
    expect(textReplyUntil(null)).toBeNull();
  });
});

it("says what messages cost, by channel", () => {
  const cost = staffCopy.broadcastPages.cost;
  expect(broadcastCost("email", 400)).toEqual({ about: cost.email("0.50") });
  expect(broadcastCost("text", 100)).toEqual({ about: cost.text("4.58"), rate: cost.textRate(4.58, "1 Oct 2026") });
});

describe("a text's sender", () => {
  it("spaces a UK number in its groups, London's apart, and leaves any other as it is", () => {
    expect(spacedNumber("+447700900000")).toBe("+44 7700 900000");
    expect(spacedNumber("+442079460000")).toBe("+44 20 7946 0000");
    expect(spacedNumber("+15555550100")).toBe("+15555550100");
    expect(spacedNumber("+44770090000")).toBe("+44770090000");
  });

  it("is the name, then the number in brackets", () => {
    expect(textSender("PauseAI UK", "+447700900000")).toBe("PauseAI UK (+44 7700 900000)");
  });
});

it("names the condition for having a field", () => {
  expect(hasField("mp")).toBe("has:mp");
});

describe("firstWords", () => {
  const doc = (text: string): MailingDoc => ({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hi " },
          { type: "field", attrs: { field: "firstName" } },
          { type: "hardBreak" },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "field", attrs: { field: "other" } },
          { type: "text", text },
        ],
      },
    ],
  });

  it("says a field by its label, or its ID with none, each paragraph after the last", () => {
    expect(firstWords(doc(" there"), { firstName: "first name" })).toBe("Hi {first name} {other} there");
  });

  it("stops at a length, saying there's more", () => {
    const words = firstWords(doc(` ${"word ".repeat(40)}`), {});
    expect(words.length).toBeLessThanOrEqual(81);
    expect(words.endsWith("…")).toBe(true);
  });
});

describe("hasWords", () => {
  const none = { subject: "", body: EMPTY_MAILING_DOC, templateId: null };

  it("is a subject, a template, or words that aren't a new email's start", () => {
    expect(hasWords(none)).toBe(false);
    expect(hasWords({ ...none, body: BROADCAST_START })).toBe(false);
    expect(hasWords({ ...none, subject: " " })).toBe(false);
    expect(hasWords({ ...none, subject: "Events" })).toBe(true);
    expect(hasWords({ ...none, templateId: 1 })).toBe(true);
    expect(
      hasWords({
        ...none,
        body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }] },
      }),
    ).toBe(true);
  });
});

describe("fakeRecipient", () => {
  it("is someone made up, with each field met theirs and each other the fallback, an address for the channel", () => {
    const one = fakeRecipient(["has:firstName", "volunteer:yes"], "email");
    expect(one).toMatchObject({
      name: "Jane Smith",
      address: "jane.smith@example.com",
      meets: ["has:firstName", "volunteer:yes"],
    });
    expect(one.values).toEqual({
      firstName: "Jane",
      name: staffCopy.broadcastPages.fallbacks.name,
      mp: staffCopy.broadcastPages.fallbacks.mp,
    });
    expect(fakeRecipient([], "text").address).toBe("+447700900123");
  });
});

describe("broadcastScheduleProblems", () => {
  const good: SchedulingBroadcast = {
    channel: "email",
    subject: "Hello",
    title: "Hello",
    body: WORDS,
    dueAt: new Date("2099-01-01T09:18:00Z"),
    recipients: 3,
    unknown: [],
    byGmail: false,
    connected: false,
    approved: true,
    numbered: true,
    sends: true,
  };

  it("finds nothing wrong with one ready to go, even with no Gmail connected", () => {
    expect(broadcastScheduleProblems(good)).toEqual([]);
  });

  it("says everything that stops an email", () => {
    expect(
      broadcastScheduleProblems({
        ...good,
        subject: " ",
        body: EMPTY_MAILING_DOC,
        dueAt: null,
        recipients: 0,
        unknown: ["event=gone"],
        sends: false,
      }),
    ).toEqual(["unknown-filter", "no-recipients", "no-subject", "no-letter", "no-time", "cannot-send"]);
  });

  it("wants a text to have a template and no subject", () => {
    expect(broadcastScheduleProblems({ ...good, channel: "text", subject: "" })).toEqual([]);
    expect(broadcastScheduleProblems({ ...good, channel: "text", subject: "", body: EMPTY_MAILING_DOC })).toEqual([
      "no-template",
    ]);
  });

  it("lets words go for approval with nothing stopping them but the approval and the time", () => {
    expect(approvalProblems(["not-approved", "no-time", "time-passed"])).toEqual([]);
    expect(approvalProblems(["no-recipients", "not-approved", "no-number"])).toEqual(["no-recipients", "no-number"]);
  });

  it("wants new words for a text named, as they're a template's", () => {
    expect(broadcastScheduleProblems({ ...good, channel: "text", approved: false, title: " " })).toEqual([
      "no-name",
      "not-approved",
    ]);
    expect(broadcastScheduleProblems({ ...good, channel: "text", title: "" })).toEqual([]);
  });

  it("wants a text's words approved by WhatsApp, but not an email's, said after all but the time", () => {
    expect(broadcastScheduleProblems({ ...good, channel: "text", approved: false })).toEqual(["not-approved"]);
    expect(
      broadcastScheduleProblems({
        ...good,
        channel: "text",
        approved: false,
        numbered: false,
        recipients: 0,
        dueAt: null,
      }),
    ).toEqual(["no-recipients", "no-number", "not-approved", "no-time"]);
    expect(broadcastScheduleProblems({ ...good, approved: false })).toEqual([]);
  });

  it("wants a WhatsApp number for a text to come from, but not for an email", () => {
    expect(broadcastScheduleProblems({ ...good, channel: "text", numbered: false })).toEqual(["no-number"]);
    expect(broadcastScheduleProblems({ ...good, numbered: false })).toEqual([]);
  });

  it("holds a Gmail to being connected, but not to its daily limit, as the rest go the next day", () => {
    expect(broadcastScheduleProblems({ ...good, byGmail: true, recipients: 5000 })).toEqual(["not-connected"]);
    expect(broadcastScheduleProblems({ ...good, byGmail: true, connected: true, recipients: 5000 })).toEqual([]);
    expect(broadcastScheduleProblems({ ...good, byGmail: true, connected: true })).toEqual([]);
  });

  it("won't send into the past", () => {
    vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
    expect(broadcastScheduleProblems({ ...good, dueAt: new Date("2026-11-05T11:00:00Z") })).toEqual(["time-passed"]);
    vi.useRealTimers();
  });
});
