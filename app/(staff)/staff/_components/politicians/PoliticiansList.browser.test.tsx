import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import {
  exampleChoosing,
  examplePasted,
  examplePolitician,
  emptyPoliticiansSearch,
  examplePoliticiansPage,
} from "./PoliticianTable.examples";
import PoliticiansList, { ChoosingHead, HouseTabs } from "./PoliticiansList";
import { downloads } from "@/tests/browser/staff";
import { politiciansCopy } from "./copy";
import { ChoosingListExample } from "./PoliticiansList.gallery.client";
import { PasteFormExample } from "./PasteForm.gallery.client";
import { exampleAsks } from "../asks/AsksList.examples";

describe("HouseTabs", () => {
  it("is a tab per house and All, keeping the filters but the page, the house chosen marked", async () => {
    await render(<HouseTabs search={{ ...emptyPoliticiansSearch, q: "jo", house: "lords", page: "3" }} />);
    const tabs = page.getByRole("navigation", { name: staffVocabulary.fields.house });
    await expect
      .element(tabs.getByRole("link", { name: politiciansCopy.politicians.allHouses }))
      .toHaveAttribute("href", "/staff/politicians?q=jo");
    const lords = tabs.getByRole("link", { name: staffVocabulary.houses.lords });
    await expect.element(lords).toHaveAttribute("aria-current", "page");
    await expect
      .element(tabs.getByRole("link", { name: staffVocabulary.houses.senedd }))
      .toHaveAttribute("href", "/staff/politicians?q=jo&house=senedd");
  });

  it("marks All for no house, or one it doesn't know", async () => {
    await render(<HouseTabs search={{ ...emptyPoliticiansSearch, house: "hogwarts" }} />);
    await expect
      .element(page.getByRole("link", { name: politiciansCopy.politicians.allHouses }))
      .toHaveAttribute("aria-current", "page");
  });

  it("choosing who a mailing is for, ends with the ticked tab, which the houses leave", async () => {
    const choosing = { ...exampleChoosing, ticked: [7, 8] };
    const search = { ...emptyPoliticiansSearch, house: "lords", mailing: "12" };
    const { rerender } = await render(<HouseTabs search={search} choosing={choosing} />);
    const ticked = page.getByRole("link", { name: `${politiciansCopy.choosing.pickedTab} 2` });
    await expect.element(ticked).toHaveAttribute("href", "/staff/politicians?house=lords&mailing=12&tab=ticked");
    await expect.element(ticked).not.toHaveAttribute("aria-current");
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.houses.lords }))
      .toHaveAttribute("aria-current", "page");
    await rerender(<HouseTabs search={{ ...search, tab: "ticked" }} choosing={choosing} />);
    await expect.element(ticked).toHaveAttribute("aria-current", "page");
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.houses.senedd }))
      .toHaveAttribute("href", "/staff/politicians?house=senedd&mailing=12");
    // Once names are pasted, the paste tab after it.
    expect(page.getByRole("link", { name: politiciansCopy.choosing.pastedTab }).all()).toHaveLength(0);
    await rerender(<HouseTabs search={{ ...search, tab: "pasted" }} choosing={{ ...choosing, pasted: true }} />);
    const pasted = page.getByRole("link", { name: politiciansCopy.choosing.pastedTab });
    await expect.element(pasted).toHaveAttribute("aria-current", "page");
    await expect.element(pasted).toHaveAttribute("href", "/staff/politicians?house=lords&mailing=12&tab=pasted");
    await expect.element(ticked).toHaveAttribute("href", "/staff/politicians?house=lords&mailing=12&tab=ticked");
  });
});

const OK = { ok: true as const };
/** A form's Server Action's stand-in, which is done. */
const formAction = () => vi.fn<(form: FormData) => Promise<typeof OK>>(async () => OK);
/** The stand-in for one a tick calls, which is done. */
const tickAction = () => vi.fn<(...args: unknown[]) => Promise<typeof OK>>(async () => OK);

describe("ChoosingHead", () => {
  const copy = politiciansCopy.choosing;

  it("is just the title unless the list is choosing who a mailing is for", async () => {
    const { container } = await render(
      <ChoosingHead cancel={vi.fn()}>
        <h1>Politicians</h1>
      </ChoosingHead>,
    );
    expect(container.innerHTML).toBe("<h1>Politicians</h1>");
  });

  it("says what to do for a new mailing, with Cancel, which deletes it", async () => {
    const cancel = formAction();
    await render(
      <ChoosingHead choosing={{ ...exampleChoosing, blank: true }} cancel={cancel}>
        <h1>Politicians</h1>
      </ChoosingHead>,
    );
    await expect.element(page.getByRole("heading", { level: 1, name: "Politicians" })).toBeVisible();
    await expect.element(page.getByText(copy.choosingNew)).toBeVisible();
    await page.viewport(1280, 800);
    await expect.element(page.getByText(copy.choosingHowNew)).toBeVisible();
    // Not on a phone, where the title says enough.
    await page.viewport(390, 800);
    await expect.element(page.getByText(copy.choosingHowNew)).not.toBeVisible();
    await page.viewport(1280, 800);
    await page.getByRole("button", { name: copy.cancelNew }).click();
    await expect.poll(() => cancel.mock.calls.length).toBe(1);
    expect(cancel.mock.calls[0][0].get("id")).toBe("12");
    expect(page.getByRole("alert").all()).toHaveLength(0);
  });

  it("says under Cancel why the mailing wasn't deleted", async () => {
    await render(
      <ChoosingHead
        choosing={{ ...exampleChoosing, blank: true }}
        cancel={() => Promise.reject(Object.assign(new Error("The server threw"), { digest: "1" }))}
      >
        <h1>Politicians</h1>
      </ChoosingHead>,
    );
    await page.getByRole("button", { name: copy.cancelNew }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(staffVocabulary.notDone);
  });

  it("names the draft, with no way out at the top, as its ticks are saved and the bar goes back", async () => {
    await render(
      <ChoosingHead choosing={exampleChoosing} cancel={vi.fn()}>
        <h1>Politicians</h1>
      </ChoosingHead>,
    );
    await expect.element(page.getByText(copy.choosingDraft(exampleChoosing.title))).toBeVisible();
    await expect.element(page.getByText(copy.choosingHow)).toBeVisible();
    expect(page.getByRole("link").all()).toHaveLength(0);
    expect(page.getByRole("button").all()).toHaveLength(0);
  });
});

describe("PoliticiansList", () => {
  const copy = politiciansCopy.politicians;
  const mailingCopy = politiciansCopy.choosing;
  const search = { ...emptyPoliticiansSearch, q: "pol", page: "2" };
  const actions = () => ({
    pick: tickAction(),
    pickFound: tickAction(),
    paste: formAction(),
    pickMany: tickAction(),
    untickAll: tickAction(),
  });

  it("makes a new mailing to who the filters find, with Mail these", async () => {
    const newMailing = formAction();
    await render(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, total: 150 }}
        search={{ ...search, party: ["Green", "!Labour"] }}
        asks={exampleAsks}
        newMailing={newMailing}
        actions={actions()}
      />,
    );
    expect(page.getByRole("checkbox").all()).toHaveLength(0);
    await page.getByRole("button", { name: mailingCopy.mailThese(150) }).click();
    await expect.poll(() => newMailing.mock.calls.length).toBe(1);
    expect([...newMailing.mock.calls[0][0].entries()]).toEqual([
      ["q", "pol"],
      ["party", "Green"],
      ["party", "!Labour"],
      ["found", "1"],
    ]);
  });

  it("makes an empty mailing with New mailing, given no filter", async () => {
    const newMailing = formAction();
    await render(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, total: 150 }}
        search={{ ...search, q: "" }}
        asks={exampleAsks}
        newMailing={newMailing}
        actions={actions()}
      />,
    );
    await page.getByRole("button", { name: mailingCopy.newTitle }).click();
    await expect.poll(() => newMailing.mock.calls.length).toBe(1);
    expect([...newMailing.mock.calls[0][0].entries()]).toEqual([]);
  });

  it("names one person found as this one, and has no button when the filters find no one", async () => {
    const { rerender } = await render(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, total: 1 }}
        search={search}
        asks={exampleAsks}
        newMailing={vi.fn()}
        actions={actions()}
      />,
    );
    await expect.element(page.getByRole("button", { name: mailingCopy.mailThese(1) })).toBeVisible();
    await rerender(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, politicians: [], total: 0 }}
        search={search}
        asks={exampleAsks}
        newMailing={vi.fn()}
        actions={actions()}
      />,
    );
    await expect.element(page.getByRole("button", { name: mailingCopy.mailThese(1) })).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: mailingCopy.newTitle })).not.toBeInTheDocument();
  });

  it("choosing, ticks and unticks a row, and everyone the filters find with the box over them", async () => {
    const act = actions();
    const { rerender } = await render(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, total: 150 }}
        search={{ ...search, mailing: "12" }}
        asks={exampleAsks}
        newMailing={vi.fn()}
        choosing={exampleChoosing}
        tickedHere={1}
        actions={act}
      />,
    );
    expect(page.getByRole("button", { name: mailingCopy.newTitle }).all()).toHaveLength(0);
    const row = page.getByRole("checkbox", { name: mailingCopy.tick("Polly Placeholder") });
    await expect.element(row).toBeChecked();
    await row.click();
    await expect.poll(() => act.pick.mock.calls).toEqual([[12, 7, false]]);
    // Some of the 150 ticked: part ticked, and a click ticks them all.
    const all = page.getByRole("checkbox", { name: mailingCopy.tickAll(150) });
    await expect.element(all).toBePartiallyChecked();
    await all.click();
    await expect.poll(() => act.pickFound.mock.calls).toEqual([[12, { q: "pol" }, true]]);
    await rerender(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, total: 1 }}
        search={{ ...search, mailing: "12" }}
        asks={exampleAsks}
        newMailing={vi.fn()}
        choosing={exampleChoosing}
        tickedHere={1}
        actions={act}
      />,
    );
    await expect.element(page.getByRole("checkbox", { name: mailingCopy.tickAll(1) })).toBeChecked();
  });

  it("choosing, the bar at the foot counts those ticked, with the way to see them, and goes on to the draft", async () => {
    const act = actions();
    const { rerender } = await render(
      <PoliticiansList
        list={examplePoliticiansPage}
        search={{ ...search, mailing: "12" }}
        asks={exampleAsks}
        newMailing={vi.fn()}
        choosing={{ ...exampleChoosing, blank: true, ticked: [7, 8] }}
        actions={act}
      />,
    );
    const bar = page.getByRole("region", { name: mailingCopy.choosingCount(2) });
    await expect
      .element(bar.getByRole("link", { name: mailingCopy.seeTicked }))
      .toHaveAttribute("href", "/staff/politicians?q=pol&mailing=12&tab=ticked");
    await bar.getByRole("button", { name: mailingCopy.untickAll }).click();
    await expect.poll(() => act.untickAll.mock.calls.length).toBe(1);
    expect(act.untickAll.mock.calls[0][0]).toBe(12);
    await expect
      .element(bar.getByRole("link", { name: mailingCopy.writeToThese(2) }))
      .toHaveAttribute("href", "/staff/mailings/12");
    // On the ticked tab: no way to see them, and the box over them, ticked, unticks everyone.
    const onTicked = actions();
    await rerender(
      <PoliticiansList
        list={examplePoliticiansPage}
        search={{ ...search, mailing: "12", tab: "ticked" }}
        asks={exampleAsks}
        newMailing={vi.fn()}
        choosing={{ ...exampleChoosing, ticked: [7, 8] }}
        actions={onTicked}
      />,
    );
    await expect.element(bar.getByRole("link", { name: mailingCopy.useThese(2) })).toBeVisible();
    expect(bar.getByRole("link", { name: mailingCopy.seeTicked }).all()).toHaveLength(0);
    expect(page.getByRole("checkbox", { name: mailingCopy.tickAll(1) }).all()).toHaveLength(0);
    const everyone = page.getByRole("checkbox", { name: mailingCopy.untickAll });
    await expect.element(everyone).toBeChecked();
    await everyone.click();
    await expect.poll(() => onTicked.untickAll.mock.calls[0]?.[0]).toBe(12);
    // No one ticked on a draft: what to do, and the way back to it.
    await rerender(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, politicians: [], total: 0 }}
        search={{ ...search, mailing: "12", tab: "ticked" }}
        asks={exampleAsks}
        newMailing={vi.fn()}
        choosing={{ ...exampleChoosing, ticked: [] }}
        actions={actions()}
      />,
    );
    await expect.element(page.getByText(mailingCopy.noneTicked)).toBeVisible();
    await expect.element(page.getByText(mailingCopy.pickedNone)).toBeVisible();
    await expect
      .element(page.getByRole("region").getByRole("link", { name: mailingCopy.backToDraft }))
      .toHaveAttribute("href", "/staff/mailings/12");
    expect(page.getByRole("region").getByRole("button", { name: mailingCopy.untickAll }).all()).toHaveLength(0);
    // On a new mailing, the way on greyed: its way out is Cancel, at the top.
    await rerender(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, politicians: [], total: 0 }}
        search={{ ...search, mailing: "12", tab: "ticked" }}
        asks={exampleAsks}
        newMailing={vi.fn()}
        choosing={{ ...exampleChoosing, blank: true, ticked: [] }}
        actions={actions()}
      />,
    );
    expect(page.getByRole("region").getByRole("link").all()).toHaveLength(0);
    await expect
      .element(page.getByRole("region").getByRole("button", { name: mailingCopy.writeToNone }))
      .toBeDisabled();
  });

  it("choosing, pastes names from the bar, then on the paste tab shows a row for each person found, to tick", async () => {
    const act = actions();
    const { rerender } = await render(
      <PoliticiansList
        list={examplePoliticiansPage}
        search={{ ...search, mailing: "12" }}
        asks={exampleAsks}
        newMailing={vi.fn()}
        choosing={exampleChoosing}
        actions={act}
      />,
    );
    const bar = page.getByRole("region", { name: mailingCopy.choosingCount(1) });
    await bar.getByRole("button", { name: mailingCopy.pasteNames }).click();
    await page.getByRole("textbox", { name: mailingCopy.pasteLabel }).fill("Polly Placeholder");
    await page.getByRole("button", { name: mailingCopy.pasteTick }).click();
    await expect.poll(() => act.paste.mock.calls.length).toBe(1);
    expect([...act.paste.mock.calls[0][0].entries()]).toEqual([
      ["back", "/staff/politicians?q=pol&page=2&mailing=12"],
      ["names", "Polly Placeholder"],
    ]);
    await rerender(
      <PoliticiansList
        list={examplePoliticiansPage}
        search={{ ...search, mailing: "12", tab: "pasted" }}
        asks={exampleAsks}
        newMailing={vi.fn()}
        choosing={exampleChoosing}
        pasted={[
          ...examplePasted,
          { line: "Polly", matches: [], by: {}, choices: [examplePolitician, { ...examplePolitician, id: 70 }] },
        ]}
        skipped={2}
        actions={act}
      />,
    );
    // In place of the list: how many it found, a row for each person found, after the heading, then how many lines
    // found no one; and its downloads, of what it shows.
    const pasted = page.getByRole("region", { name: mailingCopy.pastedTitle });
    await expect.element(pasted.getByText(politiciansCopy.politicians.total(2))).toBeVisible();
    expect(pasted.getByRole("row").all()).toHaveLength(1 + 1 + 1 + 2);
    await pasted.getByRole("button", { name: staffVocabulary.lists.download }).click();
    await expect
      .element(pasted.getByRole("link", { name: staffVocabulary.lists.formats.csv }))
      .toHaveAttribute("href", "/staff/politicians/download?q=pol&mailing=12&tab=pasted&format=csv");
    await expect.element(pasted.getByText(mailingCopy.pastedSkipped(2))).toBeVisible();
    // Each reason, in its cell over the line it came from.
    await expect.element(pasted.getByText(mailingCopy.pastedBy.name, { exact: false })).toBeVisible();
    await expect.element(pasted.getByText(mailingCopy.pastedNone, { exact: false })).toBeVisible();
    expect(pasted.getByText(mailingCopy.pastedSome, { exact: false }).all()).toHaveLength(2);
    await expect
      .element(pasted.getByText("“Polly Placeholder · House of Commons · Cities of London and Westminster”"))
      .toBeVisible();
    // Polly is ticked, the other not: the box over them part ticked, ticking everyone found.
    const all = pasted.getByRole("checkbox", { name: mailingCopy.pastedTickAll(2) });
    await expect.element(all).toBePartiallyChecked();
    await all.click();
    await expect.poll(() => act.pickMany.mock.calls).toEqual([[12, [7, 70], true]]);
    await pasted
      .getByRole("checkbox", { name: mailingCopy.tick("Polly Placeholder") })
      .first()
      .click();
    await expect.poll(() => act.pick.mock.calls).toEqual([[12, 7, false]]);
    await rerender(
      <PoliticiansList
        list={examplePoliticiansPage}
        search={{ ...search, mailing: "12", tab: "pasted" }}
        asks={exampleAsks}
        newMailing={vi.fn()}
        choosing={exampleChoosing}
        pasted={[examplePasted[0]]}
        actions={act}
      />,
    );
    await expect.element(pasted.getByRole("checkbox", { name: mailingCopy.pastedTickAll(1) })).toBeChecked();
    expect(pasted.getByText(mailingCopy.pastedSkipped(2)).all()).toHaveLength(0);
    // No one found: only that, not how many lines found no one.
    await rerender(
      <PoliticiansList
        list={examplePoliticiansPage}
        search={{ ...search, mailing: "12", tab: "pasted" }}
        asks={exampleAsks}
        newMailing={vi.fn()}
        choosing={exampleChoosing}
        skipped={1}
        actions={act}
      />,
    );
    await expect.element(pasted.getByText(mailingCopy.pastedNoOne)).toBeVisible();
    expect(pasted.getByText(mailingCopy.pastedSkipped(1)).all()).toHaveLength(0);
    expect(pasted.getByRole("table").all()).toHaveLength(0);
  });

  it("is the count, the table and the pages, and links to those the search finds elsewhere", async () => {
    await render(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, total: 150, page: 2, pages: 2, outOfOffice: 3, otherHouses: 2, tests: 1 }}
        search={search}
        asks={exampleAsks}
        newMailing={vi.fn()}
        actions={actions()}
      />,
    );
    await expect.element(page.getByText(copy.total(150))).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Polly Placeholder" })).toBeVisible();
    expect(await downloads()).toContain("/staff/politicians/download?q=pol&format=vcf");
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.previous }))
      .toHaveAttribute("href", "/staff/politicians?q=pol");
    await expect
      .element(page.getByRole("link", { name: copy.otherHouses(2) }))
      .toHaveAttribute("href", "/staff/politicians?q=pol");
    await expect
      .element(page.getByRole("link", { name: copy.outOfOffice(3) }))
      .toHaveAttribute("href", "/staff/politicians?q=pol&status=any");
    await expect
      .element(page.getByRole("link", { name: copy.tests(1) }))
      .toHaveAttribute("href", "/staff/politicians?q=pol&flag=test");
  });

  it("offers the nearest names when a search finds no one, and nothing more when there's nothing", async () => {
    const { rerender } = await render(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, politicians: [], total: 0, closest: examplePoliticiansPage.politicians }}
        search={search}
        asks={exampleAsks}
        newMailing={vi.fn()}
        actions={actions()}
      />,
    );
    await expect.element(page.getByText(copy.closest)).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Polly Placeholder" })).toBeVisible();
    expect(page.getByRole("checkbox").all()).toHaveLength(0);
    // While choosing, each has a tick box, but there's none over them.
    const act = actions();
    await rerender(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, politicians: [], total: 0, closest: examplePoliticiansPage.politicians }}
        search={{ ...search, mailing: "12" }}
        asks={exampleAsks}
        newMailing={vi.fn()}
        choosing={{ ...exampleChoosing, ticked: [] }}
        actions={act}
      />,
    );
    await page.getByRole("checkbox", { name: politiciansCopy.choosing.tick("Polly Placeholder") }).click();
    await expect.poll(() => act.pick.mock.calls).toEqual([[12, 7, true]]);
    expect(page.getByRole("checkbox").all()).toHaveLength(1);
    await rerender(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, politicians: [], total: 0 }}
        search={search}
        asks={[]}
        newMailing={vi.fn()}
        actions={actions()}
      />,
    );
    // Nothing found, and no one close: the list's frame, saying so, with no one to mail, and the way to clear the search.
    await expect.element(page.getByRole("table").getByText(copy.none)).toBeVisible();
    await expect.element(page.getByText(copy.total(0))).toBeVisible();
    expect(page.getByRole("button").all()).toHaveLength(0);
    await expect
      .element(page.getByRole("table").getByRole("link", { name: staffVocabulary.resetFilters }))
      .toHaveAttribute("href", "/staff/politicians");
    // With nothing on, there's nothing to clear.
    await rerender(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, politicians: [], total: 0 }}
        search={emptyPoliticiansSearch}
        asks={[]}
        newMailing={vi.fn()}
        actions={actions()}
      />,
    );
    expect(page.getByRole("link", { name: staffVocabulary.resetFilters }).all()).toHaveLength(0);
    // Emptied by a filter, the row's way to clear it keeps the house; but there's none while choosing.
    const filtered = { ...emptyPoliticiansSearch, house: "lords", party: ["Green"] };
    await rerender(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, politicians: [], total: 0 }}
        search={filtered}
        asks={[]}
        newMailing={vi.fn()}
        actions={actions()}
      />,
    );
    await expect
      .element(page.getByRole("table").getByRole("link", { name: staffVocabulary.resetFilters }))
      .toHaveAttribute("href", "/staff/politicians?house=lords");
    await rerender(
      <PoliticiansList
        list={{ ...examplePoliticiansPage, politicians: [], total: 0 }}
        search={{ ...filtered, mailing: "12" }}
        asks={[]}
        newMailing={vi.fn()}
        choosing={{ ...exampleChoosing, ticked: [] }}
        actions={actions()}
      />,
    );
    expect(page.getByRole("table").getByRole("link", { name: staffVocabulary.resetFilters }).all()).toHaveLength(0);
  });
});

describe("PoliticiansList's examples in the gallery", () => {
  // Their Server Actions are logged, not sent: pressing each adds its line to the event log.
  const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

  it("logs a row ticked or unticked while choosing who a mailing is for", async () => {
    await render(<ChoosingListExample />);
    await page.getByRole("checkbox", { name: politiciansCopy.choosing.tick("Polly Placeholder") }).click();
    await expect.poll(() => log().last().query()?.textContent).toBe("pickPolitician(12, 7, false)");
  });

  it("logs names pasted, and ticking everyone they found", async () => {
    const { unmount } = await render(<PasteFormExample />);
    await page.getByRole("textbox", { name: politiciansCopy.choosing.pasteLabel }).fill("Polly Placeholder");
    await page.getByRole("button", { name: politiciansCopy.choosing.pasteTick }).click();
    await expect.poll(() => log().last().query()?.textContent).toMatch(/^pasteNames\(/);
    await unmount();
    await render(<ChoosingListExample pasted />);
    await page.getByRole("checkbox", { name: politiciansCopy.choosing.pastedTickAll(1) }).click();
    await expect.poll(() => log().last().query()?.textContent).toBe("pickMany(12, [7], false)");
    await page.getByRole("button", { name: politiciansCopy.choosing.untickAll }).click();
    await expect.poll(() => log().last().query()?.textContent).toMatch(/^untickAll\(12/);
  });
});
