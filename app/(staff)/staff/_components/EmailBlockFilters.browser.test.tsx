import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import EmailBlockFilters from "./EmailBlockFilters";
import { chips } from "@/tests/browser/staff";

describe("EmailBlockFilters", () => {
  it("searches the addresses on its page, and filters by cause", async () => {
    await render(<EmailBlockFilters q="example.org" kind="complaint" action="/staff/politicians/blocked-emails" />);
    const { columns, kinds } = staffCopy.emails;
    await expect.element(page.getByRole("searchbox", { name: columns.address })).toHaveValue("example.org");
    expect(page.getByRole("searchbox").element().closest("form")!.getAttribute("action")).toBe(
      "/staff/politicians/blocked-emails",
    );
    expect(chips()).toEqual([`${columns.kind}: ${kinds.complaint}`]);
  });
});
