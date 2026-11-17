import { describe, expect, it } from "vitest";
import { isInternational, phoneNumber, phoneWords, withNumbersRead } from "./phone";
import { PHONE_NUMBERS } from "@/tests/phone-numbers";

describe("phoneNumber", () => {
  it.each(PHONE_NUMBERS)("reads %j as %j", (typed, number) => {
    expect(phoneNumber(typed)).toBe(number);
  });

  it("gives a number already international as it is", () => {
    for (const [, number] of PHONE_NUMBERS) if (number) expect(phoneNumber(number)).toBe(number);
  });
});

describe("withNumbersRead", () => {
  it("reads each row's number, leaving out and counting those it can't, and leaves a row with none as it is", () => {
    const none = { id: 3, phone: null };
    const { rows, unread } = withNumbersRead([{ id: 1, phone: "07700 900123" }, { id: 2, phone: "0770?900123" }, none]);
    expect(rows).toEqual([{ id: 1, phone: "+447700900123" }, { id: 2, phone: null }, none]);
    expect(rows[2]).toBe(none);
    expect(unread).toBe(1);
  });
});

describe("isInternational", () => {
  it.each(["+447700900000", "+15555550100", "+3531234567"])("takes %s", (number) => {
    expect(isInternational(number)).toBe(true);
  });

  it.each(["07700900000", "447700900000", "+44 7700 900000", "+", "+0447700900000", "+4477009000001234"])(
    "refuses %s",
    (number) => {
      expect(isInternational(number)).toBe(false);
    },
  );
});

describe("phoneWords", () => {
  it.each([
    ["+447700900000", "07700 900000"],
    ["+44 (0)7700 900000", "07700 900000"],
    ["00447700900000", "07700 900000"],
    ["447700900000", "07700 900000"],
    ["07700-900-000", "07700 900000"],
    ["+442079460000", "020 7946 0000"],
    ["02079460000", "020 7946 0000"],
  ])("shows the UK number %s without its country code, in its groups", (number, words) => {
    expect(phoneWords(number)).toBe(words);
  });

  it.each(["+15555550100", "+44770090000", "0770090000"])("leaves %s, not a UK number, as it is", (number) => {
    expect(phoneWords(number)).toBe(number);
  });
});
