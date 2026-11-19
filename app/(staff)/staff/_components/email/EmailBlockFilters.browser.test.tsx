import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import EmailBlockFilters, { emailBlockFilters } from "./EmailBlockFilters";
import { chips } from "@/tests/browser/staff";
import { ADDRESSES_TO_FIX_LIST } from "@/lib/staff-lists";
import { emailCopy } from "./copy";

describe("EmailBlockFilters", () => {
  it("searches the addresses on its page, and filters by cause and what found it out", async () => {
    const search = ADDRESSES_TO_FIX_LIST.read({
      q: "example.org",
      kind: "complaint",
      backend: "gmail",
      found: "letter",
    });
    await render(<EmailBlockFilters search={search} numbers={false} action="/staff/politicians/addresses-to-fix" />);
    const { columns, kinds, foundBy, from } = emailCopy.emails;
    await expect.element(page.getByRole("searchbox", { name: columns.address })).toHaveValue("example.org");
    expect(page.getByRole("searchbox").element().closest("form")!.getAttribute("action")).toBe(
      "/staff/politicians/addresses-to-fix",
    );
    // In their columns' order.
    expect(chips()).toEqual([
      `${columns.kind}: ${kinds.complaint}`,
      `${columns.backend}: ${from.gmail}`,
      `${columns.sent}: ${foundBy.letter}`,
    ]);
  });

  it("offers numbers not on WhatsApp, and WhatsApp as who told us, only on a list with numbers", () => {
    const options = (numbers: boolean, at: number) =>
      emailBlockFilters(numbers)[at].options.map((option) => option.value);
    expect(options(true, 0)).toEqual(["hard", "complaint", "hold", "not-on-whatsapp"]);
    expect(options(false, 0)).toEqual(["hard", "complaint", "hold"]);
    expect(options(true, 1)).toEqual(["postmark", "gmail", "civicrm", "whatsapp"]);
    expect(options(false, 1)).toEqual(["postmark", "gmail", "civicrm"]);
  });
});
