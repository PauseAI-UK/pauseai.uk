import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { DraftFootExample, DraftTitleExample } from "./DraftWriter.gallery.client";

describe("DraftWriter's examples in the gallery", () => {
  it("draws a draft's title and foot", async () => {
    await render(
      <>
        <DraftTitleExample />
        <DraftFootExample />
      </>,
    );
    await expect.element(page.getByRole("button", { name: "Schedule 412 emails" }).first()).toBeVisible();
  });

  it("leaves the draft's foot as it was when Schedule is refused", async () => {
    await render(<DraftFootExample />);
    const schedule = page.getByRole("button", { name: "Schedule 412 emails" }).first();
    await schedule.click();
    await expect.element(schedule).toBeEnabled();
  });
});
