import { preload } from "react-dom";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import photoColours from "@/lib/content/hero-photo-colours.json";
import { HERO_PHOTOS } from "@/lib/content/hero-photos";
import { shuffle } from "@/lib/shuffle.server";
import { HERO_PHOTO_FADE_SCRIPT } from "./heroPhotoFade";
import styles from "./HomeHero.module.css";

const PHOTOS = "/images/front-page-hero-optimized";

/**
 * A photo's AVIF copies, which scripts/hero-photos-avif.mjs makes beside its
 * WebP: one under half the size, and a smaller one for a screen with one
 * pixel to the point. A browser that can't show AVIF gets the WebP.
 */
const avif = (src: string, smaller = false) => `${PHOTOS}/${src.replace(/\.webp$/, smaller ? "-1x.avif" : ".avif")}`;

/** Both copies, for the browser to choose between by its screen. */
const avifSet = (src: string) => `${avif(src, true)} 1x, ${avif(src)} 2x`;

/**
 * Each photo's average colour, which the same script works out. It fills the
 * photo's place until the photo has loaded, so the rows are there, and the
 * headline readable over them, as soon as the page paints.
 */
const COLOURS: Record<string, string> = photoColours;

/**
 * When a row's photo at `index` is wanted, so that the ones a visitor sees
 * first aren't held up by the rest, nor is anything else on the page:
 *
 * - "first": a row opens on its first photos, about two of them on a phone.
 *   They're fetched before anything else.
 * - "next": the ones the row brings on in its first few seconds. A row moving
 *   left ("ltr") brings on those after the first, and one moving right ("rtl")
 *   its last ones, the very last first. They're fetched with the page.
 * - "later": the rest wait until they're nearly on screen, or the page has
 *   loaded (HeroMarqueeEffects), whichever is first. A wide window fetches
 *   some of them with the page all the same (WIDE_OPENS_ON).
 */
function wantedWhen(index: number, count: number, dir: "ltr" | "rtl") {
  if (index < 2) return "first";
  const soon = dir === "rtl" ? index >= count - 2 : index < 4;
  return soon ? "next" : "later";
}

/**
 * A window this wide opens on more of each row than a phone does: its first
 * WIDE_OPENS_ON photos, about. Those of them left for later are fetched with
 * the page there, by a preload that only such a window acts on. Fetched with
 * the page on a phone as well, they would hold up the photos it is about to
 * bring on.
 */
const WIDE = "(min-width: 1024px)";
const WIDE_OPENS_ON = 5;

// The home page hero: three rows of photos scrolling in alternating
// directions behind the headline (HeroMarqueeEffects measures and starts
// them). Each photo fades in as it loads (heroPhotoFade.ts).
export default function HomeHero() {
  // Server-component shuffle: a new order each render (the same order in a
  // fixture build, lib/shuffle.server.ts). Sent to the client as part of the
  // rendered HTML so hydration matches.
  const shuffled = shuffle(HERO_PHOTOS);
  // Share the photos across three rows so none are dropped as the list grows.
  const perRow = Math.ceil(shuffled.length / 3);
  const heroRows = [
    { dir: "ltr" as const, photos: shuffled.slice(0, perRow) },
    { dir: "rtl" as const, photos: shuffled.slice(perRow, perRow * 2) },
    { dir: "ltr" as const, photos: shuffled.slice(perRow * 2) },
  ];
  // The top row's first photo is the largest thing on the page, so the browser is told to fetch it first.
  const [first] = heroRows[0].photos[0];
  preload(avif(first), { as: "image", imageSrcSet: avifSet(first), type: "image/avif", fetchPriority: "high" });

  // In the page's body, so a browser asks for them after the page's scripts, as it does the photos themselves.
  const widePreloads = heroRows
    .flatMap((row) =>
      row.photos
        .slice(0, WIDE_OPENS_ON)
        .filter((_, index) => wantedWhen(index, row.photos.length, row.dir) === "later"),
    )
    .map(([src]) => `<link rel="preload" as="image" type="image/avif" media="${WIDE}" imagesrcset="${avifSet(src)}">`)
    .join("");

  return (
    <section id="about">
      <script dangerouslySetInnerHTML={{ __html: HERO_PHOTO_FADE_SCRIPT }} />
      <div hidden dangerouslySetInnerHTML={{ __html: widePreloads }} />
      <div className={styles.marquee}>
        {heroRows.map((row, ri) => (
          <div key={ri} className={row.dir === "rtl" ? `${styles.row} ${styles.rtl}` : styles.row}>
            <div className={styles.track} data-marquee-track="hero">
              {[0, 1].map((copyIdx) => (
                <div
                  key={copyIdx}
                  className={styles.copy}
                  data-marquee-copy=""
                  {...(copyIdx > 0 ? { "aria-hidden": true } : {})}
                >
                  {[...row.photos, ...row.photos].map(([src, alt, width, height], i) => {
                    const isPrimary = copyIdx === 0 && i < row.photos.length;
                    // Each photo's first showing says when the file is fetched; its repeats are the same
                    // file. The files are served as they are, already the size the hero shows them, so
                    // nothing waits on an image service resizing them.
                    const wanted = isPrimary ? wantedWhen(i, row.photos.length, row.dir) : "later";
                    return (
                      <picture key={i} style={{ backgroundColor: COLOURS[src] }}>
                        <source type="image/avif" srcSet={avifSet(src)} />
                        <img
                          src={`${PHOTOS}/${src}`}
                          alt={isPrimary ? alt : ""}
                          width={width}
                          height={height}
                          aria-hidden={!isPrimary || undefined}
                          loading={wanted === "later" ? "lazy" : "eager"}
                          fetchPriority={wanted === "first" ? "high" : undefined}
                          decoding="async"
                        />
                      </picture>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className={styles.overlay}>
          <div className={styles.text}>
            <h1>
              Organising for
              <br />
              our future
            </h1>
            <p className={styles.lede}>
              We are the civic movement dedicated to averting the risks of superhuman artificial intelligence.
            </p>
            <div className={styles.actions}>
              <ButtonAnchor variant="primary" href="#join">
                Join PauseAI UK
              </ButtonAnchor>
              <div className={styles.secondary}>
                <ButtonAnchor variant="light" href="#events">
                  Upcoming events ↓
                </ButtonAnchor>
                <ButtonLink variant="light" href="/track-record/">
                  Track record →
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
