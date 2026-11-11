import { describe, expect, it } from "vitest";
import { phoneWords } from "./phone";

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
