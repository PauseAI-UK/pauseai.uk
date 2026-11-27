import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import PartBox from "./PartBox";

describe("PartBox", () => {
  it("shows who a part is for over its words, green, with no × unless it can be made for everyone", async () => {
    const { container } = await render(
      <PartBox label="Only for those who signed">
        <p>Thank you for signing.</p>
      </PartBox>,
    );
    await expect.element(page.getByText("Only for those who signed")).toBeVisible();
    await expect.element(page.getByText("Thank you for signing.")).toBeVisible();
    expect(container.querySelector("[data-except]")).toBeNull();
    expect(page.getByRole("button").all()).toHaveLength(0);
  });

  it("is grey for all but some", async () => {
    const { container } = await render(
      <PartBox label="Except those who signed" except>
        <p>Would you sign?</p>
      </PartBox>,
    );
    expect(container.querySelector("[data-except]")).not.toBeNull();
  });

  it("has a × that takes it away, named as its user says", async () => {
    const onRemove = vi.fn();
    await render(
      <PartBox label="Only for those who signed" onRemove={onRemove} removeLabel="Remove this variant">
        <p>Thank you for signing.</p>
      </PartBox>,
    );
    await page.getByRole("button", { name: "Remove this variant" }).click();
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
