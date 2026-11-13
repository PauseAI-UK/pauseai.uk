import { expect, it } from "vitest";
import type { ContactPermission } from "./contact-permissions";
import { choiceKey, hold, isNumber, numberHolds, settingsTopics, type SettingsView } from "./email-settings";

const AT = new Date("2026-11-02T10:00:00Z");
const JANE = "jane@example.com";
const PHONE = "+447700900123";

const answer = (fields: Partial<ContactPermission>): ContactPermission => ({
  topic: "newsletter",
  way: "email",
  channel: "email",
  address: JANE,
  send: "yes",
  reason: "asked",
  at: AT,
  source: "march-2026-11",
  ...fields,
});

const view = (answers: ContactPermission[], numbers: string[] = []): SettingsView => ({
  address: JANE,
  numbers,
  answers,
  hold: hold(answers),
});

it("finds what holds all an address's email: a block, “Do not email” or “No bulk emails”, by email only", () => {
  expect(hold([answer({})])).toBeNull();
  expect(hold([answer({ way: "text", send: "no", reason: "do-not-sms" })])).toBeNull();
  expect(hold([answer({ send: "no", reason: "no-bulk-email", source: "civicrm" })])).toEqual({
    kind: "no-bulk",
    at: AT,
    source: "civicrm",
    everything: false,
  });
  expect(hold([answer({ send: "no", reason: "do-not-email" })])?.kind).toBe("do-not-email");
  expect(hold([answer({ send: "no", reason: "blocked", source: "hard" })])?.kind).toBe("blocked");
});

it("gives each topic a box by email, and by text and call where it goes by them and there's a number", () => {
  const topics = settingsTopics(
    view(
      [
        answer({}),
        answer({ way: "text", channel: "phone", address: PHONE }),
        answer({ topic: "events", way: "email", send: "no", reason: "unsubscribed", source: "link" }),
      ],
      [PHONE],
    ),
  );
  expect(topics.map((t) => [t.topic, t.boxes.map((b) => `${b.way}${b.on ? "+" : "-"}`)])).toEqual([
    ["newsletter", ["email+", "text+"]],
    ["events", ["email-", "text-"]],
    ["volunteering", ["email-", "text-", "call-"]],
  ]);
  expect(topics[1].why).toMatchObject({ reason: "unsubscribed" });
  expect(topics[2].why).toBeNull();
  expect(settingsTopics(view([answer({})]))[0].boxes.map((b) => b.way)).toEqual(["email"]);
});

it("gives a number's page no email boxes", () => {
  const number = { ...view([answer({ way: "text", channel: "phone", address: PHONE })], [PHONE]), address: PHONE };
  expect(isNumber(PHONE)).toBe(true);
  expect(isNumber(JANE)).toBe(false);
  expect(settingsTopics(number).map((t) => t.boxes.map((b) => b.way))).toEqual([["text"], ["text"], ["text", "call"]]);
});

it("explains a topic by its email's yes, else a number's yes, and locks email while all of it is held", () => {
  const held = settingsTopics(
    view(
      [
        answer({ send: "no", reason: "no-bulk-email", source: "civicrm" }),
        answer({ way: "text", channel: "phone", address: PHONE }),
      ],
      [PHONE],
    ),
  );
  expect(held[0].boxes).toEqual([
    { way: "email", on: false, locked: true },
    { way: "text", on: true, locked: false },
  ]);
  expect(held[0].why).toMatchObject({ way: "text", send: "yes" });
  expect(choiceKey("events", "text")).toBe("events:text");
});

it("finds the ways PauseAI Global stops to every number, and locks their boxes", () => {
  const OTHER = "+447700900456";
  const noSms = (address: string) =>
    answer({ way: "text", channel: "phone", address, send: "no", reason: "do-not-sms" });
  const noPhone = answer({ way: "call", channel: "phone", address: PHONE, send: "no", reason: "do-not-phone" });
  expect(numberHolds(view([noSms(PHONE)]))).toEqual([]);
  expect(numberHolds(view([noSms(PHONE), noPhone], [PHONE]))).toEqual(["text", "call"]);
  // A second number without it can still be texted.
  expect(numberHolds(view([noSms(PHONE)], [PHONE, OTHER]))).toEqual([]);
  expect(numberHolds(view([noSms(PHONE), noSms(OTHER)], [PHONE, OTHER]))).toEqual(["text"]);
  expect(settingsTopics(view([noSms(PHONE)], [PHONE]))[2].boxes).toEqual([
    { way: "email", on: false, locked: false },
    { way: "text", on: false, locked: true },
    { way: "call", on: false, locked: false },
  ]);
});
