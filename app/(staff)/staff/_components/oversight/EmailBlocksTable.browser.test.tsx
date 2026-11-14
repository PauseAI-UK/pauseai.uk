import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import EmailBlocksTable, { blockColumns } from "./EmailBlocksTable";
import { exampleBlock, exampleComplaint, exampleGmailBlock } from "./EmailBlocksTable.examples";
import { action } from "@/tests/browser/staff";
import { supportersCopy } from "../supporters/copy";
import { emailCopy } from "@/lib/email/copy";
import { type DownloadColumn } from "@/lib/staff-list";

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
    await expect.element(bounced.getByText(emailCopy.emails.kinds.hard)).toBeVisible();
    // The reason, then who told us.
    await expect
      .element(bounced.getByRole("cell", { name: `${exampleBlock.reason} ${emailCopy.emails.from.postmark}` }))
      .toBeVisible();
    // Whose it is, linked to their page; and the letter that found it out, by whom it was to, linked to it alone.
    await expect
      .element(bounced.getByRole("link", { name: "Bouncy McTestface MP", exact: true }))
      .toHaveAttribute("href", "/staff/politicians/5");
    await expect
      .element(bounced.getByRole("link", { name: `${emailCopy.emails.letterTo} Bouncy McTestface MP` }))
      .toHaveAttribute("href", "/staff/letters/17");
    await expect.element(bounced.getByRole("cell", { name: "2", exact: true })).toBeVisible();
    // A complaint can't be unblocked; two politicians share its address, and a supporter, after them, linked too.
    const complained = page.getByRole("row").filter({ hasText: exampleComplaint.address });
    await expect.element(complained.getByText(emailCopy.emails.cantReset)).toBeVisible();
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
    await expect.element(complained.getByText(emailCopy.emails.purposes["forwarded-reply"])).toBeVisible();
    const unknown = page.getByRole("row").filter({ hasText: "unknown@example.org" });
    await expect.element(unknown.getByText(emailCopy.emails.notRecorded)).toBeVisible();
    // The row holds a button alone; it opens a bubble that asks why, which Cancel closes.
    const note = bounced.getByLabelText(emailCopy.emails.note);
    const open = bounced.getByRole("button", { name: emailCopy.emails.unblockOpen });
    const unblock = bounced.getByRole("button", { name: emailCopy.emails.unblock, exact: true });
    await expect.element(note).not.toBeVisible();
    await open.click();
    await expect.element(note).toBeVisible();
    await bounced.getByRole("button", { name: emailCopy.emails.cancel }).click();
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
    await expect.element(page.getByText(`${emailCopy.emails.letterTo} Bouncy McTestface MP`)).toBeVisible();
    expect(document.querySelector('a[href^="/staff/letters"]')).toBeNull();
  });

  it("says when there are none", async () => {
    await render(<EmailBlocksTable blocks={[]} unblock={vi.fn()} letterLinks />);
    await expect.element(page.getByText(emailCopy.emails.noBlocks)).toBeVisible();
  });
});

describe("each list's download values and contact cards", () => {
  const values = <Row,>(columns: DownloadColumn<Row>[], row: Row) =>
    Object.fromEntries(columns.filter((c) => c.text).map((c) => [c.key, c.text!(row)]));

  it("blocked addresses: whose, and the email that found them out, or nothing", () => {
    const columns = blockColumns(false);
    expect(values(columns, exampleBlock)).toMatchObject({
      whose: "Bouncy McTestface MP",
      sent: `${emailCopy.emails.letterTo} Bouncy McTestface MP`,
    });
    expect(values(columns, exampleComplaint).sent).toBe(emailCopy.emails.purposes["forwarded-reply"]);
    expect(values(columns, { ...exampleComplaint, politicians: exampleBlock.politicians }).whose).toBe(
      "Bouncy McTestface MP; Jane Example",
    );
    expect(values(columns, { ...exampleComplaint, supporters: [{ id: 8, name: null }] }).whose).toBe(
      supportersCopy.supporters.noName,
    );
    expect(values(columns, { ...exampleComplaint, purpose: null }).sent).toBeNull();
    // After its reason, in brackets, who told us.
    expect(values(columns, exampleBlock).reason).toBe(`${exampleBlock.reason} (${emailCopy.emails.from.postmark})`);
    expect(values(columns, exampleGmailBlock).reason).toBe(
      `${exampleGmailBlock.reason} (${emailCopy.emails.from.gmail})`,
    );
  });
});
