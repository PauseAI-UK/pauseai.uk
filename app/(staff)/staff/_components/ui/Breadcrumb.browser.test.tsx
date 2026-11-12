import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import Breadcrumb from "./Breadcrumb";

describe("Breadcrumb", () => {
  it("is the trail to a page, as a navigation landmark: each page above it a link, then the page itself", async () => {
    await render(
      <Breadcrumb
        steps={[
          { href: "/staff/campaigns", label: "Campaigns" },
          { href: "/staff/campaigns/example", label: "An example campaign" },
        ]}
        here="Letter"
      />,
    );
    const trail = page.getByRole("navigation", { name: staffCopy.breadcrumb });
    expect(
      trail
        .getByRole("listitem")
        .elements()
        .map((step) => step.textContent),
    ).toEqual(["Campaigns", "An example campaign", "Letter"]);
    await expect.element(trail.getByRole("link", { name: "Campaigns" })).toHaveAttribute("href", "/staff/campaigns");
    await expect
      .element(trail.getByRole("link", { name: "An example campaign" }))
      .toHaveAttribute("href", "/staff/campaigns/example");
    // The page itself isn't a link, and is marked as where you are.
    expect(trail.getByRole("link", { name: "Letter" }).query()).toBeNull();
    await expect.element(trail.getByText("Letter")).toHaveAttribute("aria-current", "page");
  });
});
