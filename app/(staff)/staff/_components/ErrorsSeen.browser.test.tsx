import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { action } from "@/tests/browser/staff";
import ErrorSeenView from "./ErrorSeenView";
import ErrorsSeen from "./ErrorsSeen";
import { exampleErrorDone, exampleErrorsSeen } from "./ErrorsSeen.examples";

const copy = staffCopy.errorsSeen;
const [inPage, problem, inBrowser] = exampleErrorsSeen;
const setDone = vi.fn();

describe("ErrorsSeen", () => {
  it("lists each error, its words leading to its own page, with where it was and how often", async () => {
    await render(<ErrorsSeen done={false} errors={exampleErrorsSeen} total={4} pages={1} page={1} pageSize={100} />);
    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent(staffCopy.nav.errors);
    await expect.element(page.getByText(copy.total(4))).toBeVisible();
    await expect.element(page.getByRole("link", { name: inPage.words })).toHaveAttribute("href", "/staff/errors/4");
    // A row's cells, in order: last seen, what, its kind, its page or route, first seen, how often.
    const cells = (words: string) =>
      page
        .getByRole("row")
        .filter({ hasText: words })
        .getByRole("cell")
        .elements()
        .map((cell) => cell.textContent);
    expect(cells(inPage.words)).toEqual([
      "10 Nov 2026, 16:40",
      inPage.words,
      copy.kinds.render,
      "/staff/politicians/[id]",
      "3 Nov 2026, 09:12",
      "12",
    ]);
    // A problem has no page.
    expect(cells(problem.words).slice(2, 4)).toEqual([copy.kinds.problem, ""]);
  });

  it("says so when nothing has gone wrong, in the list's frame", async () => {
    await render(<ErrorsSeen done={false} errors={[]} total={0} pages={1} page={1} pageSize={100} />);
    await expect.element(page.getByText(copy.total(0))).toBeVisible();
    await expect.element(page.getByRole("table").getByText(copy.none)).toBeVisible();
  });

  it("leads to the next page of a long list", async () => {
    await render(<ErrorsSeen done={false} errors={exampleErrorsSeen} total={250} pages={3} page={1} pageSize={100} />);
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.next }))
      .toHaveAttribute("href", "/staff/errors?page=2");
  });

  it("has tabs for those to do and those done, the Done tab's pages and empty list its own", async () => {
    const { rerender } = await render(
      <ErrorsSeen done={false} errors={exampleErrorsSeen} total={4} pages={1} page={1} pageSize={100} />,
    );
    const tab = (name: string) => page.getByRole("navigation", { name: copy.tabs.label }).getByRole("link", { name });
    await expect.element(tab(copy.tabs.toDo)).toHaveAttribute("aria-current", "page");
    await expect.element(tab(copy.tabs.toDo)).toHaveAttribute("href", "/staff/errors");
    await expect.element(tab(copy.tabs.done)).toHaveAttribute("href", "/staff/errors?done=yes");
    await expect.element(tab(copy.tabs.done)).not.toHaveAttribute("aria-current");

    await rerender(<ErrorsSeen done errors={[exampleErrorDone]} total={250} pages={3} page={1} pageSize={100} />);
    await expect.element(tab(copy.tabs.done)).toHaveAttribute("aria-current", "page");
    // Who marked it done, and when, after the rest.
    const cells = page
      .getByRole("row")
      .filter({ hasText: exampleErrorDone.words })
      .getByRole("cell")
      .elements()
      .map((cell) => cell.textContent);
    expect(cells.slice(-2)).toEqual(["jane.smith@pauseai.uk", "9 Nov 2026, 12:00"]);
    const heads = page
      .getByRole("row")
      .first()
      .getByRole("cell")
      .elements()
      .map((cell) => cell.textContent?.trim());
    expect(heads.slice(-2)).toEqual([copy.columns.doneBy, copy.columns.doneAt]);
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.next }))
      .toHaveAttribute("href", "/staff/errors?done=yes&page=2");

    await rerender(<ErrorsSeen done errors={[]} total={0} pages={1} page={1} pageSize={100} />);
    await expect.element(page.getByText(copy.noneDone)).toBeVisible();
  });
});

describe("ErrorSeenView", () => {
  it("shows a server's error: what and where it was, its code, when, and the latest with its stack trace", async () => {
    await render(<ErrorSeenView error={inPage} setDone={setDone} />);
    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent(inPage.words);
    const fact = (label: string) => page.getByText(label, { exact: true }).element().parentElement!.textContent;
    expect(fact(copy.one.kind)).toBe(`${copy.one.kind}${copy.kinds.render}`);
    expect(fact(copy.one.page)).toBe(`${copy.one.page}/staff/politicians/[id]`);
    expect(fact(copy.one.className)).toContain("error");
    expect(fact(copy.one.code)).toContain("23505 notes_pkey");
    expect(fact(copy.one.last)).toContain("10 Nov 2026, 16:40");
    expect(fact(copy.one.first)).toContain("3 Nov 2026, 09:12");
    expect(fact(copy.one.count)).toContain("12");
    expect(page.getByText(copy.one.browser).elements()).toEqual([]);
    await expect.element(page.getByText(inPage.latestWords, { exact: true })).toBeVisible();
    await expect.element(page.getByText(/at async addNote/)).toBeVisible();
    expect(page.getByText(copy.one.noStack).elements()).toEqual([]);
  });

  it("shows a problem without a page, a class, a code or a stack trace, and a browser's with its browser", async () => {
    const { container, rerender } = await render(<ErrorSeenView error={problem} setDone={setDone} />);
    await expect.element(page.getByText(copy.one.noStack)).toBeVisible();
    expect(page.getByText(copy.one.page, { exact: true }).elements()).toEqual([]);
    expect(page.getByText(copy.one.className, { exact: true }).elements()).toEqual([]);
    expect(page.getByText(copy.one.code, { exact: true }).elements()).toEqual([]);
    // No stack trace is said in its card, where the trace would be.
    await expect.element(page.getByRole("region", { name: copy.one.stack }).getByText(copy.one.noStack)).toBeVisible();
    // The browser is the latest happening's alone, so it's in the message's card, over the message; the two
    // cards are under one heading that says they're the latest time's.
    await rerender(<ErrorSeenView error={inBrowser} setDone={setDone} />);
    const message = page.getByRole("region", { name: copy.one.message });
    await expect.element(message.getByText(`${copy.one.browser}: Firefox 131`)).toBeVisible();
    await expect.element(message.getByText(inBrowser.latestWords, { exact: true })).toBeVisible();
    const underHeader = [...container.querySelectorAll("h2, h3, p")].map((element) => element.textContent);
    expect(underHeader).toEqual([
      copy.one.latest,
      copy.one.message,
      `${copy.one.browser}: Firefox 131`,
      copy.one.stack,
    ]);
  });

  it("marks an error done, and once it's done, says who and when, and makes it to do again", async () => {
    const { fn, sent } = action();
    const { rerender } = await render(<ErrorSeenView error={problem} setDone={fn} />);
    await page.getByRole("button", { name: copy.one.markDone }).click();
    await expect.poll(() => sent).toEqual([{ id: String(problem.id), done: "yes" }]);

    await rerender(<ErrorSeenView error={exampleErrorDone} setDone={fn} />);
    await expect.element(page.getByText(copy.one.doneBy("jane.smith@pauseai.uk", "9 Nov 2026, 12:00"))).toBeVisible();
    expect(page.getByRole("button", { name: copy.one.markDone }).elements()).toEqual([]);
    await page.getByRole("button", { name: copy.one.undo }).click();
    await expect
      .poll(() => sent)
      .toEqual([
        { id: String(problem.id), done: "yes" },
        { id: String(problem.id), done: "" },
      ]);
  });
});
