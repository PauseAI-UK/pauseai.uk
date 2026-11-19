"use client";

import { useEffect } from "react";
import { HERO_PHOTO_FADE_SCRIPT } from "./heroPhotoFade";

// Sets --copy-shift on each marquee track (data-marquee-track, its first
// copy data-marquee-copy). Runs as a React effect (after hydration)
// rather than a raw inline <script> so it can't mutate the DOM before
// React finishes hydrating and cause a hydration mismatch.
//
// It also runs the hero photos' fade script (heroPhotoFade.ts). React doesn't
// run a script in a page it renders in the browser, so the hero's own inline
// copy only runs when the home page is the first page loaded. And it fetches
// the hero's later photos once the page has loaded.
export default function HeroMarqueeEffects() {
  useEffect(() => {
    const fade = document.createElement("script");
    fade.textContent = HERO_PHOTO_FADE_SCRIPT;
    document.head.append(fade);
    fade.remove();

    const cleanups: Array<() => void> = [];

    // The hero's photos that were left for later (HomeHero) are fetched once
    // the page has loaded, so they're there before their rows bring them on,
    // without having held anything up.
    function fetchTheRest() {
      document.querySelectorAll<HTMLImageElement>('[data-marquee-track="hero"] img[loading="lazy"]').forEach((img) => {
        img.loading = "eager";
      });
    }
    if (document.readyState === "complete") {
      fetchTheRest();
    } else {
      window.addEventListener("load", fetchTheRest);
      cleanups.push(() => window.removeEventListener("load", fetchTheRest));
    }

    document.querySelectorAll<HTMLElement>("[data-marquee-track]").forEach((track) => {
      const copy = track.querySelector<HTMLElement>("[data-marquee-copy]");
      if (!copy) return;

      function update() {
        const w = copy!.getBoundingClientRect().width;
        if (w > 0) track.style.setProperty("--copy-shift", `-${w}px`);
      }
      update();

      if (window.ResizeObserver) {
        const observer = new ResizeObserver(update);
        observer.observe(copy);
        cleanups.push(() => observer.disconnect());
      } else {
        window.addEventListener("resize", update);
        cleanups.push(() => window.removeEventListener("resize", update));
      }

      if (document.fonts?.ready) {
        void document.fonts.ready.then(update);
      }

      copy.querySelectorAll("img").forEach((img) => {
        if (!img.complete) {
          img.addEventListener("load", update, { once: true });
        }
      });
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
