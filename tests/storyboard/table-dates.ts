import { expect, test, type Page } from "@playwright/test";

/**
 * Fails the flow if a date in a table of a staff page is on two lines:
 * "16 Oct 2026" or "16 Oct 2026, 10:34" (lib/staff-time.ts), broken after
 * the day, the month or the comma. Every frame checks the page it's of
 * (frame.ts), so a flow has only to visit a list. On the desktop alone: a
 * phone's tables scroll sideways, and are left as they are.
 *
 * It reads where the browser drew each date, so it finds one in a cell with
 * other words as well as one alone, and takes no markup. Dates the page
 * doesn't show (a closed bubble's, a folded reason's) have no place, and
 * pass.
 */
export async function tableDatesOnOneLine(page: Page): Promise<void> {
  if (test.info().project.name !== "desktop") return;
  const path = new URL(page.url()).pathname;
  if (!path.startsWith("/staff")) return;
  const broken = await page
    .evaluate(() => {
      const DATE = /\d{1,2} [A-Z][a-z]+ \d{4}(?:, \d{2}:\d{2})?/g;
      const found: string[] = [];
      for (const table of document.querySelectorAll("table")) {
        const headings = [...table.querySelectorAll("thead th")].map((th) => th.textContent.trim());
        for (const cell of table.querySelectorAll<HTMLTableCellElement>("tbody td")) {
          const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
            for (const match of node.data.matchAll(DATE)) {
              const range = document.createRange();
              range.setStart(node, match.index);
              range.setEnd(node, match.index + match[0].length);
              const lines = new Set(
                [...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)),
              );
              if (lines.size > 1) found.push(`${match[0]}, under "${headings[cell.cellIndex] ?? ""}"`);
            }
          }
        }
      }
      return found;
    })
    // A page that navigated away as it was read has no tables to check.
    .catch((): string[] => []);
  expect([...new Set(broken)], `On ${path}, a date in a table is on two lines`).toEqual([]);
}
