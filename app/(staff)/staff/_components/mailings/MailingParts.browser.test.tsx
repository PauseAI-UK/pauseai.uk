import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { FilterPills } from "./MailingParts";
import { examplePickedGroup, examplePickedList, exampleWriterData } from "./MailingWriter.examples";
import { politiciansCopy } from "../politicians/copy";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.mailingPages;

describe("FilterPills", () => {
  it("says the filter as the list's chips do, the house first", async () => {
    await render(<FilterPills data={exampleWriterData} />);
    const pills = page.getByRole("list", { name: copy.whoLabel });
    await expect.element(pills.getByText(staffVocabulary.houses.commons)).toBeVisible();
    await expect.element(pills.getByText("Example Letter to the PM", { exact: false })).toBeVisible();
    expect(pills.getByRole("listitem").all()).toHaveLength(3);
  });

  it("puts a search in its own pill", async () => {
    await render(
      <FilterPills data={{ ...exampleWriterData, filter: { list: "politicians", params: { q: "smith" } } }} />,
    );
    await expect.element(page.getByRole("listitem")).toHaveTextContent(copy.searchPill("smith"));
  });

  it("says everyone in office for a filter of nothing", async () => {
    await render(<FilterPills data={{ ...exampleWriterData, filter: { list: "politicians", params: {} } }} />);
    await expect.element(page.getByText(copy.everyone)).toBeVisible();
  });

  it("says those ticked from a filter as its group on the day, with those added and taken off", async () => {
    const { rerender } = await render(<FilterPills data={examplePickedGroup} />);
    const words = () =>
      page
        .getByRole("listitem")
        .all()
        .map((item) => item.element().textContent);
    expect(words()).toEqual([
      staffVocabulary.houses.commons,
      staffVocabulary.filters.notChip(staffVocabulary.fields.party, "Labour"),
      copy.pickedFrom("3 Nov 2026", 3),
      copy.pickedPlus("Morag Example"),
      copy.pickedExcept("Ned Noaddress"),
    ]);
    // A group of everyone, and one ticked whose name isn't known, by their ID.
    const from = { params: {}, at: "2026-11-03T10:00:00Z", found: [7] };
    await rerender(
      <FilterPills
        data={{ ...examplePickedGroup, filter: { list: "politicians", params: {}, picked: { ids: [7, 99], from } } }}
      />,
    );
    await expect.poll(words).toEqual([copy.everyone, copy.pickedFrom("3 Nov 2026", 1), copy.pickedPlus("#99")]);
  });

  it("says those ticked by name, alphabetically, past the first ten as a count; or that no one is", async () => {
    const { rerender } = await render(<FilterPills data={examplePickedList} />);
    const words = () =>
      page
        .getByRole("listitem")
        .all()
        .map((item) => item.element().textContent);
    expect(words()).toEqual(["Dora Dummy", "Jane Smith", "Morag Example", "Polly Placeholder"]);
    const ids = Array.from({ length: 12 }, (_, i) => 100 + i);
    const names = Object.fromEntries(ids.map((id) => [id, `Person ${id}`]));
    await rerender(
      <FilterPills
        data={{ ...examplePickedList, names, filter: { list: "politicians", params: {}, picked: { ids } } }}
      />,
    );
    await expect.poll(() => words().at(-1)).toBe(copy.pickedMore(2));
    expect(words()).toHaveLength(11);
    await rerender(
      <FilterPills data={{ ...examplePickedList, filter: { list: "politicians", params: {}, picked: { ids: [] } } }} />,
    );
    await expect.element(page.getByText(politiciansCopy.choosing.pickedNone)).toBeVisible();
  });
});
