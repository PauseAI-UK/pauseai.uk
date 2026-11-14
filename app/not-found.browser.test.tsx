import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import NotFoundMain from "@/components/layout/NotFoundMain";
import SiteFrame from "@/components/layout/SiteFrame";
import SiteNotFound from "./(site)/not-found";
import NotFound from "./not-found";

describe("not found page", () => {
  it("says so, with the site header and a way home", async () => {
    await render(<NotFound />);
    await expect.element(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Go to homepage" })).toHaveAttribute("href", "/");
    await expect.element(page.getByRole("main")).toBeInTheDocument();
  });

  it("says so inside the site's layout, for a public page that isn't there", async () => {
    await render(<SiteNotFound />);
    await expect.element(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  it("draws one header and footer when a section's layout has drawn them already", async () => {
    await render(
      <SiteFrame>
        <NotFound />
      </SiteFrame>,
    );
    await expect.element(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    expect(page.getByRole("contentinfo").all()).toHaveLength(1);
    expect(document.querySelectorAll("header")).toHaveLength(1);
  });

  it("says it inside another page's main, as the gallery shows it", async () => {
    await render(<NotFoundMain as="div" />);
    await expect.element(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect.element(page.getByRole("main")).not.toBeInTheDocument();
  });
});
