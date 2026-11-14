import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import SortHeading from "./SortHeading";
import Table from "@/components/ui/Table";

describe("SortHeading", () => {
  it("links to the sort, and marks the current one with its direction", async () => {
    await render(
      <Table>
        <thead>
          <tr>
            <SortHeading sortKey="name" current={{ key: "name", dir: "desc" }} href="/x?sort=name&dir=asc">
              Name
            </SortHeading>
            <SortHeading sortKey="party" current={{ key: "name", dir: "desc" }} href="/x?sort=party&dir=asc">
              Party
            </SortHeading>
          </tr>
        </thead>
        <tbody />
      </Table>,
    );
    const name = page.getByRole("link", { name: "Name" });
    await expect.element(name).toHaveAttribute("href", "/x?sort=name&dir=asc");
    expect(name.element().closest("th")!.getAttribute("aria-sort")).toBe("descending");
    const party = page.getByRole("link", { name: "Party" });
    await expect.element(party).toHaveAttribute("href", "/x?sort=party&dir=asc");
    expect(party.element().closest("th")!.getAttribute("aria-sort")).toBeNull();
  });

  it("breaks once, after its first word, with its other words and its arrow on one line", async () => {
    // In a box with no room, so each column is as narrow as its heading lets it be.
    await render(
      <div style={{ width: "1px" }}>
        <Table>
          <thead>
            <tr>
              <SortHeading sortKey="from" current={{ key: "from", dir: "desc" }} href="/x?sort=from&dir=asc" breakOnce>
                Emails from them
              </SortHeading>
              <SortHeading sortKey="to" current={{ key: "from", dir: "desc" }} href="/x?sort=to&dir=desc">
                Emails to them
              </SortHeading>
            </tr>
          </thead>
          <tbody />
        </Table>
      </div>,
    );
    const link = page.getByRole("link", { name: "Emails from them" }).element();
    expect(link.textContent).toMatch(/^Emails from them ▼/);
    const [together] = link.children;
    expect(together.firstChild!.textContent).toBe("from them");
    expect(getComputedStyle(together).whiteSpace).toBe("nowrap");
    // The arrow is in with those words, so it never takes a line of its own.
    expect(together.querySelector("[aria-hidden]")!.textContent).toBe(" ▼");
    // So it takes two lines, where a heading that isn't told to breaks at every word.
    const lines = (heading: Element) => new Set([...heading.getClientRects()].map((box) => box.top)).size;
    expect(lines(link)).toBe(2);
    expect(lines(page.getByRole("link", { name: "Emails to them" }).element())).toBe(3);
  });
});
