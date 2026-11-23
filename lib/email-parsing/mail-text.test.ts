import { describe, expect, it } from "vitest";
import { mailBlocks, mailParts } from "./mail-text";

describe("mailParts", () => {
  it("leaves plain words alone", () => {
    expect(mailParts("Dear Jane")).toEqual([{ text: "Dear Jane" }]);
    expect(mailParts("")).toEqual([]);
  });

  it("makes an address a link, leaving out the punctuation after it", () => {
    expect(mailParts("See https://example.org/a?b=1, or (https://example.org/c).")).toEqual([
      { text: "See " },
      { link: "https://example.org/a?b=1" },
      { text: ", or (" },
      { link: "https://example.org/c" },
      { text: ")." },
    ]);
  });

  it("makes an address given twice one link, on one line or two", () => {
    expect(mailParts("At https://example.org/a <https://example.org/a> now")).toEqual([
      { text: "At " },
      { link: "https://example.org/a" },
      { text: " now" },
    ]);
    expect(mailParts("At https://example.org/a\n<https://example.org/a>")).toEqual([
      { text: "At " },
      { link: "https://example.org/a" },
    ]);
  });

  it("keeps a different address in brackets as its own link", () => {
    expect(mailParts("Our page <https://example.org/a>")).toEqual([
      { text: "Our page <" },
      { link: "https://example.org/a" },
      { text: ">" },
    ]);
  });

  it("makes words between asterisks bold, over several lines, with any link in them", () => {
    expect(
      mailParts("Dear Jane,\n\n*Good news: it's out at https://example.org/a\n<https://example.org/a>*\n\nBye"),
    ).toEqual([
      { text: "Dear Jane,\n\n" },
      { bold: [{ text: "Good news: it's out at " }, { link: "https://example.org/a" }] },
      { text: "\n\nBye" },
    ]);
    expect(mailParts("(*Thanks*), *Jane*.")).toEqual([
      { text: "(" },
      { bold: [{ text: "Thanks" }] },
      { text: "), " },
      { bold: [{ text: "Jane" }] },
      { text: "." },
    ]);
  });

  it("leaves asterisks that don't wrap words: a sum, a list, or a pair across paragraphs", () => {
    expect(mailParts("2 * 3 * 4")).toEqual([{ text: "2 * 3 * 4" }]);
    expect(mailParts("* one\n* two")).toEqual([{ text: "* one\n* two" }]);
    expect(mailParts("*one\n\ntwo*")).toEqual([{ text: "*one\n\ntwo*" }]);
  });
});

describe("mailBlocks", () => {
  it("leaves lines with no list, quote or rule as they are", () => {
    expect(mailBlocks("Dear Jane,\n\nThanks.")).toEqual([{ text: "Dear Jane,\n\nThanks." }]);
  });

  it("reads a list's items, bulleted or numbered from its first number, apart from the lines around them", () => {
    expect(mailBlocks("It asks for:\n- a summit\n* a treaty\n• a pause\n\n3. first\n4) then\nAfter")).toEqual([
      { text: "It asks for:" },
      {
        list: {
          ordered: false,
          start: 1,
          items: [
            { text: "a summit", nested: [] },
            { text: "a treaty", nested: [] },
            { text: "a pause", nested: [] },
          ],
        },
      },
      { text: "" },
      {
        list: {
          ordered: true,
          start: 3,
          items: [
            { text: "first", nested: [] },
            { text: "then", nested: [] },
          ],
        },
      },
      { text: "After" },
    ]);
  });

  it("nests an indented item's list in the item above, and starts a new list where the kind changes", () => {
    const one = (text: string) => ({ text, nested: [] });
    expect(mailBlocks("- a\n  1. a one\n  2. a two\n    - deep\n- b\n1. c")).toEqual([
      {
        list: {
          ordered: false,
          start: 1,
          items: [
            {
              text: "a",
              nested: [
                {
                  ordered: true,
                  start: 1,
                  items: [
                    one("a one"),
                    { text: "a two", nested: [{ ordered: false, start: 1, items: [one("deep")] }] },
                  ],
                },
              ],
            },
            one("b"),
          ],
        },
      },
      { list: { ordered: true, start: 1, items: [one("c")] } },
    ]);
    expect(mailBlocks("  - in\n- out")).toEqual([
      { list: { ordered: false, start: 1, items: [one("in"), one("out")] } },
    ]);
  });

  it("reads what's quoted, quotes within it, and Outlook's rule; not a dash or a number that starts no item", () => {
    expect(
      mailBlocks(`On Mon, Jo wrote:\n\n> Will you?\n>\n> > Yes\n${"_".repeat(32)}\nFrom: Jo\n-1 vote\n2.5 times\n-`),
    ).toEqual([
      { text: "On Mon, Jo wrote:\n" },
      { quote: [{ text: "Will you?\n" }, { quote: [{ text: "Yes" }] }] },
      { rule: true },
      { text: "From: Jo\n-1 vote\n2.5 times\n-" },
    ]);
  });
});
