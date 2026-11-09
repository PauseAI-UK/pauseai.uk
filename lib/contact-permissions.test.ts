import { describe, expect, it } from "vitest";
import {
  SENDS,
  TOPIC_REASONS,
  TOPIC_SENDS,
  TOPIC_WAYS,
  contactState,
  sendsOf,
  stateValue,
  topicsOf,
  waysKey,
} from "./contact-permissions";

describe("sendsOf", () => {
  it("gives each topic's answers in SENDS's order, a no always among them, and only updates never a yes", () => {
    for (const channel of ["email", "phone"] as const)
      for (const topic of topicsOf(channel)) {
        const sends = sendsOf(channel, topic);
        expect(sends, topic).toEqual(SENDS.filter((send) => sends.includes(send)));
        expect(sends, topic).toContain("no");
      }
    expect(sendsOf("email", "pauseai-updates")).toEqual(["unsure", "no"]);
    expect(sendsOf("email", "luma-calendar")).toEqual(["yes", "no"]);
    expect(sendsOf("phone", "volunteering")).toEqual(SENDS);
    expect(Object.keys(TOPIC_SENDS.phone)).toEqual(Object.keys(TOPIC_REASONS.phone));
  });
});

describe("contactState", () => {
  it("reads a reason its channel's topic can give, and nothing else", () => {
    expect(contactState("email:luma-calendar:unsubscribed")).toEqual({
      channel: "email",
      topic: "luma-calendar",
      reason: "unsubscribed",
    });
    expect(contactState("phone:volunteering:volunteered")).toEqual({
      channel: "phone",
      topic: "volunteering",
      reason: "volunteered",
    });
    // A topic the channel doesn't have, and a reason another topic gives.
    expect(contactState("email:volunteering:volunteered")).toBeUndefined();
    expect(contactState("phone:pauseai-updates:asked")).toBeUndefined();
    expect(contactState("email:luma-calendar:joined")).toBeUndefined();
    expect(contactState("email:luma-calendar:blocked")).toBeUndefined();
    expect(contactState("post:luma-calendar:following")).toBeUndefined();
    expect(contactState("email:toString:asked")).toBeUndefined();
    // A topic alone is any answer for it; with yes, unsure or no, that answer.
    expect(contactState("phone:march-day")).toEqual({ channel: "phone", topic: "march-day" });
    expect(contactState("email:site-forms:unsure")).toEqual({ channel: "email", topic: "site-forms", send: "unsure" });
    expect(contactState("email:site-forms:asked:no")).toBeUndefined();
    // Blocked alone is no state; and a topic and reason need their channel.
    expect(contactState("email:blocked")).toBeUndefined();
    expect(contactState("phone:blocked")).toBeUndefined();
    expect(contactState("blocked")).toBeUndefined();
    expect(contactState("pauseai-updates:removed")).toBeUndefined();
    expect(contactState("luma-calendar")).toBeUndefined();
    expect(contactState("")).toBeUndefined();
  });

  it("writes a state as its form value", () => {
    for (const value of [
      "phone:volunteering",
      "email:luma-calendar:no",
      "email:site-forms:asked",
      "phone:march-day:ended",
    ]) {
      expect(stateValue(contactState(value)!)).toBe(value);
    }
  });

  it("says the ways each topic lets us contact someone, as one key", () => {
    expect(waysKey("email", "pauseai-updates")).toBe("email");
    expect(waysKey("phone", "march-day")).toBe("text");
    expect(waysKey("phone", "volunteering")).toBe("call-or-text");
    // Every topic a channel has has its ways.
    for (const channel of ["email", "phone"] as const) {
      expect(Object.keys(TOPIC_WAYS[channel])).toEqual(Object.keys(TOPIC_REASONS[channel]));
    }
  });

  it("lists each channel's topics", () => {
    expect(topicsOf("email")).toEqual(["luma-calendar", "pauseai-updates", "site-forms"]);
    expect(topicsOf("phone")).toEqual(["luma-calendar", "volunteering", "site-forms", "march-day"]);
  });
});
