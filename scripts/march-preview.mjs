#!/usr/bin/env node
// Remakes the link preview for the next march's sign-up: a picture of
// /march's hero (its photo, headline, date, time and place), which WhatsApp,
// X, Bluesky and the rest show for a link to /march. The date and place are
// in the picture, so run this whenever they change in lib/content/march.ts,
// or the hero does.
//
//   npm run dev                      # in another terminal
//   npm run march:preview            # or: node scripts/march-preview.mjs <base url>
//
// It loads the page in headless Chromium at 1200×630, hides what only works on
// the page (the buttons, the count of those registered, the header, the
// cookie banner and Next's dev badge), and writes public/images/march-signup/apr-27/
// open-graph-1200-630.jpg (Open Graph) and open-graph-1600-840.jpg (X), the
// same layout at 4/3 the pixels. The march's page.tsx names them
// (app/(march)/demonstrations/march-against-ai-extinction-apr-27/). The
// pictures beside that folder are the November 2026 march's, made the same way.
import { chromium } from "@playwright/test";
import sharp from "sharp";

const base = process.argv[2] ?? "http://localhost:3000";
const out = "public/images/march-signup/apr-27";

const css = `
  [class*="hero-cta"], [class*="hero-going"], header, [role="dialog"],
  [class*="consent" i], [class*="cookie" i], nextjs-portal { display: none !important; }
  section:has(> [class*="hero-inner"]) {
    min-height: 0 !important; height: 630px !important; padding: 0 !important;
    justify-content: center !important;
  }
  [class*="hero-inner"] { padding-inline: 60px !important; }
`;

const browser = await chromium.launch();
try {
  for (const [name, scale] of [
    ["1200-630", 1],
    ["1600-840", 4 / 3],
  ]) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: scale });
    await page.goto(`${base}/march`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: css });
    await page.evaluate(() => document.fonts.ready);
    const hero = page.locator("section:has(> [class*='hero-inner'])");
    // The photo is a next/image: wait until it's drawn.
    await hero.evaluate((el) => Promise.all([...el.querySelectorAll("img")].map((img) => img.decode())));
    const png = await hero.screenshot({ animations: "disabled" });
    const file = `${out}/open-graph-${name}.jpg`;
    await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toFile(file);
    console.log(`wrote ${file}`);
    await page.close();
  }
} finally {
  await browser.close();
}
