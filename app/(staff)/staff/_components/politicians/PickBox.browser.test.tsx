import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { PickBoxExample } from "./PickBox.gallery.client";

describe("PickBox's examples in the gallery", () => {
  // Their Server Actions are logged, not sent: pressing each adds its line to the event log.
  const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

  it("logs each tick box's click", async () => {
    await render(<PickBoxExample />);
    for (const name of ["Ticked", "Not ticked", "Some ticked"]) await page.getByRole("checkbox", { name }).click();
    await expect
      .poll(() =>
        log()
          .all()
          .map((item) => item.element().textContent),
      )
      .toEqual(["pick(false)", "pick(true)", "pick(true)"]);
  });
});
