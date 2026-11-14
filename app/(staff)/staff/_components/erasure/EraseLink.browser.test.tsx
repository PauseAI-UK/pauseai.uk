import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import EraseLink from "./EraseLink";
import { erasureCopy } from "@/lib/erasure/copy";

describe("EraseLink", () => {
  it("is the red button to the erase page, with the note beside it", async () => {
    await render(<EraseLink supporterId={7} />);
    await expect
      .element(page.getByRole("link", { name: erasureCopy.erase.title }))
      .toHaveAttribute("href", "/staff/supporters/7/erase");
    await expect.element(page.getByText(erasureCopy.erase.note)).toBeVisible();
  });
});
