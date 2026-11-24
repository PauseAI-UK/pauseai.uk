import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import EraseForm, { type Erase } from "./EraseForm";
import { EraseFormExample } from "./EraseForm.gallery.client";
import { RefusalPlace } from "../ui/ResultForm";
import { refused } from "@/lib/form-result";
import { supportersCopy } from "../supporters/copy";
import { erasureCopy } from "@/lib/erasure/copy";

// The page's address, which the place a page says things at its top reads; and the router its links use.
vi.mock("next/navigation", () => ({
  usePathname: () => "/staff/supporters/7/erase",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const copy = erasureCopy.erase;
const JANE = { id: 7, name: "Jane Example" };

/** A stand-in for the Server Action, answering each send in turn with one of `answers`. */
function erase(...answers: Awaited<ReturnType<Erase>>[]) {
  const action = vi.fn<Erase>();
  for (const answer of answers) action.mockResolvedValueOnce(answer);
  return action;
}

const reference = () => page.getByRole("textbox", { name: copy.referenceLabel });
const button = () => page.getByRole("button", { name: copy.button });

describe("EraseForm, for a supporter with no name", () => {
  it("heads the page with the stand-in", async () => {
    await render(<EraseForm supporter={{ id: 8, name: null }} action={erase()} />);
    await expect
      .element(
        page.getByRole("heading", {
          level: 1,
          name: `${copy.title}: ${supportersCopy.supporters.noName}`,
        }),
      )
      .toBeVisible();
  });
});

describe("EraseForm", () => {
  it("sends the supporter, the reference and the confirmation, only once the box is ticked, with the way back", async () => {
    const action = erase({ ok: true });
    await render(<EraseForm supporter={JANE} action={action} />);
    await expect.element(page.getByRole("heading", { level: 1, name: `${copy.title}: Jane Example` })).toBeVisible();
    await expect.element(button()).toBeDisabled();
    await expect.element(page.getByRole("link", { name: copy.cancel })).toHaveAttribute("href", "/staff/supporters/7");
    await reference().fill("ICO-123");
    await page.getByRole("checkbox", { name: copy.confirm }).click();
    await expect.element(button()).toBeEnabled();
    await button().click();
    await vi.waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(Object.fromEntries(action.mock.calls[0][0])).toEqual({ id: "7", reference: "ICO-123", confirm: "on" });
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  });

  it("says under the reference that it's blank, keeping what was typed and the box ticked", async () => {
    await render(<EraseForm supporter={JANE} action={erase(refused("blank"))} />);
    await reference().fill("   ");
    await page.getByRole("checkbox", { name: copy.confirm }).click();
    await button().click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.refused.blank);
    await expect.element(reference()).toHaveAttribute("aria-invalid", "true");
    await expect.element(reference()).toHaveValue("   ");
    await expect.element(page.getByRole("checkbox", { name: copy.confirm })).toBeChecked();
    await expect.element(button()).toBeEnabled();
  });

  it("says at the top of the page that someone else has erased them", async () => {
    await render(
      <RefusalPlace>
        <EraseForm supporter={JANE} action={erase(refused("gone"))} />
      </RefusalPlace>,
    );
    await reference().fill("ICO-123");
    await page.getByRole("checkbox", { name: copy.confirm }).click();
    await button().click();
    const alert = page.getByRole("alert");
    await expect.element(alert).toHaveTextContent(copy.refused.gone);
    // Over the page, not under the field.
    expect(reference().element().closest("form")!.contains(alert.element())).toBe(false);
    await expect.element(reference()).not.toHaveAttribute("aria-invalid");
  });

  it("logs an erase, in its example", async () => {
    await render(<EraseFormExample />);
    await reference().fill("ICO-123");
    await page.getByRole("checkbox", { name: copy.confirm }).click();
    await button().click();
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
      .toHaveTextContent('eraseSupporterNow({"id":"7","reference":"ICO-123","confirm":"on"})');
  });
});
