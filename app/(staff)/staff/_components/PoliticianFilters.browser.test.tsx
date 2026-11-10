import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { ASK_STATUSES } from "@/lib/asks";
import { staffCopy } from "@/lib/content/staff-interface";
import PoliticianFilters from "./PoliticianFilters";
import { exampleAsks, emptyPoliticiansSearch } from "./PoliticianTable.examples";
import { chips, menu } from "@/tests/browser/staff";

const ask = (slug: string) => exampleAsks.find((a) => a.slug === slug)!;

describe("PoliticianFilters", () => {
  const copy = staffCopy.politicians;

  it("is nothing where hidden, as on the tab of those ticked", async () => {
    const { container } = await render(
      <PoliticianFilters search={emptyPoliticiansSearch} asks={exampleAsks} parties={[]} hidden />,
    );
    expect(container.innerHTML).toBe("");
  });

  const search = {
    ...emptyPoliticiansSearch,
    q: "blake",
    house: "lords",
    status: "retired",
    party: ["Labour"],
    ask: "edinburgh-conference-2026",
    answer: ["declined"],
    sort: "asks",
    dir: "asc",
    page: "2",
  };

  it("has a chip for each filter on, the ask and its answer one, and Clear filters keeping the house", async () => {
    await render(<PoliticianFilters search={search} asks={exampleAsks} parties={["Green", "Labour"]} />);
    const edinburgh = ask("edinburgh-conference-2026").title;
    expect(chips()).toEqual([
      `${staffCopy.fields.party}: Labour`,
      `${copy.status}: ${staffCopy.personStatuses.retired}`,
      edinburgh,
      staffCopy.statuses.declined,
    ]);
    // Any answer, then the answers of the ask's kind, and none; another ask takes the answer away.
    expect((await menu(staffCopy.statuses.declined)).map(([text]) => text)).toEqual([
      copy.anyAnswer,
      ...ASK_STATUSES.event.map((s) => staffCopy.statuses[s]),
      copy.noAnswer,
    ]);
    const asks = await menu(edinburgh);
    expect(asks.find(([text]) => text === ask("frontier-ai-letter").title)![1]).toBe(
      "/staff/politicians?q=blake&house=lords&status=retired&party=Labour&ask=frontier-ai-letter&sort=asks&dir=asc",
    );
    // Status goes back to those in office by its blank choice.
    expect((await menu(`${copy.status}: ${staffCopy.personStatuses.retired}`))[0]).toEqual([
      staffCopy.personStatuses.in_office,
      "/staff/politicians?q=blake&house=lords&party=Labour&ask=edinburgh-conference-2026&answer=declined&sort=asks&dir=asc",
    ]);
    // The party can be chosen again, from those not chosen; the other filters not on are there too.
    const add = await menu(staffCopy.filters.add);
    expect(add.map(([text]) => text)).toEqual([
      ...Object.values(staffCopy.countries),
      "Green",
      ...Object.values(copy.emailStates),
      ...Object.values(copy.flags),
      // Those mailed about each ask.
      ...exampleAsks.map((ask) => ask.title),
    ]);
    expect(add.find(([text]) => text === "Green")![1]).toBe(
      "/staff/politicians?q=blake&house=lords&status=retired&party=Labour&party=Green&ask=edinburgh-conference-2026&answer=declined&sort=asks&dir=asc",
    );
    await expect
      .element(page.getByRole("link", { name: staffCopy.resetFilters }))
      .toHaveAttribute("href", "/staff/politicians?house=lords");
  });

  it("offers an answer only once there's an ask", async () => {
    await render(<PoliticianFilters search={emptyPoliticiansSearch} asks={exampleAsks} parties={["Green"]} />);
    const groups = () => [...document.querySelectorAll("#filter-add details > summary")].map((p) => p.textContent);
    await page.getByRole("button", { name: staffCopy.filters.add }).click();
    expect(groups()).toEqual([
      staffCopy.politician.country,
      staffCopy.fields.party,
      copy.status,
      staffCopy.fields.email,
      copy.flag,
      copy.ask,
      copy.mailed,
    ]);
    expect(page.getByRole("link", { name: staffCopy.resetFilters }).query()).toBeNull();
  });
});

describe("PoliticianFilters, chosen more than once", () => {
  it("has one chip for the parties, which opens as boxes and removes them", async () => {
    await render(
      <PoliticianFilters
        search={{ ...emptyPoliticiansSearch, party: ["Green", "Labour"] }}
        asks={exampleAsks}
        parties={["Green", "Labour", "Reform UK"]}
      />,
    );
    const party = staffCopy.fields.party;
    const both = `${party}: ${staffCopy.filters.anyOf(["Green", "Labour"])}`;
    expect(chips()).toEqual([both]);
    const chip = await menu(both);
    expect(chip.find(([text]) => text === staffCopy.filters.remove)![1]).toBe("/staff/politicians");
    // Several are chosen, so its rows are boxes, those two ticked, and no row is a link to swap to.
    const boxes = [...document.querySelectorAll<HTMLInputElement>("[popover]:popover-open input[type=checkbox]")];
    expect(boxes.map((box) => box.checked)).toEqual([true, true, false]);
    await userEvent.keyboard("{Escape}");
    // + Filter offers the party not yet chosen.
    expect((await menu(staffCopy.filters.add)).map(([text]) => text)).toContain("Reform UK");
  });

  it("removes the last of a repeated filter altogether", async () => {
    await render(
      <PoliticianFilters search={{ ...emptyPoliticiansSearch, flag: ["important"] }} asks={exampleAsks} parties={[]} />,
    );
    const chip = `${staffCopy.politicians.flag}: ${staffCopy.politicians.flags.important}`;
    expect((await menu(chip)).find(([text]) => text === staffCopy.filters.remove)![1]).toBe("/staff/politicians");
  });
});
