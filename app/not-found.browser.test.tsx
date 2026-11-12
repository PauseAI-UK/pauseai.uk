import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import NotFoundMain from "@/components/layout/NotFoundMain";
import NotFound from "./not-found";

describe("not found page", () => {
  it("says so, with the site header and a way home", async () => {
    await render(<NotFound />);
    await expect.element(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Go to homepage" })).toHaveAttribute("href", "/");
    await expect.element(page.getByRole("main")).toBeInTheDocument();
  });

  it("says it inside another page's main, as the gallery shows it", async () => {
    await render(<NotFoundMain as="div" />);
    await expect.element(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect.element(page.getByRole("main")).not.toBeInTheDocument();
  });
});
