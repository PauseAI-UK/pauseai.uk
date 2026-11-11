import { describe, expect, it, vi } from "vitest";
import { staffCopy } from "./content/staff-interface";
import { EMPTY_MAILING_DOC, type MailingDoc } from "./mailing-doc";
import {
  fakeRecipient,
  firstNameOf,
  approvalProblems,
  firstWords,
  hasWords,
  BROADCAST_START,
  hasField,
  textCost,
  broadcastScheduleProblems,
  broadcastTerms,
  textSender,
  type SchedulingBroadcast,
} from "./broadcasts";

describe("firstNameOf", () => {
  it.each([
    ["Jane Smith", "Jane"],
    ["Jane", "Jane"],
    ["  Jane   Smith  ", "Jane"],
    ["Jane\tSmith", "Jane"],
    ["Mary Ann Smith", "Mary"],
    ["Jane-Marie Smith", "Jane-Marie"],
    ["Zoë Brown", "Zoë"],
    ["Siân Jones", "Siân"],
    ["José García", "José"],
    ["O'Neill", "O'Neill"],
    ["Jo", "Jo"],
  ])("takes the first word of %j: %j", (name, first) => {
    expect(firstNameOf(name)).toBe(first);
  });

  it.each([
    ["jane smith", "Jane"],
    ["JANE SMITH", "Jane"],
    ["jane", "Jane"],
    ["JANE", "Jane"],
    ["jean-luc picard", "Jean-Luc"],
    ["JEAN-LUC PICARD", "Jean-Luc"],
    ["d'arcy", "D'Arcy"],
    ["d’arcy", "D’Arcy"],
    ["zoë", "Zoë"],
    ["ÉLODIE MARTIN", "Élodie"],
    ["jo SMITH", "Jo"],
  ])("writes a first name typed all in one case as names are written: %j is %j", (name, first) => {
    expect(firstNameOf(name)).toBe(first);
  });

  it.each([
    ["McKenzie Smith", "McKenzie"],
    ["DeShawn Jones", "DeShawn"],
    ["JoAnne Smith", "JoAnne"],
    ["jANE Smith", "jANE"],
  ])("keeps one typed in mixed case as it is: %j is %j", (name, first) => {
    expect(firstNameOf(name)).toBe(first);
  });

  it.each([
    "Mr Smith",
    "Mrs Jane Smith",
    "Ms Smith",
    "Miss Jane Smith",
    "Mx Sam Smith",
    "Dr Jane Smith",
    "Dr. Jane Smith",
    "DR JANE SMITH",
    "dr jane smith",
    "Prof Jane Smith",
    "Prof. Smith",
    "Professor Jane Smith",
    "Sir Keir Example",
    "Rev Jane Smith",
    "Revd Jane Smith",
    "Reverend Jane Smith",
    "Lord Example",
    "Lady Jane Example",
    "Dame Jane Example",
    "Cllr Jane Smith",
    "Councillor Jane Smith",
  ])("has none when the name starts with a title: %j", (name) => {
    expect(firstNameOf(name)).toBeUndefined();
  });

  it.each(["J Smith", "J. Smith", "j smith", "J.R. Smith", "J.R Smith", "j.r. smith", "J", "É. Martin"])(
    "has none when the name starts with initials: %j",
    (name) => {
      expect(firstNameOf(name)).toBeUndefined();
    },
  );

  it.each(["jane.smith@example.com", "Jane Smith jane@example.com", "jane_smith", "Jane Smith 2", "jsmith1984"])(
    "has none when the name looks like an address or a username: %j",
    (name) => {
      expect(firstNameOf(name)).toBeUndefined();
    },
  );

  it.each([null, undefined, "", "   ", "\t"])("has none with no name: %j", (name) => {
    expect(firstNameOf(name)).toBeUndefined();
  });

  it.each(["AB Smith", "AB", "XY", "CD", "QR Smith", "PP Smith"])(
    "has none when the first word is two capitals, initials without full stops: %j",
    (name) => {
      expect(firstNameOf(name)).toBeUndefined();
    },
  );

  it.each(["bd", "xz Smith", "pq", "Gh Smith", "Kv"])(
    "has none when the first word is two letters with no vowel, initials too: %j",
    (name) => {
      expect(firstNameOf(name)).toBeUndefined();
    },
  );

  it.each([
    ["Al Smith", "Al"],
    ["Ed", "Ed"],
    ["Em", "Em"],
    ["mo", "Mo"],
    ["Jo Smith", "Jo"],
    ["Ty Smith", "Ty"],
  ])("keeps a two-letter first name with a vowel, typed as a name: %j is %j", (name, first) => {
    expect(firstNameOf(name)).toBe(first);
  });

  it.each(["-", "--- Smith", "!!!", ". Smith", "’"])("has none when the first word has no letter: %j", (name) => {
    expect(firstNameOf(name)).toBeUndefined();
  });

  it.each(["Jane(Sam)", "Jane! Smith", "Jane/Sam Smith", "★Jane", "Jane, Smith", "Jane&Sam"])(
    "has none when the first word has anything but letters, hyphens, apostrophes and full stops: %j",
    (name) => {
      expect(firstNameOf(name)).toBeUndefined();
    },
  );

  it.each(["JaneTheGreat", "PauseAIExampleTown", "JaneSmith", "McKenzie", "jANE"])(
    "has none for one word with a capital after a small letter inside it, as a username has: %j",
    (name) => {
      expect(firstNameOf(name)).toBeUndefined();
    },
  );

  it.each([
    ["O'Neill", "O'Neill"],
    ["Jean-Luc", "Jean-Luc"],
    ["D’Arcy", "D’Arcy"],
    ["Janesmith", "Janesmith"],
  ])("keeps one word whose capitals come after a hyphen or an apostrophe: %j is %j", (name, first) => {
    expect(firstNameOf(name)).toBe(first);
  });

  it.each([
    "The Smiths",
    "the smiths",
    "London Example Events",
    "Example Club",
    "PauseAI London",
    "Example Ltd",
    "Example Limited",
    "Example Inc",
    "Leeds Group",
    "Outreach Team",
    "Example Society",
    "Example Network",
    "Example Association",
    "Example Committee",
    "Example Foundation",
    "Example Institute",
    "Example University",
  ])("has none for an organisation's or a household's name: %j", (name) => {
    expect(firstNameOf(name)).toBeUndefined();
  });

  it.each([
    ["Theo Smith", "Theo"],
    ["Theresa Clubb", "Theresa"],
    ["Jane Teams", "Jane"],
    ["Jane Grouper", "Jane"],
  ])("doesn't take a name for an organisation's for having one in part: %j is %j", (name, first) => {
    expect(firstNameOf(name)).toBe(first);
  });

  it.each([
    ["梁宇震", "梁宇震"],
    ["Νίκος Παππάς", "Νίκος"],
    ["ΝΊΚΟΣ ΠΑΠΠΆΣ", "Νίκος"],
    ["Åsa Lindqvist", "Åsa"],
  ])("takes names in other scripts as they come, or with their case written as names: %j is %j", (name, first) => {
    expect(firstNameOf(name)).toBe(first);
  });

  it("doesn't take a name that only starts like a title or an initial for one", () => {
    expect(firstNameOf("Drew Smith")).toBe("Drew");
    expect(firstNameOf("Missy Smith")).toBe("Missy");
    expect(firstNameOf("Sirius Black")).toBe("Sirius");
    expect(firstNameOf("Lorde")).toBe("Lorde");
    expect(firstNameOf("Jo. Smith")).toBe("Jo.");
  });
});

const WORDS: MailingDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };

describe("broadcastTerms", () => {
  it("takes the channel and topic from one topic answered yes, a number's being by text", () => {
    expect(broadcastTerms("email:newsletter:yes")).toEqual({ channel: "email", topic: "newsletter" });
    expect(broadcastTerms(["text:events:yes"])).toEqual({ channel: "text", topic: "events" });
  });

  it("ignores what the filter leaves out", () => {
    expect(broadcastTerms(["email:newsletter:yes", "!email:events:yes"])).toEqual({
      channel: "email",
      topic: "newsletter",
    });
  });

  it("gives none without one topic answered yes, as not sure isn't enough", () => {
    expect(broadcastTerms(undefined)).toBeUndefined();
    expect(broadcastTerms("nonsense")).toBeUndefined();
    expect(broadcastTerms("email:newsletter:unsure")).toBeUndefined();
    expect(broadcastTerms("email:newsletter")).toBeUndefined();
    expect(broadcastTerms(["email:newsletter:yes", "email:events:yes"])).toBeUndefined();
  });
});

it("says what texts cost, and at what rate", () => {
  const cost = staffCopy.broadcastPages.cost;
  expect(textCost(100)).toEqual({ about: cost.text("4.58"), rate: cost.textRate(4.58, "1 Oct 2026") });
});

describe("a text's sender", () => {
  it("is the name, then the number in brackets", () => {
    expect(textSender("PauseAI UK", "+447700900000")).toBe("PauseAI UK (07700 900000)");
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
    const one = fakeRecipient(["has:firstName", "wrote:regulate-letter-pm"], "email");
    expect(one).toMatchObject({
      name: "Jane Smith",
      address: "jane.smith@example.com",
      meets: ["has:firstName", "wrote:regulate-letter-pm"],
    });
    expect(one.values).toEqual({
      firstName: "Jane",
      name: staffCopy.broadcastPages.fallbacks.name,
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
