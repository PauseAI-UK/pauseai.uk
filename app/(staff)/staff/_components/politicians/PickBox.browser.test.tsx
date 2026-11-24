import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import PickBox from "./PickBox";
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

describe("PickBox", () => {
  it("undoes a click that didn't save and marks the box as wrong, until the next click", async () => {
    // What a Server Action rejects with when the server threw: a digest, so the site isn't told of it again.
    const thrown = Object.assign(new Error("An error occurred in the Server Components render."), { digest: "1" });
    const action = vi.fn<(ticked: boolean) => Promise<void>>().mockRejectedValueOnce(thrown).mockResolvedValue();
    await render(<PickBox ticked={false} label="Jane Example" action={action} />);
    const box = page.getByRole("checkbox", { name: "Jane Example" });
    await box.click();
    await expect.element(box).toHaveAttribute("aria-invalid", "true");
    await expect.element(box).not.toBeChecked();
    await box.click();
    await expect.element(box).not.toHaveAttribute("aria-invalid");
    expect(action.mock.calls).toEqual([[true], [true]]);
  });
});
