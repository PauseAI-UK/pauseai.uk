import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import DeletePolitician from "./DeletePolitician";
import { action } from "@/tests/browser/staff";

describe("DeletePolitician", () => {
  it("is Delete, pressed twice, with its note, sending their ID", async () => {
    const { fn, sent } = action();
    await render(<DeletePolitician politician={{ id: 7 }} action={fn} />);
    const copy = staffCopy.politician.delete;
    await expect.element(page.getByText(copy.note)).toBeVisible();
    await page.getByRole("button", { name: copy.button, exact: true }).click();
    await page.getByRole("button", { name: staffCopy.deleteIt }).click();
    await expect.poll(() => sent).toEqual([{ politicianId: "7" }]);
  });

  it("is nothing for a politician who can't be deleted", async () => {
    await render(<DeletePolitician politician={{ id: 7 }} deletable={false} action={vi.fn()} />);
    expect(page.getByRole("button").all()).toHaveLength(0);
  });
});
