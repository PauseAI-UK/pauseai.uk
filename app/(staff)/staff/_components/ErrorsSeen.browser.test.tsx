import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import ErrorSeenView from "./ErrorSeenView";
import ErrorsSeen from "./ErrorsSeen";
import { exampleErrorsSeen } from "./ErrorsSeen.examples";

const copy = staffCopy.errorsSeen;
const [inPage, problem, inBrowser] = exampleErrorsSeen;

describe("ErrorsSeen", () => {
  it("lists each error, its words leading to its own page, with where it was and how often", async () => {
    await render(<ErrorsSeen errors={exampleErrorsSeen} total={4} pages={1} page={1} pageSize={100} />);
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

  it("says so when nothing has gone wrong", async () => {
    await render(<ErrorsSeen errors={[]} total={0} pages={1} page={1} pageSize={100} />);
    await expect.element(page.getByText(copy.none)).toBeVisible();
    expect(page.getByRole("table").elements()).toEqual([]);
  });

  it("leads to the next page of a long list", async () => {
    await render(<ErrorsSeen errors={exampleErrorsSeen} total={250} pages={3} page={1} pageSize={100} />);
    await expect
      .element(page.getByRole("link", { name: staffCopy.paging.next }))
      .toHaveAttribute("href", "/staff/errors?page=2");
  });
});

describe("ErrorSeenView", () => {
  it("shows a server's error: what and where it was, its code, when, and the latest with its stack trace", async () => {
    await render(<ErrorSeenView error={inPage} />);
    await expect.element(page.getByRole("link", { name: copy.one.back })).toHaveAttribute("href", "/staff/errors");
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
    const { container, rerender } = await render(<ErrorSeenView error={problem} />);
    await expect.element(page.getByText(copy.one.noStack)).toBeVisible();
    expect(page.getByText(copy.one.page, { exact: true }).elements()).toEqual([]);
    expect(page.getByText(copy.one.className, { exact: true }).elements()).toEqual([]);
    expect(page.getByText(copy.one.code, { exact: true }).elements()).toEqual([]);
    // The browser is the latest happening's alone, so it's under the header, with the message and the stack
    // trace, all under one heading that says they're the latest time's.
    await rerender(<ErrorSeenView error={inBrowser} />);
    await expect.element(page.getByText(`${copy.one.browser}: Firefox 131`)).toBeVisible();
    const underHeader = [...container.querySelectorAll("h2, h3, p")].map((element) => element.textContent);
    expect(underHeader).toEqual([
      copy.one.latest,
      `${copy.one.browser}: Firefox 131`,
      copy.one.message,
      copy.one.stack,
    ]);
  });
});
