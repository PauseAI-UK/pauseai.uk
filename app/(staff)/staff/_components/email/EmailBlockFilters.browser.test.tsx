import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import EmailBlockFilters, { emailBlockFilters } from "./EmailBlockFilters";
import { chips } from "@/tests/browser/staff";
import { emailCopy } from "./copy";

describe("EmailBlockFilters", () => {
  it("searches the addresses on its page, and filters by cause and what found it out", async () => {
    await render(
      <EmailBlockFilters
        q="example.org"
        kind="complaint"
        found="letter"
        numbers={false}
        action="/staff/politicians/addresses-to-fix"
      />,
    );
    const { columns, kinds, foundBy } = emailCopy.emails;
    await expect.element(page.getByRole("searchbox", { name: columns.address })).toHaveValue("example.org");
    expect(page.getByRole("searchbox").element().closest("form")!.getAttribute("action")).toBe(
      "/staff/politicians/addresses-to-fix",
    );
    expect(chips()).toEqual([`${columns.kind}: ${kinds.complaint}`, `${columns.sent}: ${foundBy.letter}`]);
  });

  it("offers numbers not on WhatsApp only on a list with numbers", () => {
    const kinds = (numbers: boolean) => emailBlockFilters(numbers)[0].options.map((option) => option.value);
    expect(kinds(true)).toEqual(["hard", "complaint", "hold", "not-on-whatsapp"]);
    expect(kinds(false)).toEqual(["hard", "complaint", "hold"]);
  });
});
