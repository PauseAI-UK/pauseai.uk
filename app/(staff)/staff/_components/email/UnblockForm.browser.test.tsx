import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { refused } from "@/lib/form-result";
import { exampleBlock, exampleComplaint } from "../oversight/BlocksTable.examples";
import UnblockForm, { type Unblock } from "./UnblockForm";
import { UnblockBubbleExample, UnblockFormExample } from "./UnblockForm.gallery.client";
import { emailCopy } from "./copy";

const copy = emailCopy.emails;
const note = () => page.getByRole("textbox", { name: copy.note });
const unblock = () => page.getByRole("button", { name: copy.unblock, exact: true });

describe("UnblockForm", () => {
  it("sends the address with the note of why", async () => {
    const action = vi.fn<Unblock>(async () => ({ ok: true }));
    await render(<UnblockForm block={exampleBlock} action={action} />);
    await note().fill("Fixed in Airtable");
    await unblock().click();
    await vi.waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(Object.fromEntries(action.mock.calls[0][0])).toEqual({
      address: exampleBlock.address,
      note: "Fixed in Airtable",
    });
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  });

  it("says under the field and its button that a note of nothing but spaces won't do, keeping it", async () => {
    await render(<UnblockForm block={exampleBlock} action={async () => refused("blank")} />);
    await note().fill("   ");
    await unblock().click();
    const alert = page.getByRole("alert");
    await expect.element(alert).toHaveTextContent(emailCopy.unblockRefused.blank);
    await expect.element(note()).toHaveAttribute("aria-invalid", "true");
    await expect.element(note()).toHaveValue("   ");
    // Under the two, not between them: what's before it, and what brings it into view, holds both.
    expect(alert.element().parentElement!.previousElementSibling!.contains(unblock().element())).toBe(true);
  });

  it("says why instead, for what can't be unblocked", async () => {
    await render(<UnblockForm block={exampleComplaint} action={async () => ({ ok: true })} />);
    await expect.element(page.getByText(copy.cantReset.complaint)).toBeVisible();
    await expect.element(unblock()).not.toBeInTheDocument();
  });

  it("logs an unblock from the form and from a row's bubble, in their examples", async () => {
    const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");
    const { unmount } = await render(<UnblockFormExample />);
    // Beside the form: a complaint, and a bounce the provider won't send to again.
    await expect.element(page.getByText(copy.cantReset.complaint)).toBeVisible();
    await expect.element(page.getByText(copy.cantReset.provider)).toBeVisible();
    await note().fill("Fixed in Airtable");
    await unblock().click();
    await expect
      .element(log())
      .toHaveTextContent(`unblock({"address":"${exampleBlock.address}","note":"Fixed in Airtable"})`);
    await unmount();
    await render(<UnblockBubbleExample />);
    await page.getByRole("button", { name: copy.unblockOpen }).click();
    await note().fill("Checked with their office");
    await unblock().click();
    await expect
      .element(log())
      .toHaveTextContent('unblock({"address":"bounced@parliament.example","note":"Checked with their office"})');
  });
});
