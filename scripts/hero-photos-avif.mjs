#!/usr/bin/env node
// Makes what the home page's hero needs of each of its photos, beyond the
// WebP itself (HomeHero):
//
// - its AVIF copies, which the page serves to every browser that can show
//   one: less than half the WebP's size, and a smaller one still for a screen
//   with one pixel to the point;
// - its colour, which fills the photo's place until the photo has loaded.
//
//   npm run data:hero-photos            # the AVIFs missing, or older than their WebP
//   npm run data:hero-photos -- --all   # every AVIF again
//
// Each `<name>.webp` in public/images/front-page-hero-optimized/ gets a
// `<name>.avif` beside it, at most MAX_HEIGHT tall. A row of the hero is at
// most about 320px tall, 215px on a phone, so that's enough for a screen with
// two or three pixels to the point. It gets a `<name>-1x.avif` too, at most
// MAX_HEIGHT_1X tall, for a screen with one: a desktop monitor, whose rows
// are up to about 375px tall. The colours, each the average of its
// photo, go in lib/content/hero-photo-colours.json. Run it after adding or
// changing a photo, and commit what it writes
// (tests/checks/public-assets.test.ts fails without).
//
// At QUALITY a photo looks the same as its WebP at the size the hero shows it,
// and soft only when zoomed in.
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const FOLDER = join("public", "images", "front-page-hero-optimized");
const COLOURS = join("lib", "content", "hero-photo-colours.json");
const MAX_HEIGHT = 640;
const MAX_HEIGHT_1X = 400;
const QUALITY = 45;

const all = process.argv.includes("--all");
let made = 0;
const colours = {};
for (const name of readdirSync(FOLDER)
  .filter((file) => file.endsWith(".webp"))
  .sort()) {
  const from = join(FOLDER, name);
  // The whole photo squeezed into one pixel is its average colour.
  const pixel = await sharp(from).resize(1, 1, { fit: "fill" }).removeAlpha().raw().toBuffer();
  colours[name] = `#${pixel.toString("hex")}`;

  for (const [to, height] of [
    [from.replace(/\.webp$/, ".avif"), MAX_HEIGHT],
    [from.replace(/\.webp$/, "-1x.avif"), MAX_HEIGHT_1X],
  ]) {
    if (!all && existsSync(to) && statSync(to).mtimeMs >= statSync(from).mtimeMs) continue;
    const { size } = await sharp(from)
      .resize({ height, withoutEnlargement: true })
      .avif({ quality: QUALITY, effort: 6 })
      .toFile(to);
    console.log(`${to}: ${Math.round(size / 1024)} KB, from ${Math.round(statSync(from).size / 1024)} KB`);
    made++;
  }
}
writeFileSync(COLOURS, `${JSON.stringify(colours, null, 2)}\n`);
console.log(made === 0 ? "Every photo has its AVIF already." : `Made ${made} AVIFs.`);
console.log(`Wrote each photo's colour to ${COLOURS}.`);
