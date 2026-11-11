import { describe, expect, it } from "vitest";
import { CONSENTS, channelOf, consentKey, contactState, stateValue } from "./contact-permissions";

describe("consents", () => {
  it("are every topic by every way, a topic at a time, each with its key", () => {
    expect(CONSENTS.map(consentKey)).toEqual([
      "email:newsletter",
      "text:newsletter",
      "call:newsletter",
      "email:events",
      "text:events",
      "call:events",
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
  it("reads a consent, with an answer or a reason, and nothing else", () => {
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
    expect(contactState("email:events:yes:no")).toBeUndefined();
    expect(contactState("email")).toBeUndefined();
    expect(contactState("")).toBeUndefined();
  });

  it("writes a state as its form value", () => {
    for (const value of ["text:events", "email:newsletter:no", "call:volunteering:volunteered"]) {
      expect(stateValue(contactState(value)!)).toBe(value);
    }
  });
});
