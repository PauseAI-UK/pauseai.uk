import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import type { ComponentProps } from "react";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { navigation } from "@/tests/browser/navigation";
import type { Filter } from "@/lib/staff-list-filters";
import FilterBar from "./FilterBar";
import ManyChoices from "./ManyChoices";

// Outside Next's app router a Link is a plain link, and following it would
// leave the test's page. Here, as the app router does, a click calls the
// Link's onNavigate, and goes nowhere itself.
vi.mock("next/link", () => ({
  default: ({
    onNavigate,
    prefetch,
    ...props
  }: ComponentProps<"a"> & { onNavigate: (event: { preventDefault(): void }) => void; prefetch: boolean | null }) => (
    <a
      {...props}
      data-prefetch={String(prefetch)}
      onClick={(event) => {
        event.preventDefault();
        onNavigate({ preventDefault: () => {} });
      }}
    />
  ),
}));

const copy = staffVocabulary.filters;

const tag: Filter = {
  name: "tag",
  label: "Tag",
  repeat: true,
  options: ["a", "b", "c"].map((value) => ({ value, label: value.toUpperCase() })),
};
const nation: Filter = { ...tag, name: "nation", label: "Nation", oneEach: true };
const answer: Filter = {
  name: "answer",
  label: "Answer",
  after: "ask",
  repeat: true,
  options: [
    { value: "x.", label: "Any" },
    { value: "x.yes", label: "Yes" },
    { value: "x.no", label: "No" },
  ],
};
// Each ask chosen has its own answers, paired with it.
const ask: Filter = { name: "ask", label: "Ask", repeat: true, options: [{ value: "x", label: "X" }] };

const bar = (filters: Filter[], values: Record<string, string | string[]>) => (
  <FilterBar path="/list" values={values} search={{ name: "q", label: "Search" }} filters={filters} />
);
const open = () => document.querySelector("[popover]:popover-open")!;
/** What's in the open menu: its rows, as words and whether each is chosen, and its foot. */
const rows = () => [...open().querySelectorAll("li")].map((li) => [li.textContent, chosen(li)]);
const chosen = (li: Element) => Boolean(li.querySelector("a[aria-current], input:checked"));
const foot = () =>
  [...open().querySelectorAll("p:last-of-type > *")].map((el) => [el.textContent, el.getAttribute("href")]);
const pushed = () => navigation.pushed;
const replaced = () => navigation.replaced;
const away = () => userEvent.keyboard("{Escape}");
const chipWords = () => document.querySelector("[popover] ")?.previousElementSibling?.textContent;

describe("a repeating filter's lozenge's menu", () => {
  it("with one choice: a row swaps to it alone; + Add, turning it round and Remove are its foot", async () => {
    await render(bar([tag], { tag: ["a"] }));
    await page.getByRole("button", { name: "Tag: A" }).click();
    expect(rows()).toEqual([
      ["A", true],
      ["B", false],
      ["C", false],
    ]);
    expect(foot()).toEqual([
      [copy.addChoice, null],
      [copy.exceptThis, "/list?tag=%21a"],
      [copy.remove, "/list"],
    ]);
    expect(open().querySelector("input")).toBeNull();
    await page.getByRole("link", { name: "B", exact: true }).click();
    await vi.waitFor(() => expect(pushed()).toEqual(["/list?tag=b"]));
    // Only ticks replace, and closing the menu loads nothing more.
    await away();
    expect(replaced()).toEqual([]);
  });

  it("+ Add turns the rows to boxes with what it has ticked; each tick changes the list, the menu staying open", async () => {
    await render(bar([tag], { tag: ["a"] }));
    await page.getByRole("button", { name: "Tag: A" }).click();
    await page.getByRole("button", { name: copy.addChoice }).click();
    expect(rows()).toEqual([
      ["A", true],
      ["B", false],
      ["C", false],
    ]);
    expect(open().querySelectorAll("input[type=checkbox]")).toHaveLength(3);
    expect(foot()[0]).toEqual([copy.justOne, null]);
    expect(replaced()).toEqual([]);
    await page.getByRole("checkbox", { name: "C" }).click();
    await page.getByRole("checkbox", { name: "B" }).click();
    expect(replaced()).toEqual(["/list?tag=a&tag=c", "/list?tag=a&tag=c&tag=b"]);
    expect(pushed()).toEqual([]);
    expect(open()).not.toBeNull();
    // Its words count what's ticked, and turning round takes what's ticked, here leaving out every choice. The
    // chip says them at once.
    expect(foot()[1]).toEqual([copy.exceptThese, "/list"]);
    expect(chipWords()).toBe("Tag: A or C or B");
    // Clicking away only closes it.
    await away();
    expect(open()).toBeNull();
    expect(replaced()).toHaveLength(2);
  });

  it("stays open with the page's new URL while ticking, its chip with nothing ticked, and starts afresh once closed", async () => {
    const { rerender } = await render(bar([tag], { tag: ["a"] }));
    await page.getByRole("button", { name: "Tag: A" }).click();
    await page.getByRole("button", { name: copy.addChoice }).click();
    await page.getByRole("checkbox", { name: "A" }).click();
    expect(replaced()).toEqual(["/list"]);
    // The page arrives without the filter: the menu and its chip stay.
    await rerender(bar([tag], {}));
    expect(open()).not.toBeNull();
    expect(chipWords()).toBe("Tag: ");
    // Ticking again brings it back.
    await page.getByRole("checkbox", { name: "B" }).click();
    expect(replaced()).toEqual(["/list", "/list?tag=b"]);
    await rerender(bar([tag], { tag: ["b"] }));
    expect(open()).not.toBeNull();
    await page.getByRole("checkbox", { name: "B" }).click();
    await rerender(bar([tag], {}));
    await away();
    // Closed, the bar shows what the page has: no chip.
    await vi.waitFor(() => expect(document.body.textContent).not.toContain("Tag:"));
  });

  it("closing with nothing ticked differently goes back to rows", async () => {
    await render(bar([tag], { tag: ["a"] }));
    await page.getByRole("button", { name: "Tag: A" }).click();
    await page.getByRole("button", { name: copy.addChoice }).click();
    await away();
    expect(replaced()).toEqual([]);
    await page.getByRole("button", { name: "Tag: A" }).click();
    expect(open().querySelector("input")).toBeNull();
  });

  it("a link followed from the boxes goes there, by push, the bar no longer held", async () => {
    const { rerender } = await render(bar([tag], { tag: ["a"] }));
    await page.getByRole("button", { name: "Tag: A" }).click();
    await page.getByRole("button", { name: copy.addChoice }).click();
    await page.getByRole("link", { name: copy.remove }).click();
    await vi.waitFor(() => expect(pushed()).toEqual(["/list"]));
    await rerender(bar([tag], {}));
    await vi.waitFor(() => expect(open()).toBeNull());
  });

  it("with several chosen opens as boxes, held; Just one keeps the first ticked, at once", async () => {
    const { rerender } = await render(bar([tag], { tag: ["b", "a"] }));
    await page.getByRole("button", { name: "Tag: B or A" }).click();
    expect(rows()).toEqual([
      ["A", true],
      ["B", true],
      ["C", false],
    ]);
    expect(foot()).toEqual([
      [copy.justOne, null],
      [copy.exceptThese, "/list?tag=%21b&tag=%21a"],
      [copy.remove, "/list"],
    ]);
    await page.getByRole("button", { name: copy.justOne }).click();
    expect(open().querySelector("input")).toBeNull();
    expect(replaced()).toEqual(["/list?tag=b"]);
    await rerender(bar([tag], { tag: ["b"] }));
    expect(open()).not.toBeNull();
    expect(rows()).toEqual([
      ["A", false],
      ["B", true],
      ["C", false],
    ]);
    expect(foot()[0]).toEqual([copy.addChoice, null]);
    // With one ticked, Just one changes nothing.
    await page.getByRole("button", { name: copy.addChoice }).click();
    await page.getByRole("button", { name: copy.justOne }).click();
    expect(replaced()).toEqual(["/list?tag=b"]);
  });

  it("leaving out every choice takes the filter off the list, the menu and chip staying", async () => {
    await render(bar([tag], { tag: ["!a", "!b"] }));
    await page.getByRole("button", { name: copy.notChip("Tag", "A or B") }).click();
    await page.getByRole("checkbox", { name: "C" }).click();
    expect(replaced()).toEqual(["/list"]);
    expect(open()).not.toBeNull();
    expect(chipWords()).toBe(copy.notChip("Tag", "A or B or C"));
  });

  it("where a record has several, keeps what the other lozenge has, and doesn't offer it", async () => {
    await render(bar([tag], { tag: ["a", "!b"] }));
    await page.getByRole("button", { name: "Tag: A" }).click();
    expect(rows().map(([words]) => words)).toEqual(["A", "C"]);
    expect(foot()).toEqual([
      [copy.addChoice, null],
      [copy.exceptThis, "/list?tag=%21b&tag=%21a"],
      [copy.remove, "/list?tag=%21b"],
    ]);
    await page.getByRole("link", { name: "C", exact: true }).click();
    await vi.waitFor(() => expect(pushed()).toEqual(["/list?tag=%21b&tag=c"]));
    await away();
    await page.getByRole("button", { name: copy.notChip("Tag", "B") }).click();
    expect(foot()[1]).toEqual([copy.onlyThis, "/list?tag=a&tag=b"]);
  });

  it("where a record has one, shows both from an old link, and a change drops the other way's", async () => {
    await render(bar([nation], { nation: ["a", "!b"] }));
    await page.getByRole("button", { name: "Nation: A" }).click();
    await page.getByRole("link", { name: "C", exact: true }).click();
    await vi.waitFor(() => expect(pushed()).toEqual(["/list?nation=c"]));
    await away();
    // Removing a lozenge isn't choosing: the other stays.
    await page.getByRole("button", { name: "Nation: A" }).click();
    expect(foot()[2]).toEqual([copy.remove, "/list?nation=%21b"]);
  });

  it("from + Filter and Except too, where a record has one, one way drops the other, and all left out removes it", async () => {
    const { rerender } = await render(bar([nation], { nation: ["!a"] }));
    await page.getByRole("button", { name: copy.add }).click();
    open().querySelector("summary")!.click();
    expect(open().querySelector<HTMLAnchorElement>("a[href*='b']")!.getAttribute("href")).toBe("/list?nation=b");
    await away();
    await rerender(bar([tag], { tag: ["a", "!b"] }));
    await page.getByRole("button", { name: copy.add }).click();
    open().querySelector("summary")!.click();
    expect(open().querySelector("a")!.getAttribute("href")).toBe("/list?tag=%21b&tag=a&tag=c");
    await away();
    await rerender(bar([tag], { tag: ["!a", "!b"] }));
    await page.getByRole("button", { name: copy.except }).click();
    open().querySelector("summary")!.click();
    expect(open().querySelector("a")!.getAttribute("href")).toBe("/list");
  });

  it("says a choice it doesn't know, to take off", async () => {
    await render(bar([tag], { tag: ["gone"] }));
    await page.getByRole("button", { name: "Tag: gone" }).click();
    expect(rows().map(([words, on]) => [words, on])[0]).toEqual(["gone", true]);
  });

  it("says a choice for before anything's typed in words of its own when left out, has no + Add with it, and isn't offered to add", async () => {
    const mps: Filter = {
      ...tag,
      name: "mp",
      label: "MP",
      options: [
        { value: "any", label: "Has any MP", untyped: true, leftOut: "none" },
        { value: "7", label: "Mo Example" },
        { value: "8", label: "Polly Placeholder" },
      ],
    };
    const { unmount } = await render(bar([mps], { mp: "!any" }));
    expect(chipWords()).toBe("MP: none");
    await unmount();
    // Chosen, it takes in every MP, so there's nothing to add to it.
    const { unmount: again } = await render(bar([mps], { mp: "any" }));
    await page.getByRole("button", { name: "MP: Has any MP" }).click();
    expect(page.getByRole("button", { name: copy.addChoice }).query()).toBeNull();
    await again();
    // With an MP chosen, adding another doesn't offer it.
    await render(bar([mps], { mp: "7" }));
    await page.getByRole("button", { name: "MP: Mo Example" }).click();
    await page.getByRole("button", { name: copy.addChoice }).click();
    expect(rows().map(([words]) => words)).toEqual(["Mo Example", "Polly Placeholder"]);
  });

  it("names a choice in a group by both", async () => {
    const grouped: Filter = {
      ...tag,
      options: [{ value: "a", label: "A", group: { label: "Group", icon: null } }],
    };
    await render(bar([grouped], { tag: ["a"] }));
    expect(chipWords()).toBe("Tag: Group, A");
  });

  it("as a lozenge's second half: named for its blank choice, no Remove, and nothing to turn round till chosen, with a row for its default", async () => {
    await render(bar([ask, answer], { ask: "x" }));
    const halves = page.getByRole("group", { name: "X" }).getByRole("button");
    expect(halves.all().map((half) => half.element().textContent)).toEqual(["X", "Any"]);
    await halves.nth(1).click();
    expect(rows()).toEqual([
      ["Any", true],
      ["Yes", false],
      ["No", false],
    ]);
    expect(foot()).toEqual([[copy.addChoice, null]]);
    await page.getByRole("button", { name: copy.addChoice }).click();
    // The default is no choice among the boxes.
    expect(rows().map(([words]) => words)).toEqual(["Yes", "No"]);
    await page.getByRole("checkbox", { name: "Yes" }).click();
    await page.getByRole("checkbox", { name: "No" }).click();
    expect(replaced()).toEqual(["/list?ask=x&answer=x.yes", "/list?ask=x&answer=x.yes&answer=x.no"]);
  });

  it("says the answers in the second half, whose default row takes them off, and changing the first takes them off too", async () => {
    const { rerender } = await render(bar([ask, answer], { ask: "x", answer: "x.yes" }));
    const halves = page.getByRole("group", { name: "X" }).getByRole("button");
    await halves.nth(1).click();
    expect(open().querySelector("a")!.getAttribute("href")).toBe("/list?ask=x");
    await away();
    await rerender(bar([ask, answer], { ask: "x", answer: ["x.yes", "x.no"] }));
    expect(halves.nth(1).element().textContent).toBe("Yes or No");
    await halves.nth(0).click();
    expect(open().querySelector("a")!.getAttribute("href")).toBe("/list?ask=x");
  });

  it("starts the second half at its start for an ask just chosen, from + Filter or in place of another", async () => {
    const asks: Filter = { ...ask, options: [...ask.options, { value: "z", label: "Z" }] };
    const starting: Filter = { ...answer, start: "yes" };
    const { rerender } = await render(bar([asks, starting], {}));
    await page.getByRole("button", { name: copy.add }).click();
    await page.getByText("Ask", { exact: true }).click();
    await expect
      .element(page.getByRole("link", { name: "X", exact: true }))
      .toHaveAttribute("href", "/list?ask=x&answer=x.yes");
    await away();
    // Swapping X for Z drops X's answers and starts Z's.
    await rerender(bar([asks, starting], { ask: "x", answer: ["x.no"] }));
    await page.getByRole("group", { name: "X" }).getByRole("button").nth(0).click();
    await expect
      .element(page.getByRole("link", { name: "Z", exact: true }))
      .toHaveAttribute("href", "/list?ask=z&answer=z.yes");
  });

  it("ticks a box's parts with it, and it with every part, keeping only it in the URL", async () => {
    const nested: Filter = {
      ...tag,
      options: [
        { value: "all", label: "All" },
        { value: "a", label: "A", under: "all" },
        { value: "b", label: "B", under: "all" },
        { value: "c", label: "C" },
      ],
    };
    await render(bar([nested], { tag: ["c", "a"] }));
    await page.getByRole("button", { name: "Tag: C or A" }).click();
    const box = (name: string) => page.getByRole("checkbox", { name, exact: true });
    const last = () => replaced().at(-1);
    // Set in under the one they're part of.
    const inset = (name: string) => box(name).element().getBoundingClientRect().left;
    expect(inset("A")).toBeGreaterThan(inset("All"));
    // B, the last part not ticked, ticks All, which stands for them both.
    await box("B").click();
    expect(last()).toBe("/list?tag=c&tag=all");
    expect(rows().map(([words, on]) => [words, on])).toEqual([
      ["All", true],
      ["A", true],
      ["B", true],
      ["C", true],
    ]);
    // Unticking a part unticks All, keeping the other part.
    await box("A").click();
    expect(last()).toBe("/list?tag=c&tag=b");
    await box("B").click();
    expect(last()).toBe("/list?tag=c");
    // All ticks its parts with it, and unticks them with it.
    await box("All").click();
    expect(last()).toBe("/list?tag=c&tag=all");
    await expect.element(box("A")).toBeChecked();
    await box("All").click();
    expect(last()).toBe("/list?tag=c");
  });

  it("a searchable filter's boxes show those ticked until something's typed", async () => {
    await render(bar([{ ...tag, searchable: true }], { tag: ["a", "b"] }));
    await page.getByRole("button", { name: "Tag: A or B" }).click();
    const shown = () =>
      [...open().querySelectorAll("li")].filter((li) => getComputedStyle(li).display !== "none").length;
    expect(shown()).toBe(2);
    await page.getByRole("searchbox", { name: copy.narrow }).fill("c");
    expect(shown()).toBe(1);
  });

  it("shows a choice's detail beside its box", async () => {
    await render(
      bar([{ ...tag, options: [{ value: "a", label: "A", detail: "quiet" }, tag.options[1]] }], { tag: ["a", "b"] }),
    );
    await page.getByRole("button", { name: "Tag: A or B" }).click();
    expect(rows()[0][0]).toBe("Aquiet");
  });

  it("shows a choice's detail after its link, with one chosen", async () => {
    await render(
      bar([{ ...tag, options: [{ value: "a", label: "A", detail: "quiet" }, tag.options[1]] }], { tag: "a" }),
    );
    await page.getByRole("button", { name: "Tag: A" }).click();
    expect(open().querySelector("a[aria-current]")!.textContent).toBe("Aquiet");
  });
});

describe("ManyChoices outside a bar, as in the gallery", () => {
  it("opens and closes with nothing to hold", async () => {
    await render(
      <ManyChoices
        path="/list"
        values={{}}
        name="tag"
        label="Tag"
        all={["a", "b"]}
        here={["a", "b"]}
        not={false}
        oneEach={false}
        options={tag.options}
        every={["a", "b", "c"]}
        turns={false}
        half={false}
      />,
    );
    await page.getByRole("button", { name: "Tag: A or B" }).click();
    expect(rows()).toHaveLength(3);
    await away();
    expect(document.querySelector("[popover]:popover-open")).toBeNull();
  });
});
