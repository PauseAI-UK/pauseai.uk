import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import Closing from "./Closing";

describe("Closing", () => {
  it("links to the WhatsApp join form, saying which page it's on, and the ways to get involved", async () => {
    const { container } = await render(<Closing from="track-record" />);
    await expect
      .element(page.getByRole("link", { name: "Join the WhatsApp community" }))
      .toHaveAttribute("href", "/whatsapp?utm_source=track-record");
    await expect
      .element(page.getByRole("link", { name: "More ways to get involved" }))
      .toHaveAttribute("href", "/#join");
    expect(container.querySelector("p")).toBeNull();
  });

  it("puts a line above them", async () => {
    await render(<Closing from="track-record" line="Join us." />);
    await expect.element(page.getByText("Join us.")).toBeVisible();
  });
});
