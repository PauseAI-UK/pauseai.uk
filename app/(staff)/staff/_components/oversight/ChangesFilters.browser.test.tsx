import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { changesSearch } from "@/lib/staff-search";
import ChangesFilters, { changeWords } from "./ChangesFilters";
import { chips } from "@/tests/browser/staff";

describe("ChangesFilters", () => {
  const choices = { actors: ["jo@pauseai.uk", "sync"], actions: ["add note", "edit event"] };
  const none = vi.fn();
  const actions = { save: none, update: none, rename: none, remove: none };

  it("has a search, and who, what and how recent to filter by, keeping the sort, with who and what said in words", async () => {
    const search = changesSearch({
      q: "polly",
      actor: ["jo@pauseai.uk", "sync"],
      action: "!add note",
      when: "30",
      sort: "actor",
    });
    await render(<ChangesFilters search={search} choices={choices} actions={actions} />);
    await expect.element(page.getByRole("searchbox", { name: staffCopy.changes.search })).toHaveValue("polly");
    expect(chips()).toEqual([
      "When: Last 30 days",
      "Who: jo@pauseai.uk or sync",
      staffVocabulary.filters.notChip("What", "add note"),
    ]);
    expect(changeWords(search)).toEqual([
      `${staffVocabulary.search}: polly`,
      "When: Last 30 days",
      "Who: jo@pauseai.uk or sync",
      staffVocabulary.filters.notChip("What", "add note"),
    ]);
    await page.getByRole("button", { name: "When: Last 30 days" }).click();
    expect(document.querySelector("[popover]:popover-open a")!.getAttribute("href")).toContain("sort=actor");
  });

  it("offers saved filters, each summed up in those words, to those given them", async () => {
    const row = {
      id: 4,
      name: "Sam's notes",
      params: { actor: "sam@pauseai.uk", action: ["add note", "edit event"], sort: "day" },
      createdBy: "jo@pauseai.uk",
      createdAt: new Date("2026-10-01T09:00:00Z"),
      changedAt: new Date("2026-10-01T09:00:00Z"),
    };
    await render(
      <ChangesFilters
        search={changesSearch({ actor: "sam@pauseai.uk" })}
        choices={choices}
        saved={{ rows: [row], params: {} }}
        actions={actions}
      />,
    );
    await page.getByRole("button", { name: staffVocabulary.filters.saved.chip, exact: true }).click();
    await expect
      .element(page.getByRole("link", { name: /Sam's notes/ }))
      .toHaveAttribute("href", expect.stringContaining("/staff/audit-log?"));
    await expect.element(page.getByText("Who: sam@pauseai.uk · What: add note or edit event")).toBeVisible();
  });
});
