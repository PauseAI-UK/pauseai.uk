import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import PasteForm from "./PasteForm";

describe("PasteForm", () => {
  it("is typed into as its bubble opens; sends the names with Find these, Ctrl+Enter or Cmd+Enter; Enter is a new line", async () => {
    const action = vi.fn(async (form: FormData) => {
      expect(form.get("back")).toBe("/staff/politicians?mailing=12");
    });
    await render(
      <div id="paste-bubble" popover="auto">
        <PasteForm action={action} back="/staff/politicians?mailing=12" />
      </div>,
    );
    const box = page.getByRole("textbox", { name: staffCopy.mailingPages.pasteLabel });
    // Typed into at once when its bubble opens.
    const bubble = document.getElementById("paste-bubble") as HTMLElement;
    bubble.showPopover();
    await expect.element(box).toHaveFocus();
    // Closed and opened again, it's still typed into first.
    // Closed first, as a close and an open at once are one toggle.
    bubble.hidePopover();
    await expect.poll(() => bubble.matches(":popover-open")).toBe(false);
    await new Promise((done) => setTimeout(done, 50));
    bubble.showPopover();
    await expect.element(box).toHaveFocus();
    await userEvent.keyboard("Jane Smith{Enter}Tom Fakename");
    expect(action).not.toHaveBeenCalled();
    await expect.element(box).toHaveValue("Jane Smith\nTom Fakename");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await expect.poll(() => action.mock.calls.length).toBe(1);
    expect(action.mock.calls[0][0].get("names")).toBe("Jane Smith\nTom Fakename");
    await box.fill("Priya Testwell");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect.poll(() => action.mock.calls.length).toBe(2);
    // A form's action empties it once it's sent.
    await box.fill("Mo Example");
    await page.getByRole("button", { name: staffCopy.mailingPages.pasteTick }).click();
    await expect.poll(() => action.mock.calls.length).toBe(3);
  });
});
