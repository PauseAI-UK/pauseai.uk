import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import type { ComponentProps } from "react";
import { staffCopy } from "@/lib/content/staff-interface";
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

const copy = staffCopy.filters;

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
    { value: "", label: "Any" },
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ],
};
const ask: Filter = { name: "ask", label: "Ask", options: [{ value: "x", label: "X" }] };

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

  it("names a choice in a group by both", async () => {
    const grouped: Filter = {
      ...tag,
      options: [{ value: "a", label: "A", group: { label: "Group", icon: null } }],
    };
    await render(bar([grouped], { tag: ["a"] }));
    expect(chipWords()).toBe("Tag: Group, A");
  });

  it("as a lozenge's second half: named for its blank choice, no turning round or Remove, with a row for its default", async () => {
    await render(bar([ask, answer], { ask: "x" }));
    const halves = page.getByRole("group", { name: "Ask" }).getByRole("button");
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
    expect(replaced()).toEqual(["/list?ask=x&answer=yes", "/list?ask=x&answer=yes&answer=no"]);
  });

  it("says the answers in the second half, whose default row takes them off, and changing the first takes them off too", async () => {
    const { rerender } = await render(bar([ask, answer], { ask: "x", answer: "yes" }));
    const halves = page.getByRole("group", { name: "Ask" }).getByRole("button");
    await halves.nth(1).click();
    expect(open().querySelector("a")!.getAttribute("href")).toBe("/list?ask=x");
    await away();
    await rerender(bar([ask, answer], { ask: "x", answer: ["yes", "no"] }));
    expect(halves.nth(1).element().textContent).toBe("Yes or No");
    await halves.nth(0).click();
    expect(open().querySelector("a")!.getAttribute("href")).toBe("/list?ask=x");
  });

  it("alone, with no ask chosen, its chip has Remove, and no turning round", async () => {
    await render(bar([ask, answer], { answer: "yes" }));
    await page.getByRole("button", { name: "Answer: Yes" }).click();
    expect(foot()).toEqual([
      [copy.addChoice, null],
      [copy.remove, "/list"],
    ]);
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

describe("a filter that doesn't repeat, with several values from an old link or saved filter", () => {
  const part: Filter = {
    name: "part",
    label: "Part",
    options: [
      {
        value: "a:1",
        label: "A",
        seconds: [
          { value: "a:1", label: "One" },
          { value: "a:2", label: "Two" },
        ],
      },
      { value: "b", label: "B" },
    ],
  };
  const links = () => [...open().querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);

  it("has a chip for each; its second half changes that one, its first takes the filter's place, and Remove takes only that", async () => {
    await render(bar([part], { part: ["a:2", "b", "!a:1"] }));
    const pairs = page.getByRole("group", { name: "Part" });
    await pairs.nth(0).getByRole("button").nth(1).click();
    expect(links()[0]).toEqual(["One", "/list?part=b&part=%21a%3A1&part=a%3A1"]);
    await away();
    await pairs.nth(0).getByRole("button").nth(0).click();
    expect(links()).toEqual([
      ["A", "/list?part=a%3A1"],
      ["B", "/list?part=b"],
      [copy.remove, "/list?part=b&part=%21a%3A1"],
    ]);
    await away();
    // One left out keeps its mark when its second half changes.
    await pairs.nth(1).getByRole("button").nth(1).click();
    expect(links()[1]).toEqual(["Two", "/list?part=a%3A2&part=b&part=%21a%3A2"]);
    await away();
    await page.getByRole("button", { name: "Part: B" }).click();
    expect(links().at(-1)).toEqual([copy.remove, "/list?part=a%3A2&part=%21a%3A1"]);
  });
});
