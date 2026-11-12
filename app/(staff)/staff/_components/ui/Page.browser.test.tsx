import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import Page from "./Page";

/** The trail's steps, as their words. */
const steps = () =>
  page
    .getByRole("navigation", { name: staffCopy.breadcrumb })
    .getByRole("listitem")
    .elements()
    .map((step) => step.textContent);

describe("Page", () => {
  it("says which kind of page it is, with no trail on a page the navigation leads to", async () => {
    const { container } = await render(
      <Page kind="list">
        <h1>Supporters</h1>
      </Page>,
    );
    expect(container.firstElementChild!.getAttribute("data-page-kind")).toBe("list");
    expect(page.getByRole("navigation").query()).toBeNull();
    // The page's first thing starts at its top.
    expect(getComputedStyle(page.getByRole("heading").element()).marginTop).toBe("0px");
  });

  it("starts a page under one of the navigation's with the trail to it, from the navigation's own name", async () => {
    await render(
      <Page kind="record" under="supporters" here="Jane Smith">
        <h1>Jane Smith</h1>
      </Page>,
    );
    expect(steps()).toEqual([staffCopy.nav.supporters, "Jane Smith"]);
    await expect
      .element(page.getByRole("link", { name: staffCopy.nav.supporters }))
      .toHaveAttribute("href", "/staff/supporters");
  });

  it("puts the pages it's reached through between the two", async () => {
    await render(
      <Page kind="form" under="supporters" via={[{ href: "/staff/supporters/7", label: "Jane Smith" }]} here="Erase">
        <h1>Erase Jane Smith</h1>
      </Page>,
    );
    expect(steps()).toEqual([staffCopy.nav.supporters, "Jane Smith", "Erase"]);
    await expect.element(page.getByRole("link", { name: "Jane Smith" })).toHaveAttribute("href", "/staff/supporters/7");
  });
});
