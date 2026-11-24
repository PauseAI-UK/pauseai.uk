import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { refused } from "@/lib/form-result";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { RefusalPlace } from "../ui/ResultForm";
import { politiciansCopy } from "./copy";
import PasteForm from "./PasteForm";

// The page's address, which the place a page says things at its top reads.
vi.mock("next/navigation", () => ({
  usePathname: () => "/staff/politicians",
  useSearchParams: () => new URLSearchParams("mailing=12"),
}));

describe("PasteForm", () => {
  it("is typed into as its bubble opens; sends the names with Find these, Ctrl+Enter or Cmd+Enter; Enter is a new line", async () => {
    const action = vi.fn<(form: FormData) => Promise<{ ok: true }>>(async () => ({ ok: true }));
    await render(
      <div id="paste-bubble" popover="auto">
        <PasteForm action={action} back="/staff/politicians?mailing=12" />
      </div>,
    );
    const box = page.getByRole("textbox", { name: politiciansCopy.choosing.pasteLabel });
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
    await page.getByRole("button", { name: politiciansCopy.choosing.pasteTick }).click();
    await expect.poll(() => action.mock.calls.length).toBe(3);
    expect(action.mock.calls.map(([form]) => form.get("back"))).toEqual(Array(3).fill("/staff/politicians?mailing=12"));
  });

  it("keeps the names in the box, and says so under it, when they couldn't be sent", async () => {
    // What a Server Action rejects with when the server threw: a digest, so the site isn't told of it again.
    const thrown = Object.assign(new Error("An error occurred in the Server Components render."), { digest: "1" });
    await render(<PasteForm action={() => Promise.reject(thrown)} back="/staff/politicians?mailing=12" />);
    const box = page.getByRole("textbox", { name: politiciansCopy.choosing.pasteLabel });
    await box.fill("Jane Smith");
    await page.getByRole("button", { name: politiciansCopy.choosing.pasteTick }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(staffVocabulary.notDone);
    await expect.element(box).toHaveValue("Jane Smith");
  });

  it("says at the top of the page that the draft the names were for has gone", async () => {
    await render(
      <RefusalPlace>
        <PasteForm action={() => Promise.resolve(refused("gone"))} back="/staff/politicians?mailing=12" />
      </RefusalPlace>,
    );
    const box = page.getByRole("textbox", { name: politiciansCopy.choosing.pasteLabel });
    await box.fill("Jane Smith");
    await page.getByRole("button", { name: politiciansCopy.choosing.pasteTick }).click();
    const alert = page.getByRole("alert");
    await expect.element(alert).toHaveTextContent(politiciansCopy.choosing.gone);
    // Over the page, not in the form.
    expect(box.element().closest("form")!.contains(alert.element())).toBe(false);
  });
});
