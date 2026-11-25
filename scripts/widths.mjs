#!/usr/bin/env node
// Pictures pages at the widths the storyboard doesn't: it pictures 1280px and
// a phone's, and a layout that goes wrong between them or past them is never
// seen. This opens the pages of the branch `npm run serve` serves, in
// Firefox, logged in with the dev login, at each width from a phone's to a
// big monitor's, and writes the pictures and one page that sets them side by
// side to tmp/widths/.
//
//   npm run widths -- /staff/politicians /staff/sent-emails
//   npm run widths -- /staff/politicians --tables --widths 1024,1440,1680
//   npm run widths -- /donate --link http://192.168.1.5:7100/
//
// `--tables` also lists, at each width, each table that runs past its box,
// each date that takes two lines and each column whose words wrap to three
// lines or more. `--link` names the site, where it isn't this checkout's
// `npm run serve`.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join("tmp", "widths");

/** A phone's, a small tablet's, a tablet's, a laptop's, the storyboard's desktop, and wider monitors'. */
export const WIDTHS = [390, 768, 1024, 1280, 1440, 1680, 1920];

/** The migrations' admin account, which opens every staff page (scripts/serve.mjs). */
const ADMIN = "admin@pauseai.uk";

/**
 * What the command line asks for: the pages, by path, and the widths,
 * whether to look at tables, and the site's address if given.
 *
 * @returns {{ paths: string[], widths: number[], tables: boolean, link?: string }}
 */
export function parseWidths(args) {
  const options = { paths: [], widths: WIDTHS, tables: false, link: undefined };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--tables") options.tables = true;
    else if (arg === "--widths") {
      options.widths = (args[++i] ?? "").split(",").map(Number);
      if (options.widths.some((width) => !Number.isInteger(width) || width < 200))
        throw new Error("--widths takes whole numbers of pixels, 200 or more, with commas between");
    } else if (arg === "--link") options.link = args[++i];
    else if (arg.startsWith("/")) options.paths.push(arg);
    else throw new Error(`Unknown argument ${arg}: give pages as paths starting with /`);
  }
  if (options.paths.length === 0) throw new Error("Name a page or more: npm run widths -- /staff/politicians");
  return options;
}

/** The file a page's picture at a width goes in. */
export const pictureName = (path, width) =>
  `${path.replace(/^\/$/, "/home").slice(1).replace(/\W+/g, "-")}-${width}.png`;

/** The page that sets each page's pictures side by side, a row a page, with what `--tables` found under each. */
export function widthsPage(paths, widths, found = {}) {
  const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = paths
    .map((path) => {
      const cells = widths
        .map((width) => {
          const name = pictureName(path, width);
          const notes = (found[name] ?? []).map((note) => `<li>${escape(note)}</li>`).join("");
          return `<figure><figcaption>${width}px</figcaption><a href="${name}"><img src="${name}" alt="${escape(path)} at ${width}px" loading="lazy"></a>${notes ? `<ul>${notes}</ul>` : ""}</figure>`;
        })
        .join("");
      return `<section><h2>${escape(path)}</h2><div class="row">${cells}</div></section>`;
    })
    .join("\n");
  return `<!doctype html><meta charset="utf-8"><title>Widths</title>
<style>body{font:14px system-ui;margin:16px}.row{display:flex;gap:16px;overflow-x:auto;align-items:flex-start}
figure{margin:0;flex:none;width:320px}img{width:100%;border:1px solid #ccc}ul{color:#b00;padding-left:16px}</style>
${rows}`;
}

/**
 * Run in the page: what's wrong with its tables at this width. Each table
 * wider than the box it's in, saying whether that box scrolls sideways, each date (a <time>) on more than one line, and
 * each column with a cell whose words wrap to three lines or more, by its
 * heading.
 */
function tableProblems() {
  const problems = [];
  const lines = (element) => {
    const style = getComputedStyle(element);
    const height = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    return Math.round(element.getBoundingClientRect().height / height);
  };
  for (const [n, table] of [...document.querySelectorAll("table")].entries()) {
    // The nearest box that scrolls sideways, if any: past it, the rest is a scroll away; past any other, cut off.
    let scroller = table.parentElement;
    while (scroller && !["auto", "scroll"].includes(getComputedStyle(scroller).overflowX))
      scroller = scroller.parentElement;
    const box = (scroller ?? table.parentElement).getBoundingClientRect();
    const own = table.getBoundingClientRect();
    if (own.width > box.width + 1)
      problems.push(
        `table ${n + 1} runs ${Math.round(own.width - box.width)}px past its box, ${scroller ? "which scrolls sideways" : "which cuts it off"}`,
      );
    const headings = [...table.querySelectorAll("thead th")].map((th) => th.textContent.trim());
    const wrapped = new Set();
    for (const row of table.querySelectorAll("tbody tr")) {
      [...row.children].forEach((cell, column) => {
        const words = document.createRange();
        words.selectNodeContents(cell);
        const rects = [...words.getClientRects()].map((rect) => Math.round(rect.top));
        if (new Set(rects).size >= 3) wrapped.add(headings[column] || `column ${column + 1}`);
      });
    }
    for (const heading of wrapped) problems.push(`table ${n + 1}: "${heading}" wraps to three lines or more`);
  }
  for (const time of document.querySelectorAll("time")) {
    if (lines(time) > 1) problems.push(`the date "${time.textContent.trim()}" takes ${lines(time)} lines`);
  }
  return problems;
}

/** This checkout's served address, from `npm run serve`'s note of it. */
function servedLink() {
  const file = join("tmp", "serve.json");
  if (!existsSync(file)) throw new Error("Nothing is served from this checkout: npm run serve first, or give --link.");
  return JSON.parse(readFileSync(file, "utf8")).link;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { paths, widths, tables, link = servedLink() } = parseWidths(process.argv.slice(2));
  const { firefox } = await import("@playwright/test");
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto(new URL("/staff/login", link).toString(), { timeout: 120_000 });
  await page.getByRole("button", { name: ADMIN }).click();
  await page.waitForURL((url) => url.pathname === "/staff", { timeout: 120_000 });
  const found = {};
  for (const path of paths) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(new URL(path, link).toString(), { waitUntil: "networkidle", timeout: 120_000 });
      const name = pictureName(path, width);
      await page.screenshot({ path: join(OUT, name), fullPage: true });
      if (tables) found[name] = await page.evaluate(tableProblems);
      console.log(`${path} at ${width}px${found[name]?.length ? `: ${found[name].join("; ")}` : ""}`);
    }
  }
  await browser.close();
  writeFileSync(join(OUT, "index.html"), widthsPage(paths, widths, found));
  console.log(`\n${join(OUT, "index.html")}`);
}
