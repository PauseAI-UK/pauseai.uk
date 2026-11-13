import { expect, type Page } from "@playwright/test";

/**
 * Checks that everything marked as lined up beside words (`data-beside` on
 * it) sits level with them, on every frame: a small icon (`lowercase`) with
 * its middle on the middle of the words' lowercase letters, something as
 * tall as the line (`capitals`) on the middle of their capitals, within a
 * pixel and a half. Where the letters are comes from the font itself (its
 * ascent, and how tall its x and H are, by canvas), not from boxes, so it
 * holds at any size and in a flex row as in a line of text. The words are
 * the first after it on its line, in its parent; or, for something after
 * its words (a tag, a "…"), the last before it on its line. One with no
 * words on its line in its parent (a flag standing alone) isn't checked.
 * Lining something up by eye goes wrong quietly, so this is how it can't
 * (docs/style-guide.md, "Lining something up with words").
 */
export async function iconsLevelWithWords(page: Page): Promise<void> {
  const path = new URL(page.url()).pathname;
  const off = await page
    .evaluate(async () => {
      await document.fonts.ready;
      const context = document.createElement("canvas").getContext("2d")!;
      const found: string[] = [];
      for (const marked of document.querySelectorAll<HTMLElement>("[data-beside]")) {
        const box = (marked.querySelector("svg") ?? marked).getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        const words = wordsAfter(marked, box);
        if (!words) continue;
        const range = document.createRange();
        range.selectNodeContents(words);
        const line = [...range.getClientRects()].find((rect) => rect.top < box.bottom && rect.bottom > box.top);
        if (!line) continue;
        const style = getComputedStyle(words.parentElement!);
        context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const capital = context.measureText("H");
        const baseline = line.top + capital.fontBoundingBoxAscent;
        const letters =
          marked.dataset.beside === "capitals"
            ? capital.actualBoundingBoxAscent
            : context.measureText("x").actualBoundingBoxAscent;
        const by = (box.top + box.bottom) / 2 - (baseline - letters / 2);
        if (Math.abs(by) > 1.5) {
          found.push(`${marked.dataset.beside} beside "${words.data.trim().slice(0, 30)}", ${by.toFixed(1)}px off`);
        }
      }
      return found;

      /** The first words after `marked` on its line (`box`), in its parent; or else the last before it. */
      function wordsAfter(marked: HTMLElement, box: DOMRect): Text | undefined {
        const walker = document.createTreeWalker(marked.parentElement!, NodeFilter.SHOW_TEXT);
        let before: Text | undefined;
        for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
          if (marked.contains(node) || !node.data.trim() || !onLine(node, box)) continue;
          if (marked.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) return node;
          before = node;
        }
        return before;
      }

      /** Whether some of `node` is on the same line as `box`, overlapping it top to bottom. */
      function onLine(node: Text, box: DOMRect): boolean {
        const range = document.createRange();
        range.selectNodeContents(node);
        return [...range.getClientRects()].some((rect) => rect.top < box.bottom && rect.bottom > box.top);
      }
    })
    // A page that navigated away as it was read has nothing to check.
    .catch((): string[] => []);
  expect([...new Set(off)], `On ${path}, something beside words isn't level with them`).toEqual([]);
}
