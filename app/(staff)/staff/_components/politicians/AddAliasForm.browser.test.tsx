import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { refused } from "@/lib/form-result";
import { RefusalPlace } from "../ui/ResultForm";
import AddAliasForm, { type AddAliasAction } from "./AddAliasForm";
import { AddAliasFormExample } from "./AddAliasForm.gallery.client";
import { politiciansCopy } from "./copy";

// The page's address, which the place a page says things at its top reads.
vi.mock("next/navigation", () => ({
  usePathname: () => "/staff/politicians/7",
  useSearchParams: () => new URLSearchParams(),
}));

describe("AddAliasForm", () => {
  const words = politiciansCopy.politician.aliases;

  const address = () => page.getByLabelText(words.address);
  const note = () => page.getByLabelText(words.note);
  const send = async (to: string, why = "Hers") => {
    await address().fill(to);
    await note().fill(why);
    await page.getByRole("button", { name: words.add }).click();
  };
  /** A stand-in for the Server Action, answering each send in turn with one of `answers`. */
  function adding(...answers: Awaited<ReturnType<AddAliasAction>>[]) {
    const action = vi.fn<AddAliasAction>();
    for (const answer of answers) action.mockResolvedValueOnce(answer);
    return action;
  }

  it("opens from its Add, sends the address and why, and says why it wasn't added, keeping what was typed", async () => {
    const action = adding({ ok: true }, refused("invalid"), refused("note"), { ok: true });
    const added = vi.fn();
    await render(<AddAliasForm politicianId={7} action={action} onAdded={added} />);
    // Folded, it's its Add alone.
    await expect.element(address()).not.toBeInTheDocument();
    await page.getByRole("button", { name: words.add }).click();
    // Added: nothing to say, as the address appears in the list; the form folds back to its Add.
    await send(" A@Example.com ");
    await expect.element(address()).not.toBeInTheDocument();
    expect(added.mock.calls).toEqual([["a@example.com"]]);
    await page.getByRole("button", { name: words.add }).click();
    await send("b@example.com");
    await expect.element(page.getByRole("alert")).toHaveTextContent(words.refused.invalid);
    await expect.element(address()).toHaveAttribute("aria-invalid", "true");
    await expect.element(address()).toHaveValue("b@example.com");
    await expect.element(note()).toHaveValue("Hers");
    await expect.element(note()).not.toHaveAttribute("aria-invalid");
    await send("c@example.com", " ");
    await expect.element(page.getByRole("alert")).toHaveTextContent(words.refused.note);
    await expect.element(note()).toHaveAttribute("aria-invalid", "true");
    await expect.element(address()).not.toHaveAttribute("aria-invalid");
    await send("d@example.com");
    await expect.element(address()).not.toBeInTheDocument();
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
    expect(action.mock.calls.map(([form]) => Object.fromEntries(form))).toEqual([
      { politicianId: "7", address: "A@Example.com", note: "Hers" },
      { politicianId: "7", address: "b@example.com", note: "Hers" },
      { politicianId: "7", address: "c@example.com", note: " " },
      { politicianId: "7", address: "d@example.com", note: "Hers" },
    ]);
  });

  it("says at the top of the page that the politician has gone, and adds without anyone to tell", async () => {
    await render(
      <RefusalPlace>
        <AddAliasForm politicianId={7} action={adding(refused("gone"), { ok: true })} />
      </RefusalPlace>,
    );
    await page.getByRole("button", { name: words.add }).click();
    await send("a@example.com");
    const alert = page.getByRole("alert");
    await expect.element(alert).toHaveTextContent(words.refused.gone);
    // Over the page, not in the form.
    expect(page.getByRole("form", { name: words.add }).element().contains(alert.element())).toBe(false);
    await send("a@example.com");
    await expect.element(address()).not.toBeInTheDocument();
  });
});

describe("AddAliasForm's examples in the gallery", () => {
  // Their Server Actions are logged, not sent: pressing each adds its line to the event log.
  const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

  it("logs an address added to a politician's, saying nothing when it's added", async () => {
    await render(<AddAliasFormExample result={{ ok: true }} />);
    const words = politiciansCopy.politician.aliases;
    await page.getByRole("button", { name: words.add }).click();
    await page.getByLabelText(words.address).fill("polly@example.com");
    await page.getByLabelText(words.note).fill("Her Gmail");
    await page.getByRole("button", { name: words.add }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent('addAlias({"politicianId":"7","address":"polly@example.com","note":"Her Gmail"})');
    // Added, there's nothing to say: the form folds back to its Add.
    await expect.element(page.getByLabelText(words.address)).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: words.add })).toBeVisible();
  });
});
