import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import ErasedNotice from "./ErasedNotice";

describe("ErasedNotice", () => {
  it("says done, or done but what couldn't be cleared, or nothing", async () => {
    const { rerender } = await render(<ErasedNotice erased="1" />);
    await expect.element(page.getByRole("status")).toHaveTextContent(staffCopy.erase.done);
    await rerender(<ErasedNotice erased="partly" why="mail,someone's words,oneOffs" />);
    await expect.element(page.getByRole("status")).toBeVisible();
    expect(page.getByRole("status").element().textContent).toContain(staffCopy.erase.partly);
    expect(
      page
        .getByRole("listitem")
        .all()
        .map((li) => li.element().textContent),
    ).toEqual([staffCopy.erase.notCleared.mail, staffCopy.erase.notCleared.oneOffs]);
    await rerender(<ErasedNotice erased="" />);
    expect(page.getByRole("status").all()).toHaveLength(0);
  });
});
