import { describe, expect, it } from "vitest";
import { alreadyAnswered } from "./warnings";

const recipients = [
  { id: 1, name: "Jane Smith", meets: ["edinburgh:declined", "letter:signed"] },
  { id: 2, name: "John Smith", meets: ["edinburgh:going"] },
  { id: 3, name: "Ann Smith", meets: [] },
  { id: 4, name: "Bob Smith", meets: ["edinburgh:declined"] },
];

describe("alreadyAnswered", () => {
  it("finds those who answered the ask, and how many gave each answer, yes first", () => {
    expect(alreadyAnswered(recipients, { slug: "edinburgh", kind: "event" })).toEqual({
      who: [
        { id: 2, name: "John Smith" },
        { id: 1, name: "Jane Smith" },
        { id: 4, name: "Bob Smith" },
      ],
      answers: [
        { status: "going", count: 1 },
        { status: "declined", count: 2 },
      ],
    });
  });

  it("finds no one with no ask, or none who answered it", () => {
    expect(alreadyAnswered(recipients, undefined)).toEqual({ who: [], answers: [] });
    expect(alreadyAnswered(recipients, { slug: "other", kind: "letter" })).toEqual({ who: [], answers: [] });
  });
});
