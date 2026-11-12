import { expect, it } from "vitest";
import type { ContactPermission } from "./contact-permissions";
import { choiceKey, getsTopic, hold, settingsTopics, stillGets, type SettingsView } from "./email-settings";

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
  expect(topics.map(getsTopic)).toEqual([true, false, false]);
  expect(topics[1].why).toMatchObject({ reason: "unsubscribed" });
  expect(topics[2].why).toBeNull();
  expect(settingsTopics(view([answer({})]))[0].boxes.map((b) => b.way)).toEqual(["email"]);
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

it("says what an unsubscribe leaves them getting by email", () => {
  const answers = [
    answer({}),
    answer({ topic: "events", reason: "following", source: "luma" }),
    answer({ topic: "volunteering", send: "no" }),
  ];
  expect(stillGets(view(answers), ["newsletter"]).map((a) => a.topic)).toEqual(["events"]);
});
