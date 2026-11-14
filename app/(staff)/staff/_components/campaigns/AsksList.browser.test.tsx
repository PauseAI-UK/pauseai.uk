import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import AsksList from "./AsksList";
import { campaignsCopy } from "@/lib/campaigns/copy";
import { exampleAsks, exampleAsksWithCounts } from "./AsksList.examples";

describe("AsksList", () => {
  const lozenge = (status: string, n: number) => `${n} ${status.toLocaleLowerCase("en-GB")}`;

  it("picks out the ask a link led to: its row, by its slug, tinted and current", async () => {
    await render(
      <AsksList now={new Date("2026-11-06T12:00:00Z")} asks={exampleAsksWithCounts} picked={exampleAsks[1].slug} />,
    );
    const current = document.querySelectorAll("li[aria-current=true]");
    expect([...current].map((row) => row.id)).toEqual([exampleAsks[1].slug]);
    expect(document.getElementById(exampleAsks[0].slug)!.hasAttribute("aria-current")).toBe(false);
  });

  it("lists each ask: who asked them to do what, how many replied, title linked to its page, each answer's count, the campaigns and mailings linked, and who asks it", async () => {
    const copy = campaignsCopy.asks;
    await render(<AsksList now={new Date("2026-11-06T12:00:00Z")} asks={exampleAsksWithCounts} />);
    const row = (title: string) => page.getByRole("listitem").filter({ hasText: title }).first();
    const text = (title: string) => row(title).element().textContent;
    // Its date, who asked them to do what, its answers in the kind's order, and how it stands.
    const first = text(exampleAsks[0].title);
    expect(first).toContain(campaignsCopy.asks.askedThem(copy.askedBy.pauseai, "event"));
    expect(first).toContain(`20 ${copy.page.replied}`);
    expect(first).toContain(`40 ${copy.page.lettersWord(40)}`);
    expect(first).toContain(
      `${lozenge(staffVocabulary.statuses.going, 3)}${lozenge(staffVocabulary.statuses.other, 1)}${lozenge(staffVocabulary.statuses.declined, 50)}`,
    );
    expect(first).toContain("1 Nov 2026");
    expect(first).toContain(`186 ${copy.page.writtenTo}`);
    // No answers, nobody written to, nor any way of asking.
    expect(text(exampleAsks[2].title)).toContain(`0 ${copy.page.replied}`);
    expect(text(exampleAsks[2].title)).toContain(lozenge(staffVocabulary.statuses.noAnswer, 4));
    expect(text(exampleAsks[1].title)).toContain(`0 ${copy.page.writtenTo}`);
    expect(
      row(exampleAsks[1].title)
        .getByRole("link")
        .all()
        .map((link) => link.element().getAttribute("href")),
    ).not.toContain("/staff/campaigns/open-letter");
    // No date; asked by both, and each campaign and mailing that asked it leads to its own page.
    expect(text(exampleAsks[3].title)).toContain(
      campaignsCopy.asks.askedThem(`${copy.askedBy.supporters} and ${copy.askedBy.pauseai}`, "letter"),
    );
    expect(
      row(exampleAsks[3].title)
        .getByRole("link")
        .all()
        .map((link) => link.element().getAttribute("href")),
    ).toEqual(expect.arrayContaining(["/staff/campaigns/open-letter", "/staff/mailings/3", "/staff/mailings/4"]));
    // Each kind under its own heading, and no heading for a kind it hasn't any of.
    const ways = text(exampleAsks[3].title);
    expect(ways).toContain(`${copy.waysOf.campaign}Sign the open letter`);
    expect(ways).toContain(`${copy.waysOf.mailing}First mailing about the letter`);
    expect(text(exampleAsks[0].title)).not.toContain(copy.waysOf.campaign);
    // Each leads to its own page, and each answer to its page with that answer chosen.
    await expect
      .element(row(exampleAsks[0].title).getByRole("link", { name: exampleAsks[0].title }))
      .toHaveAttribute("href", `/staff/asks/${exampleAsks[0].slug}`);
    await expect
      .element(row(exampleAsks[0].title).getByRole("link", { name: lozenge(staffVocabulary.statuses.other, 1) }))
      .toHaveAttribute("href", `/staff/asks/${exampleAsks[0].slug}?answer=other`);
    await expect
      .element(page.getByRole("link", { name: lozenge(staffVocabulary.statuses.noAnswer, 132) }))
      .toHaveAttribute("href", expect.stringMatching(/\?answer=none$/));
    // How far it has gone, a sentence after a dot.
    expect(first).toContain(`186 ${copy.page.writtenTo} · 40 ${copy.page.lettersWord(40)} · 20 ${copy.page.replied}`);
    expect(page.getByRole("status").query()).toBeNull();
  });

  it("puts events to come under a heading, the rest under their months, and those with no day under none", async () => {
    const copy = campaignsCopy.asks;
    const undated = { ...exampleAsksWithCounts[2], date: null };
    await render(
      <AsksList
        now={new Date("2026-10-01T12:00:00Z")}
        asks={[...exampleAsksWithCounts.slice(0, 2), exampleAsksWithCounts[3], undated]}
      />,
    );
    await expect.element(page.getByRole("heading", { level: 2, name: copy.comingUp })).toBeVisible();
    await expect.element(page.getByRole("heading", { level: 3, name: exampleAsks[0].title })).toBeVisible();
    await expect.element(page.getByRole("heading", { level: 2, name: "November 2026" })).toBeVisible();
    await expect.element(page.getByRole("heading", { level: 2, name: undated.title })).toBeVisible();
    // A letter says the months of its letters.
    expect(document.getElementById(exampleAsks[3].slug)!.textContent).toContain("Jun–Nov 2026");
  });

  it("says how a save or delete went, and marks the one a link picked", async () => {
    const added = { ...exampleAsksWithCounts[0], slug: "winter-reception-dec-2026", title: "Winter reception" };
    const copy = campaignsCopy.asks;
    const row = () => page.getByRole("listitem").filter({ hasText: "Winter reception" }).first();
    const { rerender } = await render(
      <AsksList now={new Date("2026-11-06T12:00:00Z")} asks={[added]} notice="deleted" />,
    );
    await expect.element(page.getByRole("status")).toHaveTextContent(copy.notices.deleted);
    await expect.element(row()).not.toHaveAttribute("aria-current");
    await rerender(
      <AsksList now={new Date("2026-11-06T12:00:00Z")} asks={[added]} notice="in-use" picked={added.slug} />,
    );
    await expect.element(page.getByRole("status")).toHaveTextContent(copy.notices["in-use"]);
    await expect.element(row()).toHaveAttribute("aria-current", "true");
    await rerender(<AsksList now={new Date("2026-11-06T12:00:00Z")} asks={[{ ...added, counts: {}, noAnswer: 0 }]} />);
    await expect.element(row().getByText(copy.noAnswers)).toBeVisible();
    await rerender(<AsksList now={new Date("2026-11-06T12:00:00Z")} asks={[]} />);
    await expect.element(page.getByText(copy.none)).toBeVisible();
  });
});
