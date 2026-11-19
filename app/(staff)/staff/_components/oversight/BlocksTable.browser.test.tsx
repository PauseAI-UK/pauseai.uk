import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import BlocksTable, { blockColumns } from "./BlocksTable";
import {
  exampleBlock,
  exampleBroadcastBlock,
  exampleComplaint,
  exampleGmailBlock,
  exampleHold,
  exampleMailboxBlock,
  exampleNumber,
  listed,
} from "./BlocksTable.examples";
import type { Block } from "@/lib/oversight/blocks.server";
import { BLOCKS_PAGE_SIZE } from "@/lib/email/block-filters";
import { action } from "@/tests/browser/staff";
import { supportersCopy } from "../supporters/copy";
import { emailCopy } from "@/lib/email/copy";
import { type DownloadColumn } from "@/lib/staff-list";
import { staffVocabulary } from "@/lib/staff-vocabulary";

const copy = emailCopy.emails;

/** The table of `blocks`, on its first page, unblocking by `unblock`. */
function table(blocks: Block[], unblock: (form: FormData) => void = vi.fn(), letterLinks = true) {
  return render(
    <BlocksTable
      list={{ total: blocks.length, blocks }}
      page={1}
      href={(n) => `/blocks?page=${n}`}
      unblock={unblock}
      letterLinks={letterLinks}
    />,
  );
}

const rowOf = (text: string) => page.getByRole("row").filter({ hasText: text });

describe("BlocksTable", () => {
  it("lists each blocked address: why, since when, whose, the letter, emails not sent, and unblocks one", async () => {
    const { fn, sent } = action();
    await table(
      [
        listed(exampleBlock),
        listed({
          ...exampleComplaint,
          politicians: [
            { id: 1, name: "A", isTest: false },
            { id: 2, name: "B", isTest: false },
          ],
        }),
        listed({ ...exampleBlock, address: "unknown@example.org", letter: null, purpose: null }),
        listed({
          ...exampleComplaint,
          address: "two@example.org",
          supporters: [
            { id: 8, name: null },
            { id: 9, name: "Sam" },
          ],
        }),
      ],
      fn,
    );
    const bounced = rowOf(exampleBlock.address);
    await expect.element(bounced.getByText(copy.kinds.hard)).toBeVisible();
    // The reason, then who told us.
    await expect
      .element(bounced.getByRole("cell", { name: `${exampleBlock.reason} ${copy.from.postmark}` }))
      .toBeVisible();
    // Whose it is, linked to their page; and the letter that found it out, by whom it was to, linked to it alone.
    await expect
      .element(bounced.getByRole("link", { name: "Bouncy McTestface MP", exact: true }))
      .toHaveAttribute("href", "/staff/politicians/5");
    await expect
      .element(bounced.getByRole("link", { name: `${copy.letterTo} Bouncy McTestface MP` }))
      .toHaveAttribute("href", "/staff/letters/17");
    await expect.element(bounced.getByRole("cell", { name: "2", exact: true })).toBeVisible();
    // A complaint can't be unblocked; two politicians share its address, and a supporter, after them, linked too.
    const complained = rowOf(exampleComplaint.address);
    await expect.element(complained.getByText(copy.cantReset)).toBeVisible();
    await expect.element(complained.getByText("A, B, Jane Example")).toBeVisible();
    await expect
      .element(complained.getByRole("link", { name: "Jane Example" }))
      .toHaveAttribute("href", "/staff/supporters/7");
    // Two supporters, one with no name.
    const two = rowOf("two@example.org");
    await expect.element(two.getByText(`${supportersCopy.supporters.noName}, Sam`)).toBeVisible();
    await expect
      .element(two.getByRole("link", { name: supportersCopy.supporters.noName }))
      .toHaveAttribute("href", "/staff/supporters/8");
    // What the email was: a letter, another of ours, or one the site has no record of.
    await expect.element(complained.getByText(copy.purposes["forwarded-reply"])).toBeVisible();
    await expect.element(rowOf("unknown@example.org").getByText(copy.notRecorded)).toBeVisible();
    // The row holds buttons alone; Unblock opens a bubble that asks why, which Cancel closes.
    const note = bounced.getByLabelText(copy.note);
    const open = bounced.getByRole("button", { name: copy.unblockOpen });
    const unblock = bounced.getByRole("button", { name: copy.unblock, exact: true });
    await expect.element(note).not.toBeVisible();
    await open.click();
    await expect.element(note).toBeVisible();
    await bounced.getByRole("button", { name: copy.cancel }).click();
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

  it("lists a number WhatsApp couldn't reach: as written in the UK, by text, when texts try it again, and the broadcast", async () => {
    const { fn, sent } = action();
    await table([{ ...exampleNumber, triesFrom: new Date("2099-01-02T10:00:00Z") }], fn);
    const row = rowOf("07700 900123");
    await expect.element(row.getByText(copy.kinds["not-on-whatsapp"])).toBeVisible();
    // The icon says it's a text; its words say what blocked it.
    expect(row.getByRole("cell").nth(2).element().querySelector("svg")).not.toBeNull();
    await expect.element(row.getByText(copy.from.whatsapp)).toBeVisible();
    await expect
      .element(row.getByRole("link", { name: `${copy.purposes.broadcast}: Join us in Manchester` }))
      .toHaveAttribute("href", "/staff/broadcasts/9/41");
    // A number is unblocked by its number as kept.
    await row.getByRole("button", { name: copy.unblockOpen }).click();
    await row.getByLabelText(copy.note).fill("On WhatsApp now");
    await row.getByRole("button", { name: copy.unblock, exact: true }).click();
    await vi.waitFor(() => expect(sent).toEqual([{ address: "+447700900123", note: "On WhatsApp now" }]));
  });

  it("says texts try a number again from a day to come, or with the next text once that's past", () => {
    const reason = (triesFrom: Date) => values(blockColumns(true), { ...exampleNumber, triesFrom }).reason;
    expect(reason(new Date("2099-01-02T10:00:00Z"))).toBe(`${copy.triesFrom("2 Jan 2099")} (${copy.from.whatsapp})`);
    expect(reason(new Date("2000-01-02T10:00:00Z"))).toBe(`${copy.triesNext} (${copy.from.whatsapp})`);
  });

  it("says what found an address out when the site sent nothing: a hold, or a mailbox's own email", async () => {
    await table([exampleHold, exampleMailboxBlock]);
    await expect.element(rowOf(exampleHold.address).getByText(copy.held)).toBeVisible();
    await expect
      .element(rowOf(exampleMailboxBlock.address).getByText(copy.fromMailbox("joseph@pauseai.uk")))
      .toBeVisible();
  });

  it("opens each row's history: bounces with the mailbox they were found in, texts refused and skipped, unblocks", async () => {
    await table([exampleBroadcastBlock, exampleNumber, { ...exampleHold, history: [] }]);
    const bounced = rowOf(exampleBroadcastBlock.address);
    const history = page.getByRole("list", { name: `${copy.history.open}: ${exampleBroadcastBlock.address}` });
    // A closed bubble is out of the accessibility tree.
    expect(history.query()).toBeNull();
    await bounced.getByRole("button", { name: copy.history.open }).click();
    await expect.element(history).toBeVisible();
    await expect.element(history.getByText(`${copy.kinds.hard}: Unknown user`)).toBeVisible();
    await expect
      .element(history.getByText(`${copy.kinds.soft}: Mailbox full (${copy.history.readFrom("jo@pauseai.uk")})`))
      .toBeVisible();
    // A number's: what WhatsApp refused and what was skipped, each linked to its copy, and an unblock with its note.
    await userEvent.keyboard("{Escape}");
    await rowOf("07700 900123").getByRole("button", { name: copy.history.open }).click();
    const texts = page.getByRole("list", { name: `${copy.history.open}: ${exampleNumber.address}` });
    await expect
      .element(texts.getByRole("link", { name: "Lobby day" }))
      .toHaveAttribute("href", "/staff/broadcasts/11/52");
    await expect.element(texts.getByText(`${copy.history.skipped}: Lobby day`)).toBeVisible();
    await expect.element(texts.getByText(`${copy.history.refused}: Summer social`)).toBeVisible();
    await expect
      .element(texts.getByText(`${copy.history.unblocked("jo@pauseai.uk")}: “She's on WhatsApp now”`))
      .toBeVisible();
    // A row with nothing in its history has no button for it.
    expect(rowOf(exampleHold.address).getByRole("button", { name: copy.history.open }).query()).toBeNull();
  });

  it("names the letter without linking to it, without letter links", async () => {
    await table([listed(exampleBlock)], vi.fn(), false);
    await expect.element(page.getByText(`${copy.letterTo} Bouncy McTestface MP`)).toBeVisible();
    expect(document.querySelector('a[href^="/staff/letters"]')).toBeNull();
  });

  it("shows a page of them, and the way to the others", async () => {
    await render(
      <BlocksTable
        list={{ total: BLOCKS_PAGE_SIZE + 1, blocks: [listed(exampleBlock)] }}
        page={2}
        href={(n) => `/blocks?page=${n}`}
        unblock={vi.fn()}
        letterLinks
      />,
    );
    await expect.element(page.getByText(copy.count(BLOCKS_PAGE_SIZE + 1))).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.previous }))
      .toHaveAttribute("href", "/blocks?page=1");
  });

  it("says when there are none", async () => {
    await table([]);
    await expect.element(page.getByText(copy.noBlocks)).toBeVisible();
  });
});

const values = <Row,>(columns: DownloadColumn<Row>[], row: Row) =>
  Object.fromEntries(columns.filter((c) => c.text).map((c) => [c.key, c.text!(row)]));

describe("each list's download values and contact cards", () => {
  it("blocked addresses: whose, and the email that found them out, or nothing", () => {
    const columns = blockColumns(false);
    expect(values(columns, listed(exampleBlock))).toMatchObject({
      whose: "Bouncy McTestface MP",
      sent: `${copy.letterTo} Bouncy McTestface MP`,
    });
    expect(values(columns, listed(exampleComplaint)).sent).toBe(copy.purposes["forwarded-reply"]);
    expect(values(columns, listed({ ...exampleComplaint, politicians: exampleBlock.politicians })).whose).toBe(
      "Bouncy McTestface MP; Jane Example",
    );
    expect(values(columns, listed({ ...exampleComplaint, supporters: [{ id: 8, name: null }] })).whose).toBe(
      supportersCopy.supporters.noName,
    );
    expect(values(columns, listed({ ...exampleComplaint, purpose: null })).sent).toBeNull();
    // After its reason, in brackets, who told us.
    expect(values(columns, listed(exampleBlock)).reason).toBe(`${exampleBlock.reason} (${copy.from.postmark})`);
    expect(values(columns, listed(exampleGmailBlock)).reason).toBe(`${exampleGmailBlock.reason} (${copy.from.gmail})`);
    expect(values(columns, exampleHold).reason).toBe(`${exampleHold.reason} (${copy.from.civicrm})`);
    // A number as kept, in international format.
    expect(values(columns, exampleNumber).address).toBe("+447700900123");
  });
});
