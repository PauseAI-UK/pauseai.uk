import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import AccountsNotice from "./AccountsNotice";

describe("AccountsNotice", () => {
  it("says why a change was refused, as an error, or nothing", async () => {
    const { rerender } = await render(<AccountsNotice notice="last-admin" />);
    const error = page.getByRole("alert");
    await expect.element(error).toHaveTextContent(staffCopy.accounts.lastAdmin);
    expect(error.element().firstElementChild!.tagName.toLowerCase()).toBe("svg");
    expect(error.element().className).toMatch(/red/);
    await rerender(<AccountsNotice notice="not-pauseai" />);
    await expect.element(page.getByRole("alert")).toHaveTextContent(staffCopy.accounts.notPauseai);
    await rerender(<AccountsNotice notice="" />);
    expect(page.getByRole("alert").all()).toHaveLength(0);
    expect(document.querySelector("[role=status]")!.textContent).toBe("");
  });

  it("says what removing an account leaves them, till its × closes it", async () => {
    await render(<AccountsNotice notice="removed" />);
    await expect.element(page.getByRole("status")).toHaveTextContent(`${staffCopy.accounts.removeNote}×`);
    await page.getByRole("button", { name: staffCopy.accounts.closeRemoved }).click();
    expect(document.querySelector("[role=status]")!.textContent).toBe("");
  });
});
