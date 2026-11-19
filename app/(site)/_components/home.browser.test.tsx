import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import photoColours from "@/lib/content/hero-photo-colours.json";
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

/** A hex colour as the browser reports an element's: "rgb(1, 2, 3)". */
function rgb(hex: string) {
  const [red, green, blue] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${red}, ${green}, ${blue})`;
}

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
    // Each photo's first showing loads at once; its repeats, the same file, lazily.
    expect(container.querySelectorAll('img:not([loading="lazy"])')).toHaveLength(HERO_PHOTOS.length);
    // Each is served as its AVIF copy, with the WebP for a browser that can't show one.
    const first = container.querySelector("picture")!;
    const webp = first.querySelector("img")!.getAttribute("src")!;
    expect(webp).toMatch(/^\/images\/front-page-hero-optimized\/.+\.webp$/);
    expect(first.querySelector("source")).toHaveAttribute("type", "image/avif");
    expect(first.querySelector("source")).toHaveAttribute("srcset", webp.replace(/\.webp$/, ".avif"));
    expect(container.querySelectorAll("picture > source + img")).toHaveLength(HERO_PHOTOS.length * 4);
    // Until it loads, its place is filled with its own colour, as wide as the photo will be.
    const name = webp.split("/").at(-1)!;
    expect(first.style.backgroundColor).not.toBe("");
    expect(first.style.backgroundColor).toBe(rgb(photoColours[name as keyof typeof photoColours]));
    const [, , width, height] = HERO_PHOTOS.find(([src]) => src === name)!;
    const box = first.getBoundingClientRect();
    expect(box.width / box.height).toBeCloseTo(width / height, 1);
    // The first two photos of each row are fetched before the rest, the top row's first before anything.
    expect(first.querySelector("img")).toHaveAttribute("fetchpriority", "high");
    expect(container.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(6);
    for (const track of tracks) {
      const photos = [...track.querySelectorAll("img")];
      expect(photos.map((photo) => photo.getAttribute("fetchpriority")).slice(0, 3)).toEqual(["high", "high", null]);
    }
    const preloaded = document.head.querySelector('link[rel="preload"][as="image"][type="image/avif"]');
    expect(preloaded).toHaveAttribute("href", webp.replace(/\.webp$/, ".avif"));
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
