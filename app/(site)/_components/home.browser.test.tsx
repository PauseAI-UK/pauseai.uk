import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import photoPreviews from "@/lib/content/hero-photo-previews.json";
import { HERO_PHOTOS } from "@/lib/content/hero-photos";
import { localGroups } from "@/lib/content/local-groups";
import { people } from "@/lib/content/people";
import { newsRow1, outletAnchor, type PressLogo } from "@/lib/content/press-logos";
import { site } from "@/lib/content/site";
import GetInvolved from "./GetInvolved";
import { HERO_PHOTO_FADE_SCRIPT } from "./heroPhotoFade";
import HomeHero from "./HomeHero";
import { WHILE_LOADING_SCRIPT } from "./whileLoading";
import JoinSection from "./JoinSection";
import LocalGroupsSection from "./LocalGroupsSection";
import PeopleSection from "./PeopleSection";
import PressMarquee, { NewsRow } from "./PressMarquee";
import ShopBanner from "./ShopBanner";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HomeHero", () => {
  it("shows every photo once in three scrolling rows, each row twice", async () => {
    const { container } = await render(<HomeHero />);
    expect(container.querySelector("h1")?.textContent).toBe("Organising forour future");
    // Three rows, the middle one scrolling the other way.
    const tracks = [...container.querySelectorAll<HTMLElement>("[data-marquee-track]")];
    expect(tracks.map((t) => getComputedStyle(t).animationDirection)).toEqual(["normal", "reverse", "normal"]);
    // Each photo's alt text appears once; the repeats are hidden from screen readers.
    const described = [...container.querySelectorAll("img")].map((img) => img.getAttribute("alt")).filter(Boolean);
    expect(described.sort()).toEqual(HERO_PHOTOS.map(([, alt]) => alt).sort());
    expect(container.querySelectorAll('img[aria-hidden="true"]').length).toBe(HERO_PHOTOS.length * 3);
    // Each is served as its AVIF copy, with the WebP for a browser that can't show one.
    const first = tracks[0].querySelector("picture")!;
    const webp = first.querySelector("img")!.getAttribute("src")!;
    expect(webp).toMatch(/^\/images\/front-page-hero-optimized\/.+\.webp$/);
    expect(first.querySelector("source")).toHaveAttribute("type", "image/avif");
    // A screen with one pixel to the point gets a smaller copy.
    const avifs = `${webp.replace(/\.webp$/, "-1x.avif")} 1x, ${webp.replace(/\.webp$/, ".avif")} 2x`;
    expect(first.querySelector("source")).toHaveAttribute("srcset", avifs);
    expect(container.querySelectorAll("[data-marquee-track] picture > source + img")).toHaveLength(
      HERO_PHOTOS.length * 4,
    );
    // Until it loads, its place is filled with its preview, as wide as the photo will be. The preview is
    // written once, on the hero, however many times the photo is in it.
    const name = webp.split("/").at(-1)!;
    const preview = `url("data:image/webp;base64,${photoPreviews[name as keyof typeof photoPreviews]}")`;
    expect(getComputedStyle(first).backgroundImage).toBe(preview);
    expect(first.style.backgroundImage).toMatch(/^var\(--photo-\d+\)$/);
    expect(container.innerHTML.split(photoPreviews[name as keyof typeof photoPreviews])).toHaveLength(2);
    const [, , width, height] = HERO_PHOTOS.find(([src]) => src === name)!;
    expect(first.style.aspectRatio).toBe(`${width} / ${height}`);
    const box = first.getBoundingClientRect();
    expect(box.width / box.height).toBeCloseTo(width / height, 1);
    // Each row's photos are fetched in the order a visitor meets them: its first two before anything, then
    // the two it brings on next. It's the showing a visitor meets that's fetched, and the rest wait. The
    // rows moving left open on the start of their first copy. The row moving right opens on the start of
    // its second, and brings on the end of its first: its last two photos.
    const fetched = tracks.map((track) =>
      [...track.querySelectorAll("img")].map((photo) =>
        photo.getAttribute("fetchpriority") === "high" ? "first" : photo.loading === "eager" ? "next" : "later",
      ),
    );
    const later = (count: number) => Array.from({ length: count }, () => "later");
    const [top, middle, bottom] = [0, 1, 2].map((row) => Math.min(10, HERO_PHOTOS.length - row * 10));
    // The very first photo is preloaded, so none of its showings is lazy: Safari fetches a preloaded photo
    // again for an <img> that loads lazily.
    const topRow = ["first", "first", "next", "next", ...later(top * 4 - 4)];
    for (const again of [top, top * 2, top * 3]) topRow[again] = "next";
    expect(fetched[0]).toEqual(topRow);
    expect(fetched[1]).toEqual([...later(middle * 2 - 2), "next", "next", "first", "first", ...later(middle * 2 - 2)]);
    expect(fetched[2]).toEqual(["first", "first", "next", "next", ...later(bottom * 4 - 4)]);
    const preloaded = document.head.querySelector('link[rel="preload"][as="image"][type="image/avif"]');
    expect(preloaded).toHaveAttribute("imagesrcset", avifs);
    // A wide window opens on about five photos a row, and fetches with the page those of them that waited:
    // the fifth of the rows moving left, and the third to fifth of the row moving right. Each is a hidden
    // picture with a source for a wide window alone, and nothing to fetch otherwise. None is a preload.
    const sets = (track: HTMLElement, from: number, to: number) =>
      [...track.querySelectorAll("source")].slice(from, to).map((source) => source.getAttribute("srcset"));
    const wide = [...container.querySelectorAll("[hidden] picture")];
    expect(wide.map((picture) => picture.querySelector("source")!.getAttribute("srcset"))).toEqual([
      ...sets(tracks[0], 4, 5),
      ...sets(tracks[1], 2, 5),
      ...sets(tracks[2], 4, 5),
    ]);
    for (const picture of wide) {
      expect(picture.querySelector("source")).toHaveAttribute("media", "(min-width: 1024px)");
      expect(picture.querySelector("source")).toHaveAttribute("type", "image/avif");
      expect(picture.querySelector("img")).toHaveAttribute("src", expect.stringMatching(/^data:image\/gif;base64,/));
      expect(picture.querySelector("img")).toHaveAttribute("alt", "");
      expect(picture.querySelector("img")).not.toHaveAttribute("loading");
    }
    expect(document.querySelectorAll('link[rel="preload"][as="image"][media]')).toHaveLength(0);
    // Its scripts come before the photos: the one that marks the page as loading, so nothing is fetched
    // that should wait, and the fade's, so it's listening when the first photo loads.
    const scripts = [...container.querySelectorAll("script")];
    expect(scripts.map((script) => script.textContent)).toEqual([WHILE_LOADING_SCRIPT, HERO_PHOTO_FADE_SCRIPT]);
    expect(scripts[1].compareDocumentPosition(container.querySelector("img")!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await expect.element(page.getByRole("link", { name: "Track record →" })).toHaveAttribute("href", "/track-record");
  });

  it("gives a row its height before the rows after it have arrived", async () => {
    const { container } = await render(<HomeHero />);
    const rows = [...container.querySelectorAll<HTMLElement>("[data-marquee-track]")].map(
      (track) => track.parentElement!,
    );
    const height = rows[0].getBoundingClientRect().height;
    expect(height).toBeGreaterThan(50);
    for (const row of rows) expect(row.getBoundingClientRect().height).toBeCloseTo(height, 0);
    // A browser can paint the hero when only its first row has reached it: that row isn't the whole hero then.
    rows[1].style.display = "none";
    rows[2].style.display = "none";
    expect(rows[0].getBoundingClientRect().height).toBe(height);
  });
});

describe("while the home page loads", () => {
  // The script runs as the page is parsed, not when React renders it in a test.
  const run = () => new Function(WHILE_LOADING_SCRIPT)();
  const loading = () => document.documentElement.hasAttribute("data-loading");

  it("holds back the photos a visitor can't see yet, until the page has loaded", async () => {
    const { container } = await render(
      <main>
        <HomeHero />
        <PressMarquee />
        <div data-testid="card" style={{ backgroundImage: "url(/images/logos/Pause-Symbol.svg)" }} />
      </main>,
    );
    const logos = [...container.querySelectorAll("#news img")];
    const newsHeight = () => container.querySelector("#news")!.getBoundingClientRect().height;
    const settled = newsHeight();
    const card = page.getByTestId("card").element();
    const shown = (img: Element) => getComputedStyle(img).display !== "none";
    const [fetchedWithPage, waiting] = [
      [...container.querySelectorAll('[data-marquee-track="hero"] img[loading="eager"]')],
      [...container.querySelectorAll('[data-marquee-track="hero"] img[loading="lazy"]')],
    ];
    const preview = container.querySelector('[data-marquee-track="hero"] picture')!;

    run();
    expect(loading()).toBe(true);
    // A photo that's an element's background isn't fetched, and on a phone nor are the hero's that wait.
    expect(getComputedStyle(card).backgroundImage).toBe("none");
    expect(fetchedWithPage.every(shown)).toBe(true);
    expect(waiting.some(shown)).toBe(false);
    // Nor are the press logos, just below, whose rows keep their height.
    expect(logos.length).toBeGreaterThan(10);
    expect(logos.some(shown)).toBe(false);
    expect(newsHeight()).toBe(settled);
    // Each photo's place keeps its preview, and its width.
    expect(getComputedStyle(preview).backgroundImage).toContain("data:image/webp");
    const width = preview.getBoundingClientRect().width;
    // A wide window draws them all.
    await page.viewport(1280, 900);
    expect(waiting.every(shown)).toBe(true);
    await page.viewport(414, 896);

    window.dispatchEvent(new Event("load"));
    expect(loading()).toBe(false);
    expect(getComputedStyle(card).backgroundImage).toContain("Pause-Symbol.svg");
    expect(waiting.every(shown)).toBe(true);
    expect(logos.every(shown)).toBe(true);
    expect(preview.getBoundingClientRect().width).toBe(width);
  });

  it("stops holding them back after ten seconds, loaded or not", async () => {
    vi.useFakeTimers();
    try {
      run();
      expect(loading()).toBe(true);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(loading()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("home page sections", () => {
  it("scrolls the press logos, with the second copy hidden from screen readers", async () => {
    const { container } = await render(<PressMarquee />);
    const tracks = [...container.querySelectorAll("[data-marquee-track]")];
    expect(tracks).toHaveLength(5);
    expect(tracks.filter((t) => getComputedStyle(t).animationDirection === "reverse")).toHaveLength(2);
    // At this narrow test width the desktop rows are hidden by CSS, so look in the DOM.
    const first = newsRow1[0];
    const link = container.querySelector(`[data-marquee-track] a:has(img[alt="${first.outlet}"])`);
    expect(link?.getAttribute("href")).toBe(`/press#${outletAnchor(first.outlet)}`);
    await expect.element(page.getByRole("link", { name: "See our press page →" })).toHaveAttribute("href", "/press");
  });

  it("draws each outlet's logo at its own size, linking to its place on /press", async () => {
    const items: PressLogo[] = [
      {
        outlet: "The Example Times",
        logoSrc: "/images/x.svg",
        logoHeight: 30,
        logoIntrinsicWidth: 200,
        logoIntrinsicHeight: 50,
      },
    ];
    const { container } = await render(<NewsRow items={items} />);
    const img = container.querySelector("[data-marquee-copy]:first-child img") as HTMLElement;
    expect([img.getAttribute("width"), img.getAttribute("height")]).toEqual(["200", "50"]);
    expect(img.style.getPropertyValue("--logo-h")).toBe("30");
    expect(img.closest("a")?.getAttribute("href")).toBe("/press#the-example-times");
    expect(getComputedStyle(container.querySelector("[data-marquee-track]")!).animationDirection).toBe("normal");
    // The second copy can't be tabbed into.
    expect(
      [...container.querySelectorAll('[aria-hidden="true"] a')].every((a) => a.getAttribute("tabindex") === "-1"),
    ).toBe(true);
  });

  it("shows the local groups and how to start one", async () => {
    await render(<LocalGroupsSection />);
    for (const group of localGroups)
      await expect.element(page.getByRole("heading", { name: group.name, level: 3 })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Start a local group →" })).toHaveAttribute("target", "_blank");
  });

  it("links to every story", async () => {
    await render(<PeopleSection />);
    await expect
      .element(page.getByRole("link", { name: `Read all ${people.length} stories →` }))
      .toHaveAttribute("href", "/people");
    await expect
      .element(page.getByRole("link", { name: "Share your story →" }))
      .toHaveAttribute("href", "/people#share-your-story");
  });

  it("links to the shop", async () => {
    await render(<ShopBanner />);
    await expect.element(page.getByRole("link", { name: "Browse the shop →" })).toHaveAttribute("href", site.shopUrl);
    await expect.element(page.getByRole("img", { name: "PauseAI merchandise" })).toBeInTheDocument();
  });

  it("embeds the onboarding form", async () => {
    vi.spyOn(HTMLIFrameElement.prototype, "src", "set").mockImplementation(() => {});
    await render(<JoinSection />);
    await expect.element(page.getByRole("heading", { name: "Join PauseAI UK" })).toBeVisible();
    await expect.element(page.getByTitle("Get involved!")).toBeInTheDocument();
  });

  it("links to the WhatsApp community and the calendar", async () => {
    await render(<GetInvolved />);
    await expect
      .element(page.getByRole("link", { name: "Join the WhatsApp community" }))
      .toHaveAttribute("href", "/whatsapp?utm_source=get-involved");
    await expect.element(page.getByRole("link", { name: "event calendar" })).toHaveAttribute("href", site.social.luma);
  });
});
