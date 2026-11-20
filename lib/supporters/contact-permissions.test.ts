import { describe, expect, it } from "vitest";
import {
  CONSENTS,
  channelOf,
  consentKey,
  contactState,
  contactStates,
  listFor,
  listOf,
  listsBy,
  listValue,
  stateValue,
} from "./contact-permissions";

describe("consents", () => {
  it("are each topic by its ways, a topic at a time, each with its key: calls only for volunteering", () => {
    expect(CONSENTS.map(consentKey)).toEqual([
      "email:newsletter",
      "text:newsletter",
      "email:events",
      "text:events",
      "email:volunteering",
      "text:volunteering",
      "call:volunteering",
    ]);
  });

  it("reach someone by email at an address, and by text or call at a number", () => {
    expect([channelOf("email"), channelOf("text"), channelOf("call")]).toEqual(["email", "phone", "phone"]);
  });
});

describe("contactState", () => {
  it("reads a consent, with a yes or a reason, and nothing else", () => {
    expect(contactState("email:events")).toEqual({ way: "email", topic: "events" });
    expect(contactState("text:newsletter:yes")).toEqual({ way: "text", topic: "newsletter", send: "yes" });
    expect(contactState("call:volunteering:do-not-phone")).toEqual({
      way: "call",
      topic: "volunteering",
      reason: "do-not-phone",
    });
    expect(contactState("phone:events")).toBeUndefined();
    expect(contactState("email:luma-calendar")).toBeUndefined();
    expect(contactState("email:events:unsure")).toBeUndefined();
    expect(contactState("email:events:no")).toBeUndefined();
    expect(contactState("email:events:yes:no")).toBeUndefined();
    expect(contactState("email")).toBeUndefined();
    expect(contactState("")).toBeUndefined();
  });

  it("writes a state as its form value", () => {
    for (const value of ["text:events", "email:newsletter:yes", "call:volunteering:volunteered"]) {
      expect(stateValue(contactState(value)!)).toBe(value);
    }
  });
});

describe("lists", () => {
  it("go each by the ways their topics do, by call only Volunteering", () => {
    expect(listsBy("email")).toEqual(["updates", "updates-luma", "volunteering"]);
    expect(listsBy("text")).toEqual(["updates", "updates-luma", "volunteering"]);
    expect(listsBy("call")).toEqual(["volunteering"]);
  });

  it("are each one form value, a yes to each of its topics, which reads back as their states", () => {
    expect(listValue("updates-luma", "email")).toBe("email:newsletter:yes email:events:yes");
    expect(listValue("volunteering", "call")).toBe("call:volunteering:yes");
    expect(contactStates([listValue("updates-luma", "text"), "!", "call:volunteering:yes"])).toEqual([
      { way: "text", topic: "newsletter", send: "yes" },
      { way: "text", topic: "events", send: "yes" },
      { way: "call", topic: "volunteering", send: "yes" },
    ]);
  });

  it("are found from their topics in any order, and a mix from before the lists as the one covering it", () => {
    expect(listOf(["events", "newsletter"])).toBe("updates-luma");
    expect(listOf(["newsletter", "volunteering"])).toBeUndefined();
    expect(listFor(["newsletter", "events", "volunteering"])).toBe("updates-luma");
    expect(listFor(["newsletter", "volunteering"])).toBe("updates");
    expect(listFor(["volunteering"])).toBe("volunteering");
    expect(listFor(["newsletter"])).toBe("updates");
    expect(listFor([])).toBe("volunteering");
  });
});
