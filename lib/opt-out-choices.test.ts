import { expect, it } from "vitest";
import { CONSENTS, type Send } from "./contact-permissions";
import { choiceValue, chosen, optOutChoices } from "./opt-out-choices";

/** An answer for each consent of an address or number, a yes but for those `no` names, as "<way>:<topic>". */
function answers(address: string, channel: "email" | "phone", no: string[] = []) {
  return CONSENTS.filter((c) => (channel === "email") === (c.way === "email")).map((c) => ({
    address,
    channel,
    topic: c.topic,
    way: c.way,
    send: (no.includes(`${c.way}:${c.topic}`) ? "no" : "yes") as Send,
  }));
}

it("offers each topic by each way we can send at each address and number, and every bulk email at each address", () => {
  const permissions = [...answers("jane@example.com", "email"), ...answers("+447700900123", "phone")];
  expect(optOutChoices(permissions).map(choiceValue)).toEqual([
    "email|newsletter|jane@example.com",
    "email|events|jane@example.com",
    "email|volunteering|jane@example.com",
    "email|bulk|jane@example.com",
    "text|newsletter|+447700900123",
    "text|events|+447700900123",
    "text|volunteering|+447700900123",
    "call|volunteering|+447700900123",
  ]);
  expect(optOutChoices([])).toEqual([]);
});

it("offers nothing we can't send them: no topic that's a no, and nothing at an address with no yes", () => {
  const permissions = [
    ...answers("jane@example.com", "email", ["email:newsletter", "email:volunteering"]),
    ...answers("sam@example.com", "email", ["email:newsletter", "email:events", "email:volunteering"]),
    ...answers("+447700900123", "phone", ["text:newsletter", "text:events", "text:volunteering"]),
  ];
  expect(optOutChoices(permissions).map(choiceValue)).toEqual([
    "email|events|jane@example.com",
    "email|bulk|jane@example.com",
    "call|volunteering|+447700900123",
  ]);
});

it("finds the choice a form sent only among the supporter's", () => {
  const choices = optOutChoices(answers("jane@example.com", "email"));
  expect(chosen("email|bulk|jane@example.com", choices)).toEqual({
    address: "jane@example.com",
    way: "email",
    list: "bulk",
  });
  expect(chosen("email|bulk|sam@example.com", choices)).toBeUndefined();
  expect(chosen(null, choices)).toBeUndefined();
});
