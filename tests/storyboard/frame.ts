import { test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { emailView } from "../fixtures/email-view";
import type { OutboxEmail } from "@/lib/server/fixtures/outbox";
import { LOCAL_URL } from "../checkout.mjs";
import type { PlaceholderText } from "./report/frames";
import { tableDatesOnOneLine } from "./table-dates";

/**
 * A frame of the storyboard: a caption, saying what the picture shows, and, when the run takes screenshots
 * (STORYBOARD_SHOTS=1, set by scripts/storyboard.mjs), a screenshot of the
 * page as it is now. The gate takes none, so a frame costs it nothing. Put one
 * after each thing a person would see; the checks go between them.
 * tests/storyboard/report/ turns them into the page.
 *
 * A page at the top is pictured whole, so its layout can be checked. Once a
 * person has scrolled, or a step has scrolled them (to a form field, an
 * anchor), only the window is pictured: where they are is the point of the
 * frame, and a full-page picture of a scrolled page puts the sticky header
 * wherever the scroll was. So too while a menu or a dialog is open: it's
 * placed against the window, and a full-page picture, which Chromium takes
 * by resizing the window, sometimes caught it placed against a passing size.
 *
 * `of` pictures one element, exactly (a component in the gallery), with
 * the page at the top so the sticky header is never over it, and the
 * element on a whole pixel (onWholePixels). `window`
 * pictures only the window, for a page too long to picture whole. `hover` puts the pointer over an element, and keeps it
 * there for the picture, in place of moving it out of the way.
 *
 * Each frame also records the placeholders it pictures (placeholdersOnPage), for
 * `npm run copy` to show the copy waiting for approval where it appears.
 *
 * Every frame of a staff page on the desktop, pictured or not, fails the
 * flow if a date in one of its tables is on two lines (table-dates.ts).
 */
export async function frame(
  page: Page,
  caption: string,
  { of, window: windowOnly = false, hover }: { of?: Locator; window?: boolean; hover?: Locator } = {},
): Promise<void> {
  const info = test.info();
  const index = info.annotations.filter((a) => a.type === "frame").length + 1;
  info.annotations.push({ type: "frame", description: caption });
  await tableDatesOnOneLine(page);
  if (process.env.STORYBOARD_SHOTS !== "1") return;

  // The pointer is wherever the last click left it, which, as the page
  // changes under it, is sometimes over a link or a select and sometimes
  // not: a hover style that differs between runs. Out of the way first.
  await (hover ? hover.hover() : page.mouse.move(0, 0).catch(() => {}));

  // Images below the fold load first, and the fonts, so the picture is of the
  // finished page; and any smooth scroll (a field scrolled into view, an
  // anchor) has come to rest, so it's of the place it ends up.
  const inWindow = await page
    .evaluate(async () => {
      for (const img of document.querySelectorAll("img[loading=lazy]")) img.setAttribute("loading", "eager");
      await document.fonts.ready;
      // A select laid out before its font arrived keeps its text where the
      // fallback font put it, a pixel off, until it's laid out again.
      for (const select of document.querySelectorAll("select")) {
        const display = select.style.display;
        select.style.display = "none";
        void select.offsetHeight;
        select.style.display = display;
      }
      await Promise.all(
        [...document.images].map((img) =>
          img.complete
            ? undefined
            : new Promise<void>((done) => img.addEventListener("load", () => done(), { once: true })),
        ),
      );
      // Loaded isn't decoded: an image painted before it is can be drawn a
      // shade differently, a few pixels off between runs.
      await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
      // At rest means the same place for three ticks in a row (settle.ts,
      // scrollSettled): an anchor's smooth scroll starts a tick or two after
      // the click on a slow machine, and one tick of no movement caught the
      // picture before it had begun.
      const tick = () => new Promise<void>((done) => requestAnimationFrame(() => setTimeout(done, 50)));
      for (let last = -1, same = 0, tries = 0; tries < 40 && same < 3; tries++) {
        same = window.scrollY === last ? same + 1 : 1;
        last = window.scrollY;
        await tick();
      }
      // At a whole pixel: a fraction left by scrolling to an element is
      // rounded differently for the sticky sidebar than for the page, so it
      // lands a pixel off when anything above moves by less than one.
      if (!Number.isInteger(window.scrollY)) window.scrollTo({ top: Math.round(window.scrollY), behavior: "instant" });
      return window.scrollY > 0 || document.querySelector(":popover-open, dialog:modal") !== null;
    })
    .catch(() => {
      // An image that never loads, or a page that navigated away: take the picture anyway.
      return false;
    });
  if (of) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const moved = await onWholePixels(of);
    // After the scroll and the move: a sticky element in the one pictured (the march's header) is where it will be.
    await repaintSticky(page);
    try {
      const box = (await of.boundingBox())!;
      await attachPlaceholders(page, index, { x: -box.x, y: -box.y, scrolled: false });
      const body = await page.screenshot({
        fullPage: true,
        ...SHOT,
        clip: { x: box.x, y: box.y, width: box.width, height: box.height },
      });
      await info.attach(`frame ${index}: ${caption}`, { body, contentType: "image/png" });
    } finally {
      if (moved) await of.evaluate((element: HTMLElement, style) => element.setAttribute("style", style), moved.style);
    }
    return;
  }
  await repaintSticky(page);
  const windowShot = inWindow || windowOnly;
  await attachPlaceholders(page, index, { x: 0, y: 0, scrolled: !windowShot });
  const body = windowShot ? await page.screenshot(SHOT) : await wholePage(page);
  await info.attach(`frame ${index}: ${caption}`, { body, contentType: "image/png" });
}

/**
 * Paints the page's sticky elements afresh where they are now, once the
 * page is where it will be pictured. A sticky element (the staff sidebar, a
 * header) keeps the raster Chromium made of it at the scroll before, so its
 * text and edges could be a pixel up or down between runs: hidden for a tick
 * and shown again, it's painted where it is. Not one holding the focus or
 * an open menu (the site header's), which hiding would close.
 */
async function repaintSticky(page: Page): Promise<void> {
  await page
    .evaluate(async () => {
      const tick = () => new Promise<void>((done) => requestAnimationFrame(() => setTimeout(done, 50)));
      const sticky = [...document.querySelectorAll<HTMLElement>("body *")].filter(
        (el) =>
          getComputedStyle(el).position === "sticky" &&
          !el.contains(document.activeElement) &&
          !el.querySelector(":popover-open"),
      );
      for (const el of sticky) el.style.visibility = "hidden";
      await tick();
      for (const el of sticky) el.style.visibility = "";
      await tick();
    })
    // A page that navigated away: take the picture anyway.
    .catch(() => {});
}

/**
 * Moves an element pictured alone down and right by less than a pixel, so it
 * starts on a whole pixel of the page, and gives its style as it was, to put
 * back; undefined if it was on one already. Text is drawn a shade differently
 * at each fraction of a pixel, so an element pictured where the content above
 * left it (a gallery component, below one that grew by half a pixel) differed
 * from main's in every letter though nothing in it had changed. It's moved by
 * `position: relative`, which leaves the layout around it as it was.
 */
async function onWholePixels(element: Locator): Promise<{ style: string } | undefined> {
  return element.evaluate(async (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const x = Math.ceil(rect.left) - rect.left;
    const y = Math.ceil(rect.top) - rect.top;
    if (x < 0.01 && y < 0.01) return undefined;
    // One placed already (sticky, absolute, relative) is pictured where it is.
    if (getComputedStyle(el).position !== "static") return undefined;
    const style = el.getAttribute("style") ?? "";
    el.style.position = "relative";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
    return { style };
  });
}

/**
 * The placeholders the page shows, attached to the frame as `placeholders <index>` for
 * the reporter, if there are any.
 */
async function attachPlaceholders(page: Page, index: number, origin: Origin): Promise<void> {
  const found = await page.evaluate(placeholdersOnPage, origin).catch((): PlaceholderText[] => []);
  if (found.length === 0) return;
  await test.info().attach(`placeholders ${index}`, { body: JSON.stringify(found), contentType: "application/json" });
}

/**
 * Where the picture's top left is: `x` and `y` are added to each box, and
 * `scrolled` adds the page's scroll too, for a picture of the whole page.
 */
type Origin = { x: number; y: number; scrolled: boolean };

/**
 * Every visible piece of placeholder copy on the page (PlaceholderText in
 * report/frames.ts), run in the page. It only reads: the text and boxes of
 * the page as it is, so the picture is the same with it or without.
 *
 * A placeholder runs from its mark to the next, or to the end of the block it's in:
 * the nearest element around it that isn't inline, so copy split across a
 * link or a <strong> reads as one, as it does in JSX. A box is a text node's,
 * or a line's in one with line breaks (a plain-text email's <pre>). A field's
 * placeholder or value, and a select's chosen option, are boxed by the field.
 */
function placeholdersOnPage({ x, y, scrolled }: Origin): PlaceholderText[] {
  const MARK = "\u2042";
  const dx = x + (scrolled ? window.scrollX : 0);
  const dy = y + (scrolled ? window.scrollY : 0);
  const visible = (element: Element) => element.checkVisibility({ visibilityProperty: true, opacityProperty: true });
  // Text never shown as it stands: a field's is read from the field, below.
  const unseen = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA", "OPTION", "OPTGROUP"]);
  const shows = (element: Element | null) => element !== null && !unseen.has(element.tagName) && visible(element);
  const box = (at: number, rect: DOMRect): PlaceholderText["boxes"][number] => [
    at,
    Math.round(rect.x + dx),
    Math.round(rect.y + dy),
    Math.round(rect.width),
    Math.round(rect.height),
  ];
  const found: PlaceholderText[] = [];

  // From the mark at `from` in `start` to the next mark or the end of its block.
  const stretch = (start: Text, from: number): PlaceholderText => {
    let block = start.parentElement!;
    while (block.parentElement && getComputedStyle(block).display === "inline") block = block.parentElement;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    walker.currentNode = start;
    let text = "";
    const boxes: PlaceholderText["boxes"] = [];
    for (let node: Text | null = start, at = from; node; node = walker.nextNode() as Text | null, at = 0) {
      if (node !== start && !shows(node.parentElement)) continue;
      const next = node.data.indexOf(MARK, node === start ? at + 1 : at);
      const end = next === -1 ? node.data.length : next;
      // A piece a line, so a box is never wider than the text it holds.
      for (let lineStart = at; lineStart < end;) {
        const newline = node.data.indexOf("\n", lineStart);
        const lineEnd = newline === -1 || newline >= end ? end : newline + 1;
        let piece = node.data.slice(lineStart, lineEnd).replace(/[\s\u00a0]+/g, " ");
        if (text.endsWith(" ") && piece.startsWith(" ")) piece = piece.slice(1);
        const range = document.createRange();
        range.setStart(node, lineStart);
        range.setEnd(node, lineEnd);
        const rect = range.getBoundingClientRect();
        if (piece && rect.width > 0 && rect.height > 0) boxes.push(box(text.length, rect));
        text += piece;
        lineStart = lineEnd;
      }
      if (next !== -1) break;
    }
    return { text: text.trim(), boxes };
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (!node.data.includes(MARK) || !shows(node.parentElement)) continue;
    for (let at = node.data.indexOf(MARK); at !== -1; at = node.data.indexOf(MARK, at + 1)) {
      const placeholder = stretch(node, at);
      if (placeholder.boxes.length > 0) found.push(placeholder);
    }
  }
  for (const field of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input, textarea, select",
  )) {
    const shown =
      field instanceof HTMLSelectElement ? (field.selectedOptions[0]?.text ?? "") : field.value || field.placeholder;
    const rect = field.getBoundingClientRect();
    if (!shown.includes(MARK) || !visible(field) || rect.width === 0 || rect.height === 0) continue;
    const text = shown
      .slice(shown.indexOf(MARK))
      .replace(/[\s\u00a0]+/g, " ")
      .trim();
    found.push({ text, boxes: [box(0, rect)] });
  }
  return found;
}

/**
 * A line of the flow's story, told around its frames: what the person does
 * next, and why, as anyone who has used the site would say it. The review
 * page shows it above the next frame; a line after the last frame ends the
 * flow. The captions say only what's on the screen, and the flow's title
 * only names it, so the story is where the flow is explained.
 */
export function story(text: string): void {
  test.info().annotations.push({ type: "story", description: text });
}

/**
 * Every picture is a pixel to a CSS pixel, on a phone's high-density screen
 * too: the layout is what a frame is for, and a phone's at its own density
 * is nine times the pixels to take, store and compare.
 */
const SHOT = { animations: "disabled", scale: "css" } as const;

/** The tallest piece of a page, in CSS pixels, that Chromium pictures in one go. */
const SLICE = 4000;

/**
 * The time a slice is given on top of the test's own. A slice takes a
 * second or two, and longer while the machine is busy, so a page of dozens
 * (the gallery's staff group, 35 on a desktop) would otherwise use up the
 * test's minute on pictures alone.
 */
const SLICE_TIME = 5000;

/**
 * The whole page. Chromium leaves some tiles of a very tall page unpainted
 * when it pictures it in one go (the gallery's pages group, 120,000px tall
 * on a phone, lost a different few 512px squares each run), so a page taller
 * than SLICE is pictured a slice at a time and the slices put together,
 * the test given SLICE_TIME more for each.
 */
async function wholePage(page: Page): Promise<Buffer> {
  const { width, height } = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  if (height <= SLICE) return page.screenshot({ fullPage: true, ...SHOT });
  const info = test.info();
  info.setTimeout(info.timeout + Math.ceil(height / SLICE) * SLICE_TIME);
  const slices: { top: number; body: Buffer }[] = [];
  for (let top = 0; top < height; top += SLICE) {
    const clip = { x: 0, y: top, width, height: Math.min(SLICE, height - top) };
    slices.push({ top, body: await page.screenshot({ fullPage: true, ...SHOT, clip }) });
  }
  return sharp({
    create: { width, height, channels: 4, background: "#00000000" },
    limitInputPixels: false,
  })
    .composite(slices.map(({ top, body }) => ({ input: body, left: 0, top })))
    .png()
    .toBuffer();
}

/** The site's address in a pictured email: a domain reserved for examples (RFC 2606), so it can't pass for a working link. */
const SHOWN_ORIGIN = "https://pauseai.example.org";

/**
 * A frame of an email the build sent (from the outbox, tests/steps.ts), as a
 * plain mail app shows it (tests/fixtures/email-view.ts): its headers, its
 * body and its attachments. In a page of its own, at the flow's viewport,
 * closed afterwards, so the flow's page is left where it was.
 *
 * A link in an email has the address of the server that sent it, and main's
 * build and this branch's run on different ports, so the same email was
 * pictured differently on each side. It's pictured with SHOWN_ORIGIN in
 * place of the sending server's address.
 */
export async function emailFrame(page: Page, email: OutboxEmail, caption: string): Promise<void> {
  const shown = (text: string) => text.replaceAll(new URL(LOCAL_URL).origin, SHOWN_ORIGIN);
  const mail = await page.context().newPage();
  try {
    await mail.setContent(
      emailView({ ...email, TextBody: shown(email.TextBody), HtmlBody: email.HtmlBody && shown(email.HtmlBody) }),
    );
    await frame(mail, caption);
  } finally {
    await mail.close();
  }
}
