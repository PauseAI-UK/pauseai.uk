import { describe, expect, it } from "vitest";
import type { LetterSummary, PauseaiLetter, UnsignedLetter } from "@/lib/server/letters";
import type { OneOffThreadRow } from "@/lib/server/one-off-emails";
import { correspondenceThreads, hasReply, type ThreadMessages, type ThreadStep } from "./politician-correspondence";

const at = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T09:00:00.000Z`);
const step = (day: number, who: ThreadStep["who"], fields: Partial<ThreadStep> = {}): ThreadStep => ({
  at: at(day),
  who,
  name: null,
  auto: false,
  ...fields,
});
const messages = (fields: Partial<ThreadMessages> = {}): ThreadMessages => ({
  subjects: {},
  letters: {},
  oneOffs: {},
  ...fields,
});
const signed = (fields: Partial<LetterSummary> = {}) =>
  ({
    id: 1,
    campaignTitle: "Email your MP",
    status: "sent",
    senderName: "Jane Smith",
    ownWords: 0.2,
    createdAt: at(1),
    repliedAt: null,
    ...fields,
  }) as LetterSummary;
const unsigned: UnsignedLetter = {
  id: 2,
  campaign: "email-your-mp",
  campaignTitle: "Email your MP",
  status: "bounced",
  createdAt: at(2),
  repliedAt: null,
};
const pauseai: PauseaiLetter = {
  id: 3,
  mailingId: 9,
  mailing: "Example Mailing",
  status: "sent",
  at: at(3),
  personalised: false,
};
const oneOff = (fields: Partial<OneOffThreadRow> = {}) =>
  ({ id: 4, subject: "Coffee?", someoneElse: false, latestAt: at(4), ...fields }) as OneOffThreadRow;

const threads = ({
  letters = [],
  senders = true,
  pauseaiLetters = [],
  oneOffs = [],
  kept = messages(),
}: {
  letters?: (LetterSummary | UnsignedLetter)[];
  senders?: boolean;
  pauseaiLetters?: PauseaiLetter[];
  oneOffs?: OneOffThreadRow[];
  kept?: ThreadMessages;
}) =>
  correspondenceThreads({
    letters: { senders, letters } as Parameters<typeof correspondenceThreads>[0]["letters"],
    pauseaiLetters,
    oneOffs,
    messages: kept,
  });

describe("correspondenceThreads", () => {
  it("lists each kind by its latest activity, leading to its page", () => {
    const list = threads({
      letters: [signed()],
      pauseaiLetters: [pauseai],
      oneOffs: [oneOff()],
      kept: messages({ letters: { 1: [step(1, "supporter"), step(9, "them", { name: "Polly" })] } }),
    });
    expect(list.map(({ key, href, at: when }) => [key, href, when])).toEqual([
      ["letter-1", "/staff/letters/1", at(9)],
      ["one-off-4", "/staff/one-off/4", at(4)],
      ["letter-3", "/staff/mailings/9/letters/3", at(3)],
    ]);
    expect(list[0]).toMatchObject({ sender: "Jane Smith", status: null, ownWords: 0.2, noReply: false });
  });

  it("says what kind each is, titled by a letter's subject where it has one, else its campaign's or mailing's", () => {
    const list = threads({
      letters: [signed(), signed({ id: 5 })],
      pauseaiLetters: [pauseai, { ...pauseai, id: 6 }],
      oneOffs: [oneOff()],
      kept: messages({ subjects: { 1: "Please support this", 3: "Our invitation", 5: "", 6: "" } }),
    });
    expect(Object.fromEntries(list.map(({ key, kind, title }) => [key, [kind, title]]))).toEqual({
      "letter-1": ["campaign", "Please support this"],
      "letter-5": ["campaign", "Email your MP"],
      "letter-3": ["mailing", "Our invitation"],
      "letter-6": ["mailing", "Example Mailing"],
      "one-off-4": ["oneOff", "Coffee?"],
    });
  });

  it("says whether someone at their office really wrote, an automatic reply aside", () => {
    const [none, auto, real] = [[], [step(5, "them", { auto: true })], [step(5, "them")]].map(
      (steps) => threads({ oneOffs: [oneOff()], kept: messages({ oneOffs: { 4: steps } }) })[0],
    );
    expect([none, auto, real].map(hasReply)).toEqual([false, false, true]);
  });

  it("starts a letter with its own step when no kept message is it", () => {
    const list = threads({ pauseaiLetters: [pauseai], kept: messages({ letters: { 3: [step(5, "them")] } }) });
    expect(list[0].steps.map((s) => s.who)).toEqual(["us", "them"]);
    const kept = threads({ pauseaiLetters: [pauseai], kept: messages({ letters: { 3: [step(3, "us")] } }) });
    expect(kept[0].steps.map((s) => s.who)).toEqual(["us"]);
    expect(kept[0].noReply).toBe(true);
  });

  it("makes a run of automatic replies one, and doesn't count them as a reply", () => {
    const auto = { auto: true };
    const [thread] = threads({
      letters: [signed({ repliedAt: at(6) })],
      kept: messages({ letters: { 1: [step(1, "supporter"), step(5, "them", auto), step(6, "them", auto)] } }),
    });
    expect(thread.steps.map((s) => s.auto)).toEqual([false, true]);
    expect(thread.noReply).toBe(true);
  });

  it("adds a reply a letter knows of when nothing from them was kept", () => {
    const [thread] = threads({ letters: [signed({ repliedAt: at(6) })] });
    expect(thread.steps.map(({ who, at: when }) => [who, when])).toEqual([
      ["supporter", at(1)],
      ["them", at(6)],
    ]);
    expect(thread.noReply).toBe(false);
  });

  it("leaves out letters that never went", () => {
    const never = ["not_sent", "scheduled", "cancelled", "skipped", "queued"];
    const list = threads({ pauseaiLetters: never.map((status, id) => ({ ...pauseai, id, status })) });
    expect(list).toEqual([]);
  });

  it("gives staff without the permission a letter's campaign and status, and nothing of who or a link", () => {
    const [thread] = threads({ letters: [unsigned], senders: false });
    expect(thread).toMatchObject({
      title: "Email your MP",
      href: null,
      sender: null,
      status: "bounced",
      ownWords: null,
      noReply: true,
    });
  });

  it("hides a thread they can't see, which isn't waiting on anyone", () => {
    const [thread] = threads({ oneOffs: [oneOff({ subject: null, someoneElse: true })] });
    expect(thread).toMatchObject({ title: null, href: null, steps: [], noReply: false });
  });

  it("says no reply on a thread with them alone, but not on someone else's", () => {
    const steps = { 4: [step(4, "other", { name: "Vera" })] };
    const theirs = threads({ oneOffs: [oneOff({ someoneElse: true })], kept: messages({ oneOffs: steps }) });
    expect(theirs[0].noReply).toBe(false);
    expect(theirs[0].href).toBe("/staff/one-off/4");
    expect(threads({ oneOffs: [oneOff()] })[0].noReply).toBe(true);
  });
});
