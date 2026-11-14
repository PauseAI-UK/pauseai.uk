import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { type DownloadColumn } from "@/lib/staff-list";
import { politicianWords } from "./PoliticianFilters";
import PoliticianTable, { politicianColumns, politicianContact } from "./PoliticianTable";
import { emptyPoliticiansSearch, examplePolitician } from "./PoliticianTable.examples";
import { politiciansCopy } from "./copy";
import { PoliticianTableEmptyExample, PoliticianTableExample } from "./PoliticianTable.gallery.client";
import { exampleAsks } from "../asks/AsksList.examples";

const MP = examplePolitician;

const ask = (slug: string) => exampleAsks.find((a) => a.slug === slug)!;

describe("PoliticianTable headings", () => {
  it("sort the list, the current one marked, reversing on a second click", async () => {
    await render(
      <PoliticianTable politicians={[MP]} asks={exampleAsks} search={{ q: "x", sort: "party", dir: "asc" }} />,
    );
    const party = page.getByRole("link", { name: staffVocabulary.fields.party });
    await expect.element(party).toHaveAttribute("href", "/staff/politicians?q=x&sort=party&dir=desc");
    expect(party.element().closest("th")!.getAttribute("aria-sort")).toBe("ascending");
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.fields.name }))
      .toHaveAttribute("href", "/staff/politicians?q=x&sort=name&dir=asc");
  });

  it.each(["letters", "replies"])("show the list by name, A to Z, for a sort it doesn't have (%s)", async (sort) => {
    await render(<PoliticianTable politicians={[MP]} asks={exampleAsks} search={{ sort, dir: "desc" }} />);
    const name = page.getByRole("link", { name: staffVocabulary.fields.name });
    expect(name.element().closest("th")!.getAttribute("aria-sort")).toBe("ascending");
    expect(document.querySelectorAll("[aria-sort]")).toHaveLength(1);
    await expect
      .element(page.getByRole("link", { name: politiciansCopy.politicians.columns.emailsToThem }))
      .toHaveAttribute("href", "/staff/politicians?sort=emailsToThem&dir=desc");
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
          },
        ]}
      />,
    );
    await expect
      .element(page.getByRole("link", { name: "Polly Placeholder" }))
      .toHaveAttribute("href", "/staff/politicians/7");
    await expect.element(page.getByText(staffVocabulary.politicianFlags.test).first()).toBeVisible();
    await expect.element(page.getByText(politiciansCopy.politicians.emailBlocked).first()).toBeVisible();
    await expect.element(page.getByRole("cell", { name: staffVocabulary.houses.lords }).first()).toBeVisible();
    const cells = (name: string) =>
      page
        .getByRole("row")
        .filter({ hasText: name })
        .getByRole("cell")
        .all()
        .map((c) => c.element().textContent);
    // Whether they're in office, the counts of emails to them and from them, each heading a sort, and their answer to each
    // ask they've answered, a line each, in the asks' order, the answer in bold first.
    const flags = staffVocabulary.politicianFlags;
    expect(cells("Polly Placeholder").slice(4, 6)).toEqual([politiciansCopy.personStatuses.in_office, flags.important]);
    expect(cells("Polly Placeholder").slice(7, 9)).toEqual(["4", "1"]);
    // Airtable's markers as lozenges, and a test politician's.
    expect(cells("Nora Nothing")[5]).toBe(`${flags.connection}${flags.test}`);
    expect(cells("Testy McTestface MP")[5]).toBe(flags.test);
    const answers = (name: string) =>
      page
        .getByRole("row")
        .filter({ hasText: name })
        .getByRole("listitem")
        .all()
        .map((li) => li.element().textContent);
    expect(answers("Polly Placeholder")).toEqual([
      `${ask("edinburgh-conference-2026").title} ${staffVocabulary.statuses.declined}`,
      `${ask("frontier-ai-letter").title} ${staffVocabulary.statuses.signed}`,
    ]);
    // The answer in bold, a no crossed and a yes ticked in green, each at its ask's right and level with the other.
    const pollys = page.getByRole("row").filter({ hasText: "Polly Placeholder" });
    const declined = pollys.getByText(staffVocabulary.statuses.declined).element();
    const signed = pollys.getByText(staffVocabulary.statuses.signed).element();
    expect(declined.closest("strong")).not.toBeNull();
    expect(getComputedStyle(declined, "::before").content).toContain("✕");
    expect(getComputedStyle(signed, "::before").content).toContain("✓");
    expect(getComputedStyle(signed).color).not.toBe(getComputedStyle(declined).color);
    expect(signed.getBoundingClientRect().left).toBe(declined.getBoundingClientRect().left);
    // The ask's title never wraps: a long one is cut off, and the whole of it is its tooltip.
    const title = signed.closest("li")!.querySelector("[title]")!;
    expect(title.getAttribute("title")).toBe(ask("frontier-ai-letter").title);
    expect(title.getBoundingClientRect().right).toBeLessThanOrEqual(signed.getBoundingClientRect().left);
    expect(getComputedStyle(title).whiteSpace).toBe("nowrap");
    expect(getComputedStyle(title).textOverflow).toBe("ellipsis");
    expect(answers("Testy McTestface MP")).toEqual([
      `${ask("controlai-letter").title} ${staffVocabulary.statuses.signed}`,
      `${ask("frontier-ai-letter").title} ${staffVocabulary.statuses.signed}`,
    ]);
    expect(cells("Testy McTestface MP")[4]).toBe(politiciansCopy.personStatuses.retired);
    expect(cells("Nora Nothing")[6]).toBe(politiciansCopy.politicians.noAsks);
    expect(
      getComputedStyle(page.getByRole("cell", { name: politiciansCopy.personStatuses.retired }).first().element())
        .whiteSpace,
    ).toBe("nowrap");
    await expect
      .element(page.getByRole("link", { name: politiciansCopy.politicians.columns.emailsToThem }))
      .toHaveAttribute("href", "/staff/politicians?sort=emailsToThem&dir=desc");
    await expect
      .element(page.getByRole("link", { name: politiciansCopy.politicians.columns.emailsFromThem }))
      .toHaveAttribute("href", "/staff/politicians?sort=emailsFromThem&dir=desc");
    // A count's heading breaks only after its first word, however narrow its column: the rest stays on one line.
    for (const label of [
      politiciansCopy.politicians.columns.emailsToThem,
      politiciansCopy.politicians.columns.emailsFromThem,
    ]) {
      const together = page.getByRole("link", { name: label }).element().querySelector("span")!;
      expect(together.firstChild!.textContent).toBe(label.split(" ").slice(1).join(" "));
      expect(getComputedStyle(together).whiteSpace).toBe("nowrap");
    }
    // The other headings break where they like.
    expect(page.getByRole("link", { name: politiciansCopy.politicians.columns.first }).element().children).toHaveLength(
      1,
    );
    expect(page.getByRole("button").all()).toHaveLength(0);
  });

  it("says when nobody matches", async () => {
    await render(<PoliticianTable politicians={[]} asks={exampleAsks} />);
    await expect.element(page.getByText(politiciansCopy.politicians.none)).toBeVisible();
  });

  it("leaves out only a column the filters fix, however alike the rows are", async () => {
    const plain = { ...MP, importantTarget: false };
    const headings = () => [...document.querySelectorAll("th")].map((th) => th.textContent!.replace(/( [▲▼])+$/, ""));
    const { columns } = politiciansCopy.politicians;
    const after = [
      politiciansCopy.politicians.flag,
      columns.asks,
      columns.emailsToThem,
      columns.emailsFromThem,
      columns.first,
      columns.last,
    ];
    // Rows that agree on everything still show every column, with no filter fixing one.
    const rows = [plain, { ...plain, id: 8, name: "Other" }];
    const { rerender } = await render(<PoliticianTable politicians={rows} asks={[]} search={{ status: "any" }} />);
    const { fields } = staffVocabulary;
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

describe("PoliticianTable's examples in the gallery", () => {
  it("lists politicians with no buttons", async () => {
    await render(<PoliticianTableExample />);
    expect(page.getByRole("button").all()).toHaveLength(0);
  });

  it("says when no politician matches", async () => {
    await render(<PoliticianTableEmptyExample />);
    await expect.element(page.getByText(politiciansCopy.politicians.none)).toBeVisible();
  });
});

describe("the politicians list in words: its downloads, cards and filters", () => {
  const values = <Row,>(columns: DownloadColumn<Row>[], row: Row) =>
    Object.fromEntries(columns.filter((c) => c.text).map((c) => [c.key, c.text!(row)]));

  it("politicians: every column, and as cards, with what they have", async () => {
    const rows = [
      {
        ...examplePolitician,
        firstActivityAt: new Date("2026-09-01T00:00:00Z"),
        lastActivityAt: new Date("2026-10-01T00:00:00Z"),
      },
      {
        ...examplePolitician,
        id: 8,
        constituency: null,
        house: "lords" as const,
        email: null,
        party: "",
        country: null,
        status: "retired" as const,
      },
    ];
    // The Nation filter leaving one out adds their nation, after the constituency.
    const byNation = politicianColumns(exampleAsks, { status: "any", nation: ["!scotland"] });
    const keys = byNation.map((c) => c.key);
    expect(keys.indexOf("country")).toBe(keys.indexOf("constituency") + 1);
    const nation = byNation.find((c) => c.key === "country")!;
    expect(nation.text!(rows[0])).toBe(staffVocabulary.countries[examplePolitician.country!]);
    expect(nation.cell(rows[0])).toBe(staffVocabulary.countries[examplePolitician.country!]);
    expect(nation.text!(rows[1])).toBeNull();
    const columns = politicianColumns(exampleAsks, { status: "any" });
    expect(values(columns, rows[0])).toMatchObject({
      house: staffVocabulary.houses.commons,
      party: examplePolitician.party,
      status: politiciansCopy.personStatuses.in_office,
      constituency: examplePolitician.constituency,
      emailsToThem: 4,
      emailsFromThem: 1,
      first: new Date("2026-09-01T00:00:00Z"),
      active: new Date("2026-10-01T00:00:00Z"),
    });
    // The markers in words, each one they have; none for one with none.
    const flags = staffVocabulary.politicianFlags;
    const marked = {
      ...rows[0],
      importantTarget: true,
      personalConnection: true,
      isTest: true,
    };
    expect(values(columns, marked).marked).toBe(`${flags.important}; ${flags.connection}; ${flags.test}`);
    expect(values(columns, { ...rows[0], importantTarget: false }).marked).toBe("");
    // On the page, the days of their first and last activity; none for one without.
    await render(<PoliticianTable politicians={rows} asks={exampleAsks} search={{ status: "any" }} />);
    await expect.element(page.getByRole("cell", { name: "1 Sept 2026" })).toBeVisible();
    await expect.element(page.getByRole("cell", { name: "1 Oct 2026" })).toBeVisible();
    expect(String(values(columns, rows[0]).asks)).toContain(": ");
    const card = politicianContact(exampleAsks);
    expect(card(rows[0])).toMatchObject({ emails: [examplePolitician.email], title: examplePolitician.party });
    const { emailsToThem, emailsFromThem } = politiciansCopy.politicians.columns;
    expect(card(rows[0]).note).toEqual(expect.arrayContaining([`${emailsToThem}: 4`, `${emailsFromThem}: 1`]));
    expect(card(rows[1])).toMatchObject({ emails: [], title: null, address: { country: null } });
  });

  it("says the politicians' house first, or nothing for all of them", () => {
    const parties = ["Labour"];
    expect(politicianWords({ ...emptyPoliticiansSearch, house: "lords", party: ["Labour"] }, parties, [])).toEqual([
      staffVocabulary.houses.lords,
      `${staffVocabulary.fields.party}: Labour`,
    ]);
    expect(politicianWords(emptyPoliticiansSearch, parties, [])).toEqual([""]);
  });
});
