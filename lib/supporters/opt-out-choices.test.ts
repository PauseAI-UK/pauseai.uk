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
    // Events by email, Luma's own messages, after the lists, as a supporter's page has its rows.
    "email|newsletter|jane@example.com",
    "email|volunteering|jane@example.com",
    "email|events|jane@example.com",
    "email|bulk|jane@example.com",
    // Not events by text, as the newsletter goes to the number too, so a no to events alone would stop nothing.
    "text|newsletter|+447700900123",
    "text|volunteering|+447700900123",
    "call|volunteering|+447700900123",
  ]);
  // Where only events reaches a number, as a Luma number's texts do, that's what's offered.
  expect(optOutChoices(answers("+447700900123", "phone", ["text:newsletter"])).map(choiceValue)).toEqual([
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
  // Jane's yes to events by email puts her on PauseAI UK Updates inc. Luma, so the newsletter is offered there
  // too, though it's a no: opting out of it stops our emails and leaves her on the calendar.
  expect(optOutChoices(permissions).map(choiceValue)).toEqual([
    "email|newsletter|jane@example.com",
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

it("offers events by email to someone on our Luma calendar even where it's a no, as Luma's own messages still go", () => {
  const permissions = [
    ...answers("jane@example.com", "email", ["email:newsletter", "email:events", "email:volunteering"]),
    ...answers("+447700900123", "phone", ["text:newsletter", "text:events", "text:volunteering"]),
  ];
  // Off the calendar, there's nothing by email to opt out of.
  expect(optOutChoices(permissions).map(choiceValue)).toEqual(["call|volunteering|+447700900123"]);
  // On it, Luma's messages, and every bulk email, which takes them off it too; a number's texts aren't Luma's.
  expect(optOutChoices(permissions, true).map(choiceValue)).toEqual([
    "email|events|jane@example.com",
    "email|bulk|jane@example.com",
    "call|volunteering|+447700900123",
  ]);
  // An address with no answer about events isn't the one on the calendar.
  const noEvents = answers("sam@example.com", "email", ["email:newsletter", "email:volunteering"]).filter(
    (p) => p.topic !== "events",
  );
  expect(optOutChoices(noEvents, true)).toEqual([]);
});
