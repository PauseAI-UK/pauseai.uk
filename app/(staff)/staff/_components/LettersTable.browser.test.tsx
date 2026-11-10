import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { campaigns } from "@/lib/content/email-your-mp";
import { staffTime } from "@/lib/staff-time";
import { staffCopy } from "@/lib/content/staff-interface";
import LettersTable from "./LettersTable";
import { exampleLetter } from "./LettersTable.examples";

const [pm] = campaigns;

describe("LettersTable", () => {
  const letter = exampleLetter;

  it("lists letters with their status, each leading to its page", async () => {
    await render(
      <LettersTable
        letters={[
          letter,
          {
            ...letter,
            id: 2,
            campaign: "gone",
            campaignTitle: "Gone, from pauseai.info",
            status: "odd",
            isTest: false,
            backend: "airtable",
            ownWords: 0.624,
            sentAt: null,
            repliedAt: new Date("2026-10-13T09:00:00Z"),
            autoRepliedAt: new Date("2026-10-12T10:00:00Z"),
            events: [{ at: letter.createdAt, status: "strange", details: {} }],
          },
        ]}
      />,
    );
    await expect.element(page.getByText("jane@example.com").first()).toBeInTheDocument();
    // What sent each: Postmark, or for one sent through pauseai.info's old form, Airtable.
    await expect.element(page.getByRole("cell", { name: staffCopy.letters.backends.postmark })).toBeVisible();
    await expect.element(page.getByRole("cell", { name: staffCopy.letters.backends.airtable })).toBeVisible();
    // The campaign leads to its page here, the MP to their page, the sender to their supporter.
    await expect
      .element(page.getByRole("link", { name: pm.title }).first())
      .toHaveAttribute("href", `/staff/campaigns/${pm.slug}`);
    await expect
      .element(page.getByRole("link", { name: letter.mpName }).first())
      .toHaveAttribute("href", "/staff/politicians/3");
    await expect
      .element(page.getByRole("link", { name: letter.senderName }).first())
      .toHaveAttribute("href", "/staff/supporters/7");
    await expect.element(page.getByRole("cell", { name: /^Gone, from pauseai.info/ })).toBeInTheDocument();
    // How much of each is the sender's own words.
    await expect.element(page.getByRole("cell", { name: "18%", exact: true })).toBeInTheDocument();
    await expect.element(page.getByRole("cell", { name: "62%", exact: true })).toBeInTheDocument();
    expect(document.body.textContent).toContain("odd");
    await expect
      .element(page.getByRole("link", { name: staffCopy.mailingPages.theLetter }).nth(1))
      .toHaveAttribute("href", "/staff/letters/2");
    // Its history is on its page; when it was sent, or a dash.
    expect(document.body.textContent).not.toContain("strange");
    await expect
      .element(page.getByRole("link", { name: staffCopy.mailingPages.theLetter }).first())
      .toHaveAttribute("href", "/staff/letters/1");
    await expect.element(page.getByRole("cell", { name: staffTime(letter.sentAt!), exact: true })).toBeInTheDocument();
    await expect.element(page.getByRole("cell", { name: "–", exact: true })).toBeInTheDocument();
    expect(page.getByText(staffCopy.politicians.flags.test).all()).toHaveLength(1);
    await expect.element(page.getByRole("cell", { name: "13 Oct 2026, 09:00", exact: true })).toBeInTheDocument();
    // The written reply's, though an automatic one came first.
    expect(document.body.textContent).not.toContain("12 Oct 2026, 10:00");
  });

  it("says when only an automatic reply came, greyed, with when", async () => {
    await render(<LettersTable letters={[{ ...letter, autoRepliedAt: new Date("2026-10-12T11:00:00Z") }]} />);
    const muted = document.querySelector("tbody tr td:last-child span")!;
    expect(muted.textContent).toBe(`${staffCopy.letters.status.auto_reply}12 Oct 2026, 11:00`);
    expect(muted.querySelector("br")).not.toBeNull();
  });

  it("says when there are none", async () => {
    await render(<LettersTable letters={[]} />);
    await expect.element(page.getByText(staffCopy.letters.none)).toBeVisible();
  });
});

describe("LettersTable, a letter nothing has sent yet", () => {
  it("shows a dash for its backend, as for when it was sent", async () => {
    await render(<LettersTable letters={[{ ...exampleLetter, status: "queued", backend: null, sentAt: null }]} />);
    const row = page.getByRole("row").nth(1);
    expect(row.getByText("–").all()).toHaveLength(2);
  });
});

describe("LettersTable, a letter with no draft", () => {
  it("has a dash for its own words", async () => {
    await render(<LettersTable letters={[{ ...exampleLetter, ownWords: null }]} />);
    const ownWords = [...document.querySelectorAll("thead th")].findIndex(
      (th) => th.textContent === staffCopy.letters.columns.ownWords,
    );
    expect(document.querySelector("tbody tr")!.children[ownWords].textContent).toBe("–");
  });
});

describe("LettersTable, a sender not yet a supporter", () => {
  it("shows the name without a link", async () => {
    await render(<LettersTable letters={[{ ...exampleLetter, supporterId: null }]} />);
    await expect.element(page.getByText(exampleLetter.senderName, { exact: false })).toBeVisible();
    expect(page.getByRole("link", { name: exampleLetter.senderName }).all()).toHaveLength(0);
  });
});
