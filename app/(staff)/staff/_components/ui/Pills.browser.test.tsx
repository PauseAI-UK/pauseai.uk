import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import Pills from "./Pills";

const LONG = "Event: March Against AI Extinction, 21 Nov 2026";

describe("Pills", () => {
  it("cuts a long one, to click to see whole and again to cut, and leaves a short one alone", async () => {
    await render(<Pills label="Who" words={[LONG, "Tag: Volunteer"]} />);
    const pills = page.getByRole("list", { name: "Who" }).getByRole("listitem");
    await expect.element(pills.first()).toBeVisible();
    // The short one is words alone; the long one a button, its whole words its tooltip.
    await expect.element(pills.nth(1).getByRole("button")).not.toBeInTheDocument();
    const long = page.getByRole("button", { name: LONG });
    await expect.element(long).toHaveAttribute("title", LONG);
    await expect.element(long).toHaveAttribute("aria-expanded", "false");
    const words = long.element().querySelector("span")!;
    const cutHeight = words.getBoundingClientRect().height;
    expect(words.scrollWidth).toBeGreaterThan(words.clientWidth);

    await long.click();
    await expect.element(long).toHaveAttribute("aria-expanded", "true");
    expect(words.scrollWidth).toBeLessThanOrEqual(words.clientWidth);
    await long.click();
    await expect.element(long).toHaveAttribute("aria-expanded", "false");
    expect(words.getBoundingClientRect().height).toBe(cutHeight);
  });
});
