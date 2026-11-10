import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import Breadcrumb from "./Breadcrumb";

describe("Breadcrumb", () => {
  it("is the way back, as a navigation landmark", async () => {
    await render(<Breadcrumb href="/staff/supporters">Supporters</Breadcrumb>);
    const link = page.getByRole("navigation", { name: "Supporters" }).getByRole("link", { name: "Supporters" });
    await expect.element(link).toHaveAttribute("href", "/staff/supporters");
  });
});
