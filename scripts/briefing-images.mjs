#!/usr/bin/env node
// Makes the pictures a week's briefing needs from its designer's HTML
// (docs/code-structure.md, "Adding a week's briefing"):
//
// - each drawing, an inline <svg> in a <figure>, as a PNG three times its
//   size, in public/images/briefings/<name>.png, drawn in Chromium with the
//   design's font, Roboto, so its words sit where the designer put them;
// - each country's flag missing from public/images/briefings/flags/, as
//   flagcdn.com's waving flag, set on the same 84 by 68 canvas as the others.
//
//   node scripts/briefing-images.mjs <file.html>                         # lists the drawings, makes nothing
//   node scripts/briefing-images.mjs <file.html> --figures a,b --flags cn,us
//
// --figures names the drawings in the order they come in the HTML. It
// prints each one's width and height, for BriefingFigure.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const SCALE = 3;
const DIR = "public/images/briefings";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { figures: { type: "string" }, flags: { type: "string" } },
});
const [file] = positionals;
if (!file) {
  console.error("Usage: node scripts/briefing-images.mjs <file.html> [--figures a,b] [--flags cn,us]");
  process.exit(1);
}

const svgs = [...readFileSync(file, "utf8").matchAll(/<figure>\s*(<svg[\s\S]*?<\/svg>)/g)].map((match) => match[1]);
const label = (svg) => svg.match(/aria-label="([^"]*)"/)?.[1] ?? "(no label)";

if (!values.figures) {
  svgs.forEach((svg, i) => console.log(`${i + 1}. ${label(svg)}`));
  console.log(`${svgs.length} drawings. Name them, in this order, with --figures.`);
} else {
  const names = values.figures.split(",");
  if (names.length !== svgs.length) {
    console.error(`${svgs.length} drawings, but ${names.length} names.`);
    process.exit(1);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: SCALE });
  for (const [i, svg] of svgs.entries()) {
    const [, width, height] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    await page.setContent(
      `<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700;800&display=swap" rel="stylesheet">` +
        `<style>body{margin:0;background:#fff}svg{display:block;width:${width}px;height:${height}px}</style>${svg}`,
      { waitUntil: "networkidle" },
    );
    await page.evaluate(() => document.fonts.ready);
    const png = await page.locator("svg").screenshot();
    const path = `${DIR}/${names[i]}.png`;
    writeFileSync(path, await sharp(png).png({ palette: true, colors: 128 }).toBuffer());
    const meta = await sharp(path).metadata();
    console.log(`${path}: width={${meta.width}} height={${meta.height}}  ${label(svg)}`);
  }
  await browser.close();
}

for (const code of values.flags?.split(",") ?? []) {
  const path = `${DIR}/flags/${code}.png`;
  if (existsSync(path)) continue;
  const response = await fetch(`https://flagcdn.com/84x63/${code}.png`);
  if (!response.ok) throw new Error(`No flag for "${code}" on flagcdn.com: ${response.status}`);
  // The flag 74 by 56, 5px in from the top left, as the flags already here are.
  await sharp(Buffer.from(await response.arrayBuffer()))
    .ensureAlpha()
    .resize(74, 56, { fit: "fill" })
    .extend({ top: 5, left: 5, right: 5, bottom: 7, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path);
  console.log(`${path}: new`);
}
