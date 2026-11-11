import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import ImportIcon from "./ImportIcon";

describe("ImportIcon", () => {
  it("shows each source's mark, named for screen readers and on hover", async () => {
    const sources = ["airtable", "luma", "civicrm", "gmail", "web", "database"] as const;
    await render(
      <>
        {sources.map((source) => (
          <ImportIcon key={source} source={source} />
        ))}
      </>,
    );
    for (const source of sources) {
      const icon = page.getByRole("img", { name: staffCopy.import[source] });
      await expect.element(icon).toBeVisible();
      expect(icon.element().getAttribute("title")).toBe(staffCopy.import[source]);
    }
    // Luma's is its own picture; Gmail's in its colours.
    expect(page.getByRole("img", { name: staffCopy.import.luma }).element().querySelector("img")!.src).toContain(
      "luma.png",
    );
    expect(
      page.getByRole("img", { name: staffCopy.import.gmail }).element().querySelector("path")!.getAttribute("fill"),
    ).toBe("var(--brand-gmail-blue)");
  });
});
