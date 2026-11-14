import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import EmailBlocksTable from "./EmailBlocksTable";
import { exampleBlock, exampleComplaint } from "./EmailBlocksTable.examples";
import { action } from "@/tests/browser/staff";
import { supportersCopy } from "./supporters/copy";

describe("EmailBlocksTable", () => {
  it("lists each blocked address: why, since when, whose, the letter, emails not sent, and unblocks one", async () => {
    const { fn, sent } = action();
    await render(
      <EmailBlocksTable
        blocks={[
          exampleBlock,
          {
            ...exampleComplaint,
            politicians: [
              { id: 1, name: "A", isTest: false },
              { id: 2, name: "B", isTest: false },
            ],
          },
          { ...exampleBlock, address: "unknown@example.org", letter: null, purpose: null },
          {
            ...exampleComplaint,
            address: "two@example.org",
            supporters: [
              { id: 8, name: null },
              { id: 9, name: "Sam" },
            ],
          },
        ]}
        unblock={fn}
        letterLinks
      />,
    );
    const bounced = page.getByRole("row").filter({ hasText: exampleBlock.address });
    await expect.element(bounced.getByText(staffCopy.emails.kinds.hard)).toBeVisible();
    // The reason, then who told us.
    await expect
      .element(bounced.getByRole("cell", { name: `${exampleBlock.reason} ${staffCopy.emails.from.postmark}` }))
      .toBeVisible();
    // Whose it is, linked to their page; and the letter that found it out, by whom it was to, linked to it alone.
    await expect
      .element(bounced.getByRole("link", { name: "Bouncy McTestface MP", exact: true }))
      .toHaveAttribute("href", "/staff/politicians/5");
    await expect
      .element(bounced.getByRole("link", { name: `${staffCopy.emails.letterTo} Bouncy McTestface MP` }))
      .toHaveAttribute("href", "/staff/letters/17");
    await expect.element(bounced.getByRole("cell", { name: "2", exact: true })).toBeVisible();
    // A complaint can't be unblocked; two politicians share its address, and a supporter, after them, linked too.
    const complained = page.getByRole("row").filter({ hasText: exampleComplaint.address });
    await expect.element(complained.getByText(staffCopy.emails.cantReset)).toBeVisible();
    await expect.element(complained.getByText("A, B, Jane Example")).toBeVisible();
    await expect
      .element(complained.getByRole("link", { name: "Jane Example" }))
      .toHaveAttribute("href", "/staff/supporters/7");
    // Two supporters, one with no name.
    const two = page.getByRole("row").filter({ hasText: "two@example.org" });
    await expect.element(two.getByText(`${supportersCopy.supporters.noName}, Sam`)).toBeVisible();
    await expect
      .element(two.getByRole("link", { name: supportersCopy.supporters.noName }))
      .toHaveAttribute("href", "/staff/supporters/8");
    // What the email was: a letter, another of ours, or one the site has no record of.
    await expect.element(complained.getByText(staffCopy.emails.purposes["forwarded-reply"])).toBeVisible();
    const unknown = page.getByRole("row").filter({ hasText: "unknown@example.org" });
    await expect.element(unknown.getByText(staffCopy.emails.notRecorded)).toBeVisible();
    // The row holds a button alone; it opens a bubble that asks why, which Cancel closes.
    const note = bounced.getByLabelText(staffCopy.emails.note);
    const open = bounced.getByRole("button", { name: staffCopy.emails.unblockOpen });
    const unblock = bounced.getByRole("button", { name: staffCopy.emails.unblock, exact: true });
    await expect.element(note).not.toBeVisible();
    await open.click();
    await expect.element(note).toBeVisible();
    await bounced.getByRole("button", { name: staffCopy.emails.cancel }).click();
    await expect.element(note).not.toBeVisible();
    // Without a note the browser won't send it; with one, it does.
    await open.click();
    expect((note.element() as HTMLInputElement).required).toBe(true);
    await unblock.click();
    await expect.element(note).toHaveFocus();
    expect(sent).toEqual([]);
    await note.fill("Fixed in Airtable");
    await unblock.click();
    await vi.waitFor(() => expect(sent).toEqual([{ address: exampleBlock.address, note: "Fixed in Airtable" }]));
  });

  it("names the letter without linking to it, without letter links", async () => {
    await render(<EmailBlocksTable blocks={[exampleBlock]} unblock={vi.fn()} letterLinks={false} />);
    await expect.element(page.getByText(`${staffCopy.emails.letterTo} Bouncy McTestface MP`)).toBeVisible();
    expect(document.querySelector('a[href^="/staff/letters"]')).toBeNull();
  });

  it("says when there are none", async () => {
    await render(<EmailBlocksTable blocks={[]} unblock={vi.fn()} letterLinks />);
    await expect.element(page.getByText(staffCopy.emails.noBlocks)).toBeVisible();
  });
});
