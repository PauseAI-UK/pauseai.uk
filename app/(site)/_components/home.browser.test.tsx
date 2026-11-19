import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import photoPreviews from "@/lib/content/hero-photo-previews.json";
import { HERO_PHOTOS } from "@/lib/content/hero-photos";
import { localGroups } from "@/lib/content/local-groups";
import { people } from "@/lib/content/people";
import { newsRow1, type CoverageItem } from "@/lib/content/press-coverage";
import { site } from "@/lib/content/site";
import { staff } from "@/lib/content/staff";
import GetInvolved from "./GetInvolved";
import { HERO_PHOTO_FADE_SCRIPT } from "./heroPhotoFade";
import HomeHero from "./HomeHero";
import JoinSection from "./JoinSection";
import LocalGroupsSection from "./LocalGroupsSection";
import PeopleSection from "./PeopleSection";
import PressMarquee, { NewsRow } from "./PressMarquee";
import ShopBanner from "./ShopBanner";
import StaffSection from "./StaffSection";

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
    const first = container.querySelector("picture")!;
    const webp = first.querySelector("img")!.getAttribute("src")!;
    expect(webp).toMatch(/^\/images\/front-page-hero-optimized\/.+\.webp$/);
    expect(first.querySelector("source")).toHaveAttribute("type", "image/avif");
    // A screen with one pixel to the point gets a smaller copy.
    const avifs = `${webp.replace(/\.webp$/, "-1x.avif")} 1x, ${webp.replace(/\.webp$/, ".avif")} 2x`;
    expect(first.querySelector("source")).toHaveAttribute("srcset", avifs);
    expect(container.querySelectorAll("picture > source + img")).toHaveLength(HERO_PHOTOS.length * 4);
    // Until it loads, its place is filled with its preview, as wide as the photo will be. The preview is
    // written once, on the hero, however many times the photo is in it.
    const name = webp.split("/").at(-1)!;
    const preview = `url("data:image/webp;base64,${photoPreviews[name as keyof typeof photoPreviews]}")`;
    expect(getComputedStyle(first).backgroundImage).toBe(preview);
    expect(first.getAttribute("style")).toMatch(/^background-image: ?var\(--photo-\d+\);?$/);
    expect(container.innerHTML.split(photoPreviews[name as keyof typeof photoPreviews])).toHaveLength(2);
    const [, , width, height] = HERO_PHOTOS.find(([src]) => src === name)!;
    const box = first.getBoundingClientRect();
    expect(box.width / box.height).toBeCloseTo(width / height, 1);
    // Each row's photos are fetched in the order a visitor meets them: its first two before anything, then
    // the two it brings on next, which on the row moving right are its last. The rest wait, as do the
    // repeats, which are the same files.
    const fetched = tracks.map((track) =>
      [...track.querySelectorAll("img")].map((photo) =>
        photo.getAttribute("fetchpriority") === "high" ? "first" : photo.loading === "eager" ? "next" : "later",
      ),
    );
    const later = (count: number) => Array.from({ length: count }, () => "later");
    const [top, middle, bottom] = [0, 1, 2].map((row) => Math.min(10, HERO_PHOTOS.length - row * 10));
    expect(fetched[0]).toEqual(["first", "first", "next", "next", ...later(top * 4 - 4)]);
    expect(fetched[1]).toEqual(["first", "first", ...later(middle - 4), "next", "next", ...later(middle * 3)]);
    expect(fetched[2]).toEqual(["first", "first", "next", "next", ...later(bottom * 4 - 4)]);
    // A wide window opens on about five photos a row, and fetches with the page those of them that waited:
    // the fifth of the rows moving left, and the third to fifth of the row moving right.
    const sets = (track: HTMLElement, from: number, to: number) =>
      [...track.querySelectorAll("source")].slice(from, to).map((source) => source.getAttribute("srcset"));
    const wide = [...container.querySelectorAll('link[rel="preload"][as="image"]')];
    expect(wide.map((link) => link.getAttribute("imagesrcset"))).toEqual([
      ...sets(tracks[0], 4, 5),
      ...sets(tracks[1], 2, 5),
      ...sets(tracks[2], 4, 5),
    ]);
    for (const link of wide) {
      expect(link).toHaveAttribute("media", "(min-width: 1024px)");
      expect(link).toHaveAttribute("type", "image/avif");
    }
    const preloaded = document.head.querySelector('link[rel="preload"][as="image"][type="image/avif"]');
    expect(preloaded).toHaveAttribute("imagesrcset", avifs);
    // The fade's script comes before the photos, so it's listening when the first loads.
    const script = container.querySelector("script")!;
    expect(script.textContent).toBe(HERO_PHOTO_FADE_SCRIPT);
    expect(script.compareDocumentPosition(container.querySelector("img")!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await expect.element(page.getByRole("link", { name: "Track record →" })).toHaveAttribute("href", "/track-record");
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
    const link = [...container.querySelectorAll("[data-marquee-track] a")].find(
      (a) => a.getAttribute("aria-label") === `${first.outlet}: ${first.title}`,
    );
    expect(link?.getAttribute("href")).toBe(first.url);
    await expect.element(page.getByRole("link", { name: "See our press page →" })).toHaveAttribute("href", "/press");
  });

  it("draws an outlet's logo from its image or its HTML, with default sizes", async () => {
    const items: CoverageItem[] = [
      { outlet: "Image", title: "A", medium: "Article", url: "https://a.example", logoSrc: "/images/x.svg" },
      {
        outlet: "Sized",
        title: "B",
        medium: "Article",
        url: "https://b.example",
        logoSrc: "/images/y.svg",
        logoIntrinsicWidth: 200,
        logoIntrinsicHeight: 50,
        logoHeight: 30,
      },
      { outlet: "Html", title: "C", medium: "Article", url: "https://c.example", logoHtml: "<b>Html</b>" },
    ];
    const { container } = await render(<NewsRow items={items} />);
    const imgs = container.querySelectorAll("[data-marquee-copy]:first-child img");
    expect([imgs[0].getAttribute("width"), imgs[0].getAttribute("height")]).toEqual(["100", "44"]);
    expect((imgs[0] as HTMLElement).style.getPropertyValue("--logo-h")).toBe("");
    expect((imgs[1] as HTMLElement).style.getPropertyValue("--logo-h")).toBe("30");
    expect(container.querySelector("[data-marquee-copy]:first-child b")?.textContent).toBe("Html");
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
      .toHaveAttribute("href", site.whatsappUrl);
    await expect.element(page.getByRole("link", { name: "event calendar" })).toHaveAttribute("href", site.social.luma);
  });

  it("introduces the staff, and links to the jobs page", async () => {
    const { container } = await render(<StaffSection />);
    for (const member of staff) await expect.element(page.getByRole("heading", { name: member.name })).toBeVisible();
    expect(
      (container.querySelector("article [style*='background-image']") as HTMLElement).style.backgroundImage,
    ).toContain(encodeURI(staff[0].imageSrc).replace(/\(/g, "%28").replace(/\)/g, "%29").slice(0, 10));
    await expect.element(page.getByRole("link", { name: "We’re hiring →" })).toHaveAttribute("href", "/jobs");
  });
});
