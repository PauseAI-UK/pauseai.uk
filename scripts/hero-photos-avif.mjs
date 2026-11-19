#!/usr/bin/env node
// Makes the AVIF copy of each photo in the home page's hero, which the page
// serves to every browser that can show one (HomeHero): less than half the
// WebP's size.
//
//   npm run data:hero-photos            # those missing, or older than their WebP
//   npm run data:hero-photos -- --all   # every one again
//
// Each `<name>.webp` in public/images/front-page-hero-optimized/ gets a
// `<name>.avif` beside it, at most MAX_HEIGHT tall. A row of the hero is at
// most about 320px tall, 215px on a phone, so that's enough for a screen with
// two or three pixels to the point. Run it after adding or changing a photo,
// and commit the AVIF with it (tests/checks/public-assets.test.ts fails
// without).
//
// At QUALITY a photo looks the same as its WebP at the size the hero shows it,
// and soft only when zoomed in.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const FOLDER = join("public", "images", "front-page-hero-optimized");
const MAX_HEIGHT = 640;
const QUALITY = 45;

const all = process.argv.includes("--all");
let made = 0;
for (const name of readdirSync(FOLDER).filter((file) => file.endsWith(".webp"))) {
  const from = join(FOLDER, name);
  const to = from.replace(/\.webp$/, ".avif");
  if (!all && existsSync(to) && statSync(to).mtimeMs >= statSync(from).mtimeMs) continue;
  const { size } = await sharp(from)
    .resize({ height: MAX_HEIGHT, withoutEnlargement: true })
    .avif({ quality: QUALITY, effort: 6 })
    .toFile(to);
  console.log(`${to}: ${Math.round(size / 1024)} KB, from ${Math.round(statSync(from).size / 1024)} KB`);
  made++;
}
console.log(made === 0 ? "Every photo has its AVIF already." : `Made ${made}.`);
