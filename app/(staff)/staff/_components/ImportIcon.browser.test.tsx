import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import ImportIcon from "./ImportIcon";

describe("ImportIcon", () => {
  it("shows each source's mark, named for screen readers and on hover", async () => {
    const sources = ["airtable", "luma", "civicrm", "gmail", "parliament", "controlai", "database"] as const;
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
    // Luma's and ControlAI's are their own pictures; Gmail's in its colours, Parliament's portcullis in the Commons' green.
    expect(page.getByRole("img", { name: staffCopy.import.luma }).element().querySelector("img")!.src).toContain(
      "luma.png",
    );
    expect(page.getByRole("img", { name: staffCopy.import.controlai }).element().querySelector("img")!.src).toContain(
      "controlai.png",
    );
    expect(
      page.getByRole("img", { name: staffCopy.import.parliament }).element().querySelector("svg")!.getAttribute("fill"),
    ).toBe("var(--brand-parliament-green)");
    expect(
      page.getByRole("img", { name: staffCopy.import.gmail }).element().querySelector("path")!.getAttribute("fill"),
    ).toBe("var(--brand-gmail-blue)");
  });
});
