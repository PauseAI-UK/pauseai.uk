import { expect, type Locator, type Page } from "@playwright/test";

// What the flows wait for, rather than a fixed time: the page has
// hydrated and its console has gone quiet, a smooth scroll has come to rest,
// the layout has stopped moving. Each polls on a timer, not
// requestAnimationFrame, which can stall in a backgrounded headless context.

/** Polled on a timer, so a backgrounded page still answers. */
const POLL = { polling: 50, timeout: 20_000 };

/**
 * The page has loaded and hydrated: Nav's effect has set --site-header-h on
 * the root (a page without it, like the staff login, has nothing to wait
 * for), the fonts are in, and the console has been quiet
 * for a moment, so a hydration warning, which React logs just after mount,
 * has had its chance.
 */
export async function hydrated(page: Page): Promise<void> {
  let lastMessage = Date.now();
  const onMessage = () => (lastMessage = Date.now());
  page.on("console", onMessage);
  try {
    await page.waitForFunction(
      () =>
        document.readyState === "complete" &&
        (getComputedStyle(document.documentElement).getPropertyValue("--site-header-h").trim() !== "" ||
          !document.querySelector('header button[aria-label="Menu"], header a[aria-label="PauseAI UK"]')),
      undefined,
      POLL,
    );
    await page.evaluate(() => document.fonts.ready);
    lastMessage = Date.now();
    await quiet(page, () => Date.now() - lastMessage >= 250, 3000);
  } finally {
    page.off("console", onMessage);
  }
}

/** How many polls in a row (50ms apart) the page must hold still to be at rest. */
const STILL_POLLS = 6;

/**
 * The page is at rest, as a frame pictures and checks it. It's styled: every
 * stylesheet it links to has loaded and the fonts are in, as after a
 * client-side navigation the page can show before its stylesheets arrive.
 * And it has held still for STILL_POLLS polls in a row: the same scroll, the
 * same height, no change to the DOM, and no animation or transition under
 * way (one that repeats for ever, a spinner's, doesn't count). On a busy
 * machine what a step sets going can start late, a smooth scroll, a scroll
 * the browser restores after a reload, a sticky bar an IntersectionObserver
 * shows or hides once it notices a scroll, and a shorter wait catches the
 * page before it moves.
 */
export async function atRest(page: Page): Promise<void> {
  await page.waitForFunction(
    () => [...document.querySelectorAll<HTMLLinkElement>("link[rel=stylesheet]")].every((link) => link.sheet),
    undefined,
    POLL,
  );
  await page.evaluate(() => document.fonts.ready);
  await page
    .waitForFunction(
      (polls) => {
        type Rest = { key: string; same: number; changed: boolean; watch: MutationObserver };
        const w = window as typeof window & { __rest?: Rest };
        if (!w.__rest) {
          const rest: Rest = {
            key: "",
            same: 0,
            changed: false,
            watch: new MutationObserver(() => (rest.changed = true)),
          };
          rest.watch.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          });
          w.__rest = rest;
        }
        const s = w.__rest;
        const moving = document
          .getAnimations()
          .some((a) => a.playState === "running" && a.effect?.getComputedTiming().iterations !== Infinity);
        const key = `${window.scrollX},${window.scrollY},${document.documentElement.scrollHeight},${window.innerWidth}`;
        s.same = key === s.key && !s.changed && !moving ? s.same + 1 : 0;
        s.key = key;
        s.changed = false;
        return s.same >= polls;
      },
      STILL_POLLS,
      POLL,
    )
    .finally(() =>
      page
        .evaluate(() => {
          const w = window as typeof window & { __rest?: { watch: MutationObserver } };
          w.__rest?.watch.disconnect();
          delete w.__rest;
        })
        // A page that navigated away has nothing to tidy.
        .catch(() => {}),
    );
}

/**
 * React has taken over `element`: hydration has given it its handlers, which
 * React keeps on the element under a `__reactProps$` key. Before then a press
 * gets the browser's own behaviour, or none, as a Next link's does while its
 * page hydrates around it.
 */
export async function handled(element: Locator): Promise<void> {
  await expect
    .poll(() => element.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps$"))), {
      timeout: POLL.timeout,
    })
    .toBe(true);
}

/** Polls `ready` on the test side until it's true, or `timeoutMs` has passed (then carries on). */
async function quiet(page: Page, ready: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!ready() && Date.now() < deadline) await page.waitForTimeout(50);
}

/**
 * The scroll position has come to rest: the same for three polls in a row
 * (100ms), which outlasts any pause in a smooth scroll. Call it after the
 * thing that starts the scroll, so the first poll sees it under way.
 */
export async function scrollSettled(page: Page): Promise<number> {
  await page.waitForFunction(
    () => {
      const w = window as typeof window & { __settle?: { y: number; same: number } };
      const s = (w.__settle ??= { y: -1, same: 0 });
      s.same = Math.abs(window.scrollY - s.y) < 1 ? s.same + 1 : 0;
      s.y = window.scrollY;
      return s.same >= 2;
    },
    undefined,
    POLL,
  );
  await page.evaluate(() => {
    delete (window as typeof window & { __settle?: unknown }).__settle;
  });
  return page.evaluate(() => window.scrollY);
}

/**
 * Presses `trigger`, which opens a bubble (components/ui/Bubble.tsx), and
 * waits for the page to come to rest. Once open, the bubble scrolls the page
 * to show itself, on its toggle event, a task after the press returns; on a
 * busy machine that lands while a press inside it is under way, which then
 * lands where its button was, outside the bubble, and closes it; a frame
 * taken then shows the page wherever the scroll had got to. A menu
 * (Menu.tsx) opens the same way, though it scrolls nothing.
 *
 * Returns what's open, to find things in, and to check it has closed
 * (`toHaveCount(0)`). It's every open popover, so with a bubble opened from
 * inside a menu it's both, the bubble last. A flow can't find an open popover
 * by its selector instead: ESLint keeps `:popover-open` out of the rest of
 * tests/storyboard (eslint.config.mjs, OPEN_BUBBLE_RULES).
 */
export async function openBubble(trigger: Locator): Promise<Locator> {
  const page = trigger.page();
  const open = page.locator("[popover]:popover-open");
  await trigger.click();
  await expect(open.first()).toBeVisible();
  // The toggle event's task, and the frame after it.
  await page.evaluate(
    () => new Promise<void>((done) => setTimeout(() => requestAnimationFrame(() => setTimeout(done)))),
  );
  await scrollSettled(page);
  return open;
}

/**
 * The layout around `selector` has stopped moving: every image is in, and
 * its position and the page's height are the same for three polls in a row.
 */
export async function layoutSettled(page: Page, selector: string): Promise<void> {
  await page.evaluate(async () => {
    for (const img of document.querySelectorAll("img[loading=lazy]")) img.setAttribute("loading", "eager");
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) =>
        img.complete
          ? undefined
          : new Promise<void>((done) => {
              img.addEventListener("load", () => done(), { once: true });
              img.addEventListener("error", () => done(), { once: true });
            }),
      ),
    );
  });
  await page.waitForFunction(
    (sel) => {
      const w = window as typeof window & { __layout?: { key: string; same: number } };
      const s = (w.__layout ??= { key: "", same: 0 });
      const el = document.querySelector(sel);
      const key = `${el?.getBoundingClientRect().top ?? "none"}:${document.documentElement.scrollHeight}`;
      s.same = key === s.key ? s.same + 1 : 0;
      s.key = key;
      return s.same >= 2;
    },
    selector,
    POLL,
  );
  await page.evaluate(() => {
    delete (window as typeof window & { __layout?: unknown }).__layout;
  });
}

/**
 * Leaves any field and goes back to the top, and stays there, so the next
 * frame is of the whole page. Typing, or ticking a box, scrolls it into
 * view, and where that leaves the window differs by a few pixels between
 * runs; an editor may scroll its caret back into view a frame later. After
 * Back, the browser puts the window where it was as the page loads, which
 * can be after it was sent to the top: so it waits for the load, and the
 * top has to hold for a few frames. So does leaving the field: on a busy
 * machine an editor can take focus back after the blur, and its ring would
 * show in one run and not the next.
 */
export async function wholePage(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const inField = () => document.activeElement !== null && document.activeElement !== document.body;
        if (inField()) (document.activeElement as HTMLElement).blur();
        window.scrollTo({ top: 0, behavior: "instant" });
        const tick = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 50)));
        for (let i = 0; i < 4 && window.scrollY === 0 && !inField(); i++) await tick();
        return window.scrollY === 0 && !inField();
      }),
    )
    .toBe(true);
}
