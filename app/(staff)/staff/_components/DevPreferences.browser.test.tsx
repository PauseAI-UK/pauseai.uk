import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import DevPreferences from "./DevPreferences";

describe("DevPreferences", () => {
  it("links each address to its contact preferences, in a fixture build", async () => {
    await render(<DevPreferences emails={["jane.smith@example.com", "jane+x@example.org"]} fixtures />);
    await expect.element(page.getByRole("region", { name: staffCopy.devPreferences.title })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "jane+x@example.org" }))
      .toHaveAttribute("href", "/staff/api/dev-contact-preferences?address=jane%2Bx%40example.org");
  });

  it("is nothing outside a fixture build, or for someone with no address", async () => {
    await render(<DevPreferences emails={["jane.smith@example.com"]} fixtures={false} />);
    await render(<DevPreferences emails={[]} fixtures />);
    await expect.element(page.getByRole("link")).not.toBeInTheDocument();
  });
});
