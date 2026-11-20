import { describe, expect, it, vi } from "vitest";
import { daysInWords, SENDING_DAYS } from "./days";
import { EMPTY_MAILING_DOC, type MailingDoc, type MailingInline } from "@/lib/mailings/doc";
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
  misplacedFields,
  sameWords,
  rejectionWords,
  broadcastTerms,
  isAvailableSendBy,
  sendingDays,
  sendingPause,
  sendingStopsAt,
  finishFits,
  finishMinutesOf,
  finishWithin,
  MOST_FINISH_MINUTES,
  textSender,
  waitEndsAt,
  type SchedulingBroadcast,
} from "./broadcasts";
import { broadcastsCopy } from "./copy";

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
  it("takes the channel and topics from topics answered yes by one way, a number's being by text", () => {
    expect(broadcastTerms("email:newsletter:yes")).toEqual({ channel: "email", topics: ["newsletter"] });
    expect(broadcastTerms(["text:events:yes"])).toEqual({ channel: "text", topics: ["events"] });
    // Any of them, by one channel, in TOPICS' order whatever the filter's.
    expect(broadcastTerms(["email:volunteering:yes", "email:newsletter:yes", "email:events:yes"])).toEqual({
      channel: "email",
      topics: ["newsletter", "events", "volunteering"],
    });
  });

  it("ignores what the filter leaves out", () => {
    expect(broadcastTerms(["email:newsletter:yes", "!email:events:yes"])).toEqual({
      channel: "email",
      topics: ["newsletter"],
    });
  });

  it("gives none without topics answered yes by one way, as not sure isn't enough, nor calls", () => {
    expect(broadcastTerms(undefined)).toBeUndefined();
    expect(broadcastTerms("nonsense")).toBeUndefined();
    expect(broadcastTerms("email:newsletter:unsure")).toBeUndefined();
    expect(broadcastTerms("email:newsletter")).toBeUndefined();
    expect(broadcastTerms(["email:newsletter:yes", "text:events:yes"])).toBeUndefined();
    expect(broadcastTerms(["email:newsletter:yes", "email:events:unsubscribed"])).toBeUndefined();
    expect(broadcastTerms("call:volunteering:yes")).toBeUndefined();
  });
});

it("says what texts cost, and at what rate", () => {
  const cost = broadcastsCopy.broadcastPages.cost;
  expect(textCost(100)).toEqual({ about: cost.text("4.58"), rate: cost.textRate(4.58, "1 Oct 2026") });
});

describe("a text's sender", () => {
  it("is the name, then the number, a dot between", () => {
    expect(textSender("PauseAI UK", "+447700900000")).toBe("PauseAI UK · 07700 900000");
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
      name: broadcastsCopy.broadcastPages.fallbacks.name,
    });
    expect(fakeRecipient([], "text").address).toBe("+447700900123");
  });
});

describe("daysInWords", () => {
  it("says a number of days in words, but a large one in figures", () => {
    expect(daysInWords(1)).toBe("one day");
    expect(daysInWords(7)).toBe("seven days");
    expect(daysInWords(12)).toBe("12 days");
  });
});

describe("sendingDays", () => {
  it("is one day while what's left today is enough, then one more for each day's limit after", () => {
    expect(sendingDays(1800, 1800, 1800)).toBe(1);
    expect(sendingDays(1801, 1800, 1800)).toBe(2);
    expect(sendingDays(10, 0, 1800)).toBe(2);
    expect(sendingDays(3600, 0, 1800)).toBe(3);
    expect(sendingDays(3601, 0, 1800)).toBe(4);
    expect(sendingDays(250, 100, 50)).toBe(4);
    expect(sendingDays(1_000_000, null, null)).toBe(1);
    expect(sendingDays(1_000_000, 0, null)).toBe(1);
  });
});

describe("sendingPause", () => {
  const dueAt = new Date("2026-11-07T07:18:00Z");
  const timed = { dueAt, finishMinutes: null };
  const going = {
    state: "sending",
    channel: "text" as const,
    dueAt,
    finishMinutes: null as number | null,
    waitingSince: null,
    waitReason: null,
    waitSaid: null,
    restingUntil: null,
    toGo: 3,
    held: 0,
    heldTill: null,
    atLimit: false,
  };

  it("is none for one going out, or one not scheduled or sending, whatever else is so", () => {
    expect(sendingPause(going)).toBeNull();
    const since = new Date("2026-11-08T07:18:00Z");
    for (const state of ["draft", "sent", "cancelled"]) {
      expect(sendingPause({ ...going, state, waitingSince: since, restingUntil: since, atLimit: true })).toBeNull();
    }
  });

  it("is waiting for CiviCRM first, for one scheduled or sending, till the wait ends", () => {
    const since = new Date("2026-11-08T07:18:00Z");
    const waiting = { ...going, waitingSince: since, waitSaid: "Down", restingUntil: since, atLimit: true };
    expect(sendingPause({ ...waiting, waitReason: "civicrm" })).toEqual({
      kind: "waiting",
      reason: "civicrm",
      said: "Down",
      endsAt: waitEndsAt(since, timed),
    });
    expect(sendingPause({ ...waiting, state: "scheduled", waitReason: "pull" })).toEqual({
      kind: "waiting",
      reason: "pull",
      said: "Down",
      endsAt: waitEndsAt(since, timed),
    });
  });

  it("is waiting for WhatsApp's approval, past its time, till it stops trying", () => {
    const since = new Date("2026-11-07T07:33:00Z");
    const waiting = { ...going, state: "scheduled", waitingSince: since, waitReason: "approval", finishMinutes: 600 };
    expect(sendingPause(waiting)).toEqual({
      kind: "waiting",
      reason: "approval",
      said: null,
      endsAt: new Date("2026-11-07T17:18:00Z"),
    });
  });

  it("is nothing else for one scheduled", () => {
    const until = new Date("2026-11-08T07:43:00Z");
    expect(sendingPause({ ...going, state: "scheduled", restingUntil: until, toGo: 0, heldTill: until })).toBeNull();
    expect(sendingPause({ ...going, state: "scheduled", atLimit: true })).toBeNull();
    // One sending with no time, which none has, is none either.
    expect(sendingPause({ ...going, dueAt: null, atLimit: true })).toBeNull();
  });

  it("is resting, then held, then at its limit", () => {
    const until = new Date("2026-11-08T07:43:00Z");
    const heldTill = new Date("2026-11-09T10:07:00Z");
    const all = { ...going, restingUntil: until, toGo: 0, held: 2, heldTill, atLimit: true };
    expect(sendingPause(all)).toEqual({ kind: "resting", until });
    expect(sendingPause({ ...all, restingUntil: null })).toEqual({
      kind: "held",
      held: 2,
      until: heldTill,
      stopsAt: sendingStopsAt(timed),
    });
    // With any that can go now, the held ones don't pause it.
    expect(sendingPause({ ...all, restingUntil: null, toGo: 1 })).toEqual({ kind: "limit", channel: "text" });
    expect(sendingPause({ ...all, restingUntil: null, heldTill: null })).toEqual({ kind: "limit", channel: "text" });
    expect(sendingPause({ ...all, restingUntil: null, toGo: 1, atLimit: false })).toBeNull();
  });

  it("is delayed for one sent with emails delayed, till its days run out, and only that", () => {
    const sent = { ...going, state: "sent", channel: "email" as const, toGo: 0, held: 45, atLimit: true };
    expect(sendingPause(sent)).toEqual({ kind: "delayed", delayed: 45, stopsAt: sendingStopsAt(timed) });
    // None delayed, it's done.
    expect(sendingPause({ ...sent, held: 0 })).toBeNull();
    // One sent with no time, which none has, is none either.
    expect(sendingPause({ ...sent, dueAt: null })).toBeNull();
    // Stopped, it waits on nothing.
    expect(sendingPause({ ...sent, state: "cancelled" })).toBeNull();
  });
});

describe("a broadcast's finish", () => {
  const dueAt = new Date("2026-11-07T07:18:00Z");
  const at = (iso: string) => new Date(iso);

  it("is seven days after its time, or the minutes after it it keeps", () => {
    expect(sendingStopsAt({ dueAt, finishMinutes: null })).toEqual(at("2026-11-14T07:18:00Z"));
    expect(sendingStopsAt({ dueAt, finishMinutes: 90 })).toEqual(at("2026-11-07T08:48:00Z"));
  });

  it("is kept as minutes after its time, none for the most", () => {
    expect(finishMinutesOf(dueAt, at("2026-11-07T08:48:00Z"))).toBe(90);
    expect(finishMinutesOf(dueAt, at("2026-11-14T07:18:00Z"))).toBeNull();
  });

  it("fits after its time, seven days after at most", () => {
    expect(finishFits(null)).toBe(true);
    expect(finishFits(1)).toBe(true);
    expect(finishFits(MOST_FINISH_MINUTES)).toBe(true);
    expect(finishFits(0)).toBe(false);
    expect(finishFits(MOST_FINISH_MINUTES + 1)).toBe(false);
  });

  it("is kept, as picked, from the sending's next run after its time to seven days after it", () => {
    expect(finishWithin(dueAt, at("2026-11-08T12:03:00Z"))).toEqual(at("2026-11-08T12:03:00Z"));
    expect(finishWithin(dueAt, at("2026-11-01T12:03:00Z"))).toEqual(at("2026-11-07T07:33:00Z"));
    expect(finishWithin(dueAt, at("2026-11-20T12:03:00Z"))).toEqual(at("2026-11-14T07:18:00Z"));
  });

  it("ends a wait for CiviCRM at the finish, if that's sooner", () => {
    const since = at("2026-11-07T08:18:00Z");
    expect(waitEndsAt(since, { dueAt, finishMinutes: null })).toEqual(at("2026-11-10T08:18:00Z"));
    expect(waitEndsAt(since, { dueAt, finishMinutes: 24 * 60 })).toEqual(at("2026-11-08T07:18:00Z"));
  });
});

describe("isAvailableSendBy", () => {
  it("is so of Postmark and Gmail, but nothing else", () => {
    expect(isAvailableSendBy("gmail")).toBe(true);
    expect(isAvailableSendBy("postmark")).toBe(true);
    expect(isAvailableSendBy("pigeon")).toBe(false);
    expect(isAvailableSendBy(null)).toBe(false);
  });
});

describe("broadcastScheduleProblems", () => {
  const good: SchedulingBroadcast = {
    channel: "email",
    subject: "Hello",
    title: "Hello",
    body: WORDS,
    dueAt: new Date("2099-01-01T09:18:00Z"),
    finishMinutes: null,
    recipients: 3,
    unknown: [],
    byGmail: false,
    connected: false,
    remaining: null,
    daily: null,
    approved: true,
    sameWords: false,
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

  it("lets words go for approval with nothing stopping them but the time", () => {
    expect(approvalProblems(["no-time", "time-passed"])).toEqual([]);
    expect(approvalProblems(["no-recipients", "no-time", "no-number"])).toEqual(["no-recipients", "no-number"]);
  });

  it("wants new words for a text named, as they're a template's", () => {
    expect(broadcastScheduleProblems({ ...good, channel: "text", approved: false, title: " " })).toEqual(["no-name"]);
    expect(broadcastScheduleProblems({ ...good, channel: "text", title: "" })).toEqual([]);
  });

  it("puts WhatsApp's code for a rejection in plain words, or gives one it doesn't know as it is", () => {
    const words = broadcastsCopy.notifications.templateRejectedWhy;
    expect(rejectionWords("INVALID_FORMAT")).toBe(words.reasons.INVALID_FORMAT);
    expect(rejectionWords("SOMETHING_NEW")).toBe(words.other("SOMETHING_NEW"));
    expect(rejectionWords(null)).toBe(words.other("NONE"));
  });

  it("won't send new words for approval with a field at the start or end, two together, or one twice, as WhatsApp rejects them", () => {
    const field = (name: string): MailingInline => ({ type: "field", attrs: { field: name } });
    const text = (words: string): MailingInline => ({ type: "text", text: words });
    const words = (...content: MailingInline[]): MailingDoc => ({
      type: "doc",
      content: [{ type: "paragraph", content }],
    });
    const problems = (body: MailingDoc, approved = false) =>
      broadcastScheduleProblems({ ...good, channel: "text", approved, body });
    expect(problems(words(text("Hi "), field("firstName"), text(", see you there.")))).toEqual([]);
    expect(problems(words(field("firstName"), text(", see you there.")))).toEqual(["field-edge"]);
    expect(problems(words(text("See you there, "), field("firstName")))).toEqual(["field-edge"]);
    expect(problems(words(text("Hi "), field("firstName"), text(" "), field("lastName"), text("!")))).toEqual([
      "fields-together",
    ]);
    expect(problems(words(field("firstName"), field("lastName")))).toEqual(["field-edge", "fields-together"]);
    expect(
      problems(words(text("Hi "), field("firstName"), text(", your name is "), field("firstName"), text("."))),
    ).toEqual(["field-twice"]);
    // Two fields, each once, aren't twice.
    expect(problems(words(text("Hi "), field("firstName"), text(", or "), field("name"), text(" in full.")))).toEqual(
      [],
    );
    // An approved template is WhatsApp's to judge, and an email takes fields anywhere.
    expect(problems(words(field("firstName"), text(" hi")), true)).toEqual([]);
    expect(broadcastScheduleProblems({ ...good, body: words(field("firstName")) })).toEqual([]);
    expect(misplacedFields(words(text("No fields here")))).toEqual({ atEdge: false, together: false, twice: false });
  });

  it("schedules a text whose words WhatsApp hasn't approved, as scheduling sends them for approval", () => {
    expect(broadcastScheduleProblems({ ...good, channel: "text", approved: false })).toEqual([]);
    expect(
      broadcastScheduleProblems({
        ...good,
        channel: "text",
        approved: false,
        numbered: false,
        recipients: 0,
        dueAt: null,
      }),
    ).toEqual(["no-recipients", "no-number", "no-time"]);
  });

  it("wants it to have time to all go before it stops trying, each part day a whole one", () => {
    // 3,600 at Gmail's limit, none left today: three days, today's the first.
    const big = { ...good, recipients: 3600, remaining: 0, daily: 1800 };
    expect(broadcastScheduleProblems(big)).toEqual([]);
    expect(broadcastScheduleProblems({ ...big, finishMinutes: 2 * 24 * 60 + 1 })).toEqual([]);
    expect(broadcastScheduleProblems({ ...big, finishMinutes: 2 * 24 * 60 })).toEqual(["too-slow"]);
  });

  it("won't send for approval new words an approved template has already, but a chosen template is fine", () => {
    expect(broadcastScheduleProblems({ ...good, channel: "text", approved: false, sameWords: true })).toEqual([
      "same-words",
    ]);
    expect(broadcastScheduleProblems({ ...good, channel: "text", sameWords: true })).toEqual([]);
  });

  it("finds new words a template has already (sameWords): the very words, fields and all, ignoring space at the ends", () => {
    const field = (name: string): MailingInline => ({ type: "field", attrs: { field: name } });
    const text = (words: string): MailingInline => ({ type: "text", text: words });
    const words = (...content: MailingInline[]): MailingDoc => ({
      type: "doc",
      content: [{ type: "paragraph", content }],
    });
    const hi = words(text("Hi "), field("firstName"), text(", see you there."));
    expect(
      sameWords(hi, [words(text("Something else")), words(text("Hi "), field("firstName"), text(", see you there. "))]),
    ).toBe(true);
    expect(sameWords(hi, [words(text("Hi "), field("name"), text(", see you there."))])).toBe(false);
    expect(sameWords(hi, [])).toBe(false);
  });

  it("wants a WhatsApp number for a text to come from, but not for an email", () => {
    expect(broadcastScheduleProblems({ ...good, channel: "text", numbered: false })).toEqual(["no-number"]);
    expect(broadcastScheduleProblems({ ...good, numbered: false })).toEqual([]);
  });

  it("holds one by Gmail to its Gmail being connected, and to all going within SENDING_DAYS at its daily limit", () => {
    const gmail = { ...good, byGmail: true, connected: true, remaining: 1000, daily: 1800 };
    expect(broadcastScheduleProblems({ ...gmail, connected: false })).toEqual(["not-connected"]);
    expect(broadcastScheduleProblems(gmail)).toEqual([]);
    // What's left today, then a day's limit each day after.
    const most = 1000 + (SENDING_DAYS - 1) * 1800;
    expect(broadcastScheduleProblems({ ...gmail, recipients: most })).toEqual([]);
    expect(broadcastScheduleProblems({ ...gmail, recipients: most + 1 })).toEqual(["too-slow"]);
    // With no limit, however many.
    expect(broadcastScheduleProblems({ ...good, recipients: 50_000 })).toEqual([]);
  });

  it("holds a text to all going within SENDING_DAYS at our WhatsApp number's daily limit", () => {
    const text = { ...good, channel: "text" as const, remaining: 100, daily: 250 };
    const most = 100 + (SENDING_DAYS - 1) * 250;
    expect(broadcastScheduleProblems({ ...text, recipients: most })).toEqual([]);
    expect(broadcastScheduleProblems({ ...text, recipients: most + 1 })).toEqual(["too-slow"]);
    // At the top tier, however many.
    expect(broadcastScheduleProblems({ ...text, remaining: null, daily: null, recipients: 50_000 })).toEqual([]);
  });

  it("won't send into the past", () => {
    vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
    expect(broadcastScheduleProblems({ ...good, dueAt: new Date("2026-11-05T11:00:00Z") })).toEqual(["time-passed"]);
    vi.useRealTimers();
  });
});
