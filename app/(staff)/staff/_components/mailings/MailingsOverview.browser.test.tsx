import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { mailingGroups } from "@/lib/mailings/groups";
import MailingsOverview from "./MailingsOverview";
import { exampleDraft, exampleMailings, exampleScheduled, exampleSending } from "./MailingsTable.examples";
import { asksCopy } from "@/lib/asks/copy";
import { mailingsCopy } from "./copy";
import { lettersCopy } from "../letters/copy";

const copy = mailingsCopy.mailingPages;
const states = lettersCopy.copyStates;

describe("MailingsOverview", () => {
  const now = "2026-10-30T12:00:00Z";
  const groups = mailingGroups(
    {
      drafts: [exampleDraft, { ...exampleDraft, id: 7, title: "" }],
      comingUp: [exampleScheduled, exampleSending],
      sent: [...exampleMailings, { ...exampleMailings[1], id: 9, sentAt: new Date("2025-07-09T10:00:00Z") }],
    },
    new Date(now),
  );
  const row = (title: string) => page.getByRole("listitem").filter({ hasText: title });

  it("says who it's from isn't recorded for one the import of old letters made", async () => {
    const mailing = { ...exampleMailings[0], imported: true, sentFrom: null, fromName: null, oldLetters: true };
    await render(
      <MailingsOverview
        groups={mailingGroups({ drafts: [], comingUp: [], sent: [mailing] }, new Date(now))}
        now={now}
      />,
    );
    await expect.element(page.getByText(mailingsCopy.mailings.notRecorded, { exact: false })).toBeVisible();
  });

  it("says who it's from by name alone for one with a name and no address", async () => {
    const mailing = { ...exampleMailings[0], imported: true, sentFrom: null, fromName: "Joseph", oldLetters: true };
    await render(
      <MailingsOverview
        groups={mailingGroups({ drafts: [], comingUp: [], sent: [mailing] }, new Date(now))}
        now={now}
      />,
    );
    await expect.element(page.getByText("Joseph", { exact: false })).toBeVisible();
    expect(document.body.textContent).not.toContain(mailingsCopy.mailings.notRecorded);
  });

  it("groups them: coming up, then by month, then by year, each row only what matters at its stage", async () => {
    await render(<MailingsOverview groups={groups} now={now} />);
    expect(
      page
        .getByRole("heading", { level: 2 })
        .all()
        .map((h) => h.element().textContent),
    ).toEqual([copy.comingUp, "October 2026", "2025"]);
    // Each says where it stands after a dot. A draft: when it was saved, and how many it's to; one untitled, said so.
    await expect.element(row("Meet us in Westminster").first()).toMatchTextContent(copy.savedAt("28 Oct 2026"));
    await expect.element(row("Meet us in Westminster").first()).toMatchTextContent(copy.standing.draft(412));
    await expect.element(page.getByRole("link", { name: copy.untitled })).toHaveAttribute("href", "/staff/mailings/7");
    // Scheduled: when it goes, and how many it's to, its dot blue.
    await expect.element(row("Edinburgh: one week to go")).toMatchTextContent("Fri 30 Oct, 09:03");
    await expect.element(row("Edinburgh: one week to go")).toMatchTextContent(copy.standing.scheduled(72));
    expect(row("Edinburgh: one week to go").element().querySelector("i[data-tone=blue]")).not.toBeNull();
    // Sent, to how many.
    await expect.element(row("AI safety conference")).toMatchTextContent(copy.standing.sent(12));
    // Sending: its bar, leading to it.
    await expect.element(page.getByRole("progressbar", { name: copy.sentLabel })).toHaveAttribute("value", "214");
    await expect.element(page.getByText(copy.sendingBar(209, 650))).toBeVisible();
    // Sent: what needs a look, opening it with that tab chosen, and the rest folded behind how many are fine; the
    // day without this year. One with no letters has no counts.
    await expect
      .element(row("AI safety conference").getByRole("link", { name: `2 ${states.counts.unreached}` }))
      .toHaveAttribute("href", "/staff/mailings/4?tab=unreached");
    await expect.element(row("AI safety conference")).toMatchTextContent(states.andFine(10));
    await expect.element(row("AI safety conference")).toMatchTextContent("20 Oct");
    await expect.element(row("AI safety conference")).not.toMatchTextContent("20 Oct 2026");
    await expect.element(row("Ben Lake").first()).not.toMatchTextContent(states.allFine(0));
    expect(row("Ben Lake").first().element().querySelector("a[href*='tab=']")).toBeNull();
    // Last year's, with its year.
    await expect.element(row("Ben Lake").last()).toMatchTextContent("9 Jul 2025");
    // Who it's from, or Airtable, and its ask, leading to who answered it.
    await expect
      .element(row("Nov 26"))
      .toMatchTextContent(`${mailingsCopy.mailings.imported} · ${asksCopy.asks.askTo.event}`);
    // And who wrote it, as most go from the policy inbox.
    await expect
      .element(row("AI safety conference"))
      .toMatchTextContent(`Jo Example <jo@pauseai.uk> · ${copy.by("jo@pauseai.uk")} · `);
    // With no name of its own, its address alone.
    await expect.element(row("Edinburgh: one week to go")).toMatchTextContent("jo@pauseai.uk");
    await expect.element(row("Edinburgh: one week to go")).not.toMatchTextContent("<jo@pauseai.uk>");
    await expect
      .element(row("Edinburgh: one week to go").getByRole("link", { name: "Edinburgh conference" }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("link", { name: "Edinburgh conference" }).first())
      .toHaveAttribute("href", "/staff/asks/edinburgh-conference-2026");
    // Nothing on it changes a mailing: its only buttons unfold how many are fine.
    expect(page.getByRole("button").all().length).toBeGreaterThan(0);
    expect(
      page
        .getByRole("button")
        .all()
        .every((button) => button.element().hasAttribute("aria-expanded")),
    ).toBe(true);
  });

  it("an ask with no sender says only the ask", async () => {
    const lone = {
      ...exampleMailings[1],
      id: 10,
      ask: "frontier-ai-letter",
      askTitle: "Frontier AI letter",
      askKind: "letter",
    };
    await render(
      <MailingsOverview groups={mailingGroups({ drafts: [], comingUp: [], sent: [lone] }, new Date(now))} now={now} />,
    );
    await expect.element(row("Ben Lake")).toMatchTextContent(`${asksCopy.asks.askTo.letter} Frontier AI letter`);
    await expect.element(row("Ben Lake")).not.toMatchTextContent(" · ");
  });

  it("says who wrote one with no sender, before its ask", async () => {
    const lone = {
      ...exampleMailings[1],
      id: 11,
      createdBy: "sam@pauseai.uk",
      ask: "frontier-ai-letter",
      askKind: "letter",
    };
    await render(
      <MailingsOverview groups={mailingGroups({ drafts: [], comingUp: [], sent: [lone] }, new Date(now))} now={now} />,
    );
    await expect
      .element(row("Ben Lake"))
      .toMatchTextContent(`${copy.by("sam@pauseai.uk")} · ${asksCopy.asks.askTo.letter}`);
  });

  it("says when there are none", async () => {
    await render(<MailingsOverview groups={[]} now={now} />);
    await expect.element(page.getByText(mailingsCopy.mailings.none)).toBeVisible();
  });
});
