import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { exampleDashboard } from "./StaffDashboard.examples";
import StaffHome from "./StaffHome";
import { shellCopy } from "../shell/copy";
import { dashboardCopy } from "./copy";

describe("StaffHome", () => {
  it("shows the dashboard under its title and the day, with its groups in the sidebar's order and under its names", async () => {
    await render(<StaffHome permissions={["admin", "supporters"]} dashboard={exampleDashboard} />);
    await expect.element(page.getByRole("heading", { level: 1, name: dashboardCopy.home.title })).toBeVisible();
    await expect.element(page.getByText("Wednesday 21 October")).toBeVisible();
    const sections = shellCopy.nav.sections;
    expect(
      page
        .getByRole("heading", { level: 2 })
        .all()
        .map((heading) => heading.element().textContent),
    ).toEqual([sections.supporters, sections.politicians, sections.events]);
  });
});
