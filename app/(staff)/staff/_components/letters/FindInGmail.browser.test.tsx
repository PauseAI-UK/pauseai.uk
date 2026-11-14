import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import FindInGmail from "./FindInGmail";
import { lettersCopy } from "./copy";

describe("FindInGmail", () => {
  const copy = lettersCopy.findInGmail;
  const find = { mailbox: "policy@pauseai.uk", search: "rfc822msgid:abc@pauseai.uk" };

  it("copies the search, not shown, then says where to paste it", async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await render(<FindInGmail find={find} />);
    expect(document.body.textContent).not.toContain(find.search);
    await page.getByRole("button", { name: copy.copy }).click();
    expect(write).toHaveBeenCalledWith(find.search);
    await expect.element(page.getByRole("button", { name: copy.copied })).toBeVisible();
    // Bold, what to do, "paste" stressed; under it, lighter, where.
    await expect.poll(() => page.getByRole("status").element().textContent).toContain(copy.where("policy@pauseai.uk"));
    expect(page.getByRole("status").element().querySelector("strong")!.textContent).toBe(
      `${copy.next.before}${copy.next.stressed}${copy.next.after}`,
    );
    expect(page.getByRole("status").element().querySelector("em")!.textContent).toBe(copy.next.stressed);
    write.mockRestore();
  });

  it("says to paste it where the mail it was sent from is, when that isn't known; and is nothing with nothing to find", async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const { rerender } = await render(<FindInGmail find={{ ...find, mailbox: null }} />);
    await page.getByRole("button", { name: copy.copy }).click();
    await expect.poll(() => page.getByRole("status").element().textContent).toContain(copy.whereUnknown);
    write.mockRestore();
    await rerender(<FindInGmail find={null} />);
    expect(page.getByRole("button").all()).toHaveLength(0);
  });

  it("says to paste it in the mail of policy@'s members for a letter sent while it was a Google Group", async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await render(<FindInGmail find={{ ...find, inPolicyGroup: true }} />);
    await page.getByRole("button", { name: copy.copy }).click();
    await expect.poll(() => page.getByRole("status").element().textContent).toContain(copy.policyGroup);
    expect(page.getByRole("status").element().textContent).not.toContain(copy.where(find.mailbox));
    write.mockRestore();
  });
});
