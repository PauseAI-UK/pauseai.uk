import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import Alert from "./Alert";

describe("Alert", () => {
  it("is an error read out at once in red, or something waiting in amber", async () => {
    const { rerender } = await render(<Alert>Broken.</Alert>);
    await expect.element(page.getByRole("alert")).toHaveTextContent("Broken.");
    // A strip: its icon first, tinted, no border.
    expect(page.getByRole("alert").element().firstElementChild!.tagName.toLowerCase()).toBe("svg");
    expect(page.getByRole("alert").element().className).toMatch(/red/);
    expect(getComputedStyle(page.getByRole("alert").element()).borderLeftWidth).toBe("0px");
    await rerender(<Alert tone="amber">Waiting.</Alert>);
    await expect.element(page.getByRole("status")).toHaveTextContent("Waiting.");
    expect(page.getByRole("status").element().className).toMatch(/amber/);
  });
});
