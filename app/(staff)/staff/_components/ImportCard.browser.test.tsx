import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import ImportCard, { ImportCards } from "./ImportCard";
import ImportIcon from "./ImportIcon";

describe("ImportCard", () => {
  it("is a card with its icons, its title as the link to its page, what it does and its newest run, in a grid", async () => {
    await render(
      <ImportCards>
        <ImportCard
          title="An import"
          href="/staff/scheduled-jobs/luma"
          icon={<ImportIcon source="luma" />}
          tags={<span>Check only</span>}
          intro={<a href="https://luma.com">Luma</a>}
        >
          <p>Not imported yet.</p>
        </ImportCard>
        <ImportCard title="Another" href="/x" icon={null} intro="More.">
          <p>Never.</p>
        </ImportCard>
      </ImportCards>,
    );
    await expect.element(page.getByRole("img", { name: staffCopy.import.luma })).toBeVisible();
    const heading = page.getByRole("heading", { level: 3, name: "An import Check only" });
    await expect.element(heading).toBeVisible();
    await expect
      .element(heading.getByRole("link", { name: "An import" }))
      .toHaveAttribute("href", "/staff/scheduled-jobs/luma");
    await expect.element(page.getByRole("link", { name: "Luma" })).toHaveAttribute("href", "https://luma.com");
    await expect.element(page.getByText("Not imported yet.")).toBeVisible();
    // The title's link covers the card; the description's own link sits above it.
    const card = heading.element().closest("section")!;
    expect(getComputedStyle(card).position).toBe("relative");
    expect(getComputedStyle(heading.getByRole("link").element(), "::after").position).toBe("absolute");
    expect(getComputedStyle(page.getByRole("link", { name: "Luma" }).element()).zIndex).toBe("1");
    expect(getComputedStyle(card.parentElement!).display).toBe("grid");
    // The ending comes before the description, and the card's border is the ordinary one.
    expect(card.children[1].textContent).toBe("Not imported yet.");
    expect(getComputedStyle(card).borderLeftWidth).toBe("1px");
  });
});
