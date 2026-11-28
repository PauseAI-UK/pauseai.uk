import { describe, expect, it } from "vitest";
import {
  asksToJoin,
  cameFromCode,
  chatLink,
  endsAsTheButtons,
  inviteLink,
  isWaitingState,
  joinMessage,
  SITE_CODE,
  waitingStateOf,
} from "./waiting-room";

describe("cameFromCode", () => {
  it("takes a utm_source that can be a code, in lower case, and the site's for anything else", () => {
    expect(cameFromCode(" Parents ")).toBe("parents");
    expect(cameFromCode("west-of-england")).toBe("west-of-england");
    expect(cameFromCode("two words")).toBe(SITE_CODE);
    expect(cameFromCode("")).toBe(SITE_CODE);
    expect(cameFromCode(null)).toBe(SITE_CODE);
    expect(cameFromCode(undefined)).toBe(SITE_CODE);
  });
});

describe("asksToJoin", () => {
  it("knows the button's message by its code, wherever it is and in any case, and says where they came from", () => {
    expect(asksToJoin(joinMessage("Hi PauseAI UK, I'd like to join", "parents"))).toEqual({ cameFrom: "parents" });
    expect(asksToJoin("I want to join (FOOTER) I'm Jane")).toEqual({ cameFrom: "footer" });
    expect(asksToJoin("Hello, I'm Jane (footer)")).toEqual({ cameFrom: "footer" });
  });

  it("takes a message that asks to join in its own words, with nowhere it came from", () => {
    expect(asksToJoin("Can I join your WhatsApp group?")).toEqual({ cameFrom: null });
    expect(asksToJoin("JOINING please")).toEqual({ cameFrom: null });
  });

  it("leaves a message that doesn't ask", () => {
    expect(asksToJoin("Thanks for the update")).toBeUndefined();
    expect(asksToJoin("I'm worried (very) about it")).toBeUndefined();
    expect(asksToJoin("a (two words) aside")).toBeUndefined();
  });
});

describe("endsAsTheButtons", () => {
  it("knows a message that ends as the button's does, with its code in brackets", () => {
    expect(endsAsTheButtons("Hi PauseAI UK, I'd like to join (parents) ")).toBe(true);
    expect(endsAsTheButtons("Can I join the march (Saturday) please?")).toBe(false);
    expect(endsAsTheButtons("Can I join?")).toBe(false);
  });
});

describe("chatLink", () => {
  it("opens a chat with the number, its digits alone, the message typed", () => {
    expect(chatLink("+44 7700 900000", "Hi (parents)")).toBe("https://wa.me/447700900000?text=Hi%20(parents)");
  });
});

describe("inviteLink", () => {
  it("takes an invite link, trimmed, without what WhatsApp adds when it's shared", () => {
    expect(inviteLink(" https://chat.whatsapp.com/AbC123?s=cl&p=i ")).toBe("https://chat.whatsapp.com/AbC123");
    expect(inviteLink("https://chat.whatsapp.com/AbC123#x")).toBe("https://chat.whatsapp.com/AbC123");
  });

  it("refuses anything else", () => {
    expect(inviteLink("http://chat.whatsapp.com/AbC123")).toBeNull();
    expect(inviteLink("https://example.com/AbC123")).toBeNull();
    expect(inviteLink("https://chat.whatsapp.com/")).toBeNull();
  });
});

describe("isWaitingState and waitingStateOf", () => {
  it("knows the states, and takes the page's tab from them, held by default", () => {
    expect(isWaitingState("held")).toBe(true);
    expect(isWaitingState("gone")).toBe(false);
    expect(waitingStateOf("dismissed")).toBe("dismissed");
    expect(waitingStateOf("gone")).toBe("held");
    expect(waitingStateOf(undefined)).toBe("held");
  });
});
