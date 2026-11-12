import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import PoliticianTable from "./PoliticianTable";
import { exampleAsks, examplePolitician } from "./PoliticianTable.examples";

const MP = examplePolitician;

const ask = (slug: string) => exampleAsks.find((a) => a.slug === slug)!;

describe("PoliticianTable headings", () => {
  it("sort the list, the current one marked, reversing on a second click", async () => {
    await render(
      <PoliticianTable politicians={[MP]} asks={exampleAsks} search={{ q: "x", sort: "party", dir: "asc" }} />,
    );
    const party = page.getByRole("link", { name: staffCopy.fields.party });
    await expect.element(party).toHaveAttribute("href", "/staff/politicians?q=x&sort=party&dir=desc");
    expect(party.element().closest("th")!.getAttribute("aria-sort")).toBe("ascending");
    await expect
      .element(page.getByRole("link", { name: staffCopy.fields.name }))
      .toHaveAttribute("href", "/staff/politicians?q=x&sort=name&dir=asc");
  });
});

describe("PoliticianTable", () => {
  it("lists each politician with whether they're in office and their answer to each ask, and no buttons", async () => {
    const testMp = {
      ...MP,
      id: 8,
      name: "Testy McTestface MP",
      isTest: true,
      status: "retired" as const,
      emailBlocked: true,
      house: "lords" as const,
      constituency: null,
      party: "Crossbench",
      importantTarget: false,
    };
    await render(
      <PoliticianTable
        asks={exampleAsks}
        politicians={[
          MP,
          {
            ...testMp,
            statuses: {
              "controlai-letter": { ...MP.statuses["frontier-ai-letter"], updatedBy: "controlai" },
              "frontier-ai-letter": { ...MP.statuses["frontier-ai-letter"], updatedBy: "airtable" },
            },
          },
          {
            ...testMp,
            id: 9,
            name: "Nora Nothing",
            statuses: {},
            personalConnection: true,
            airtableRemovedAt: new Date("2026-10-20T02:00:00Z"),
          },
        ]}
      />,
    );
    await expect
      .element(page.getByRole("link", { name: "Polly Placeholder" }))
      .toHaveAttribute("href", "/staff/politicians/7");
    await expect.element(page.getByText(staffCopy.politicians.flags.test).first()).toBeVisible();
    await expect.element(page.getByText(staffCopy.politicians.emailBlocked).first()).toBeVisible();
    await expect.element(page.getByRole("cell", { name: staffCopy.houses.lords }).first()).toBeVisible();
    const cells = (name: string) =>
      page
        .getByRole("row")
        .filter({ hasText: name })
        .getByRole("cell")
        .all()
        .map((c) => c.element().textContent);
    // Whether they're in office, the counts of emails to them and from them, each heading a sort, and their answer to each
    // ask they've answered, a line each, in the asks' order, the answer in bold first.
    const flags = staffCopy.politicians.flags;
    expect(cells("Polly Placeholder").slice(4, 6)).toEqual([staffCopy.personStatuses.in_office, flags.important]);
    expect(cells("Polly Placeholder").slice(7, 9)).toEqual(["4", "1"]);
    // Airtable's markers as lozenges, and a test politician's.
    expect(cells("Nora Nothing")[5]).toBe(`${flags.connection}${flags.removed}${flags.test}`);
    expect(cells("Testy McTestface MP")[5]).toBe(flags.test);
    const answers = (name: string) =>
      page
        .getByRole("row")
        .filter({ hasText: name })
        .getByRole("listitem")
        .all()
        .map((li) => li.element().textContent);
    expect(answers("Polly Placeholder")).toEqual([
      `${staffCopy.statuses.declined} ${ask("edinburgh-conference-2026").title}`,
      `${staffCopy.statuses.signed} ${ask("frontier-ai-letter").title}`,
    ]);
    expect(
      page.getByRole("row").filter({ hasText: "Polly Placeholder" }).getByText(staffCopy.statuses.declined).element()
        .tagName,
    ).toBe("STRONG");
    expect(answers("Testy McTestface MP")).toEqual([
      `${staffCopy.statuses.signed} ${ask("controlai-letter").title}`,
      `${staffCopy.statuses.signed} ${ask("frontier-ai-letter").title}`,
    ]);
    expect(cells("Testy McTestface MP")[4]).toBe(staffCopy.personStatuses.retired);
    expect(cells("Nora Nothing")[6]).toBe(staffCopy.politicians.noAsks);
    expect(
      getComputedStyle(page.getByRole("cell", { name: staffCopy.personStatuses.retired }).first().element()).whiteSpace,
    ).toBe("nowrap");
    await expect
      .element(page.getByRole("link", { name: staffCopy.politicians.columns.emailsToThem }))
      .toHaveAttribute("href", "/staff/politicians?sort=letters&dir=desc");
    // The sorts keep the names saved filters hold.
    await expect
      .element(page.getByRole("link", { name: staffCopy.politicians.columns.emailsFromThem }))
      .toHaveAttribute("href", "/staff/politicians?sort=replies&dir=desc");
    expect(page.getByRole("button").all()).toHaveLength(0);
  });

  it("says when nobody matches", async () => {
    await render(<PoliticianTable politicians={[]} asks={exampleAsks} />);
    await expect.element(page.getByText(staffCopy.politicians.none)).toBeVisible();
  });

  it("leaves out only a column the filters fix, however alike the rows are", async () => {
    const plain = { ...MP, importantTarget: false };
    const headings = () => [...document.querySelectorAll("th")].map((th) => th.textContent!.replace(/( [▲▼])+$/, ""));
    const { columns } = staffCopy.politicians;
    const after = [
      staffCopy.politicians.flag,
      columns.asks,
      columns.emailsToThem,
      columns.emailsFromThem,
      columns.first,
      columns.last,
    ];
    // Rows that agree on everything still show every column, with no filter fixing one.
    const rows = [plain, { ...plain, id: 8, name: "Other" }];
    const { rerender } = await render(<PoliticianTable politicians={rows} asks={[]} search={{ status: "any" }} />);
    const { fields } = staffCopy;
    expect(headings()).toEqual([
      fields.name,
      fields.house,
      fields.constituency,
      fields.party,
      columns.status,
      ...after,
    ]);
    // A house, one party found, and one status (those in office, with none chosen) are fixed.
    await rerender(
      <PoliticianTable
        politicians={rows}
        asks={[]}
        search={{ house: "commons", party: "Labour (Co-op)", status: "" }}
      />,
    );
    expect(headings()).toEqual([fields.name, fields.constituency, ...after]);
    // Peers have no constituency. A party left out, or two found, fix nothing.
    await rerender(<PoliticianTable politicians={rows} asks={[]} search={{ house: "lords", party: "!Reform UK" }} />);
    expect(headings()).toEqual([fields.name, fields.party, columns.status, ...after]);
    await rerender(<PoliticianTable politicians={rows} asks={[]} search={{ party: ["Labour", "Green"] }} />);
    expect(headings()).toEqual([
      fields.name,
      fields.house,
      fields.constituency,
      fields.party,
      columns.status,
      ...after,
    ]);
  });
});
