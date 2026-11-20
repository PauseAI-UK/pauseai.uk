#!/usr/bin/env node
// Times a page loading on a simulated 4G connection, for each of several
// versions of the site, and sets them side by side: when the page first
// paints, when its first image shows, when its last does, and how long and
// how many bytes the whole page takes, with a filmstrip of each load.
//
//   npm run measure -- origin/main HEAD                  # the home page, two versions
//   npm run measure -- main=origin/main fade=HEAD        # the same, named
//   npm run measure -- --path /donate --runs 9 origin/main HEAD
//   npm run measure -- --viewport phone --network slow-4g origin/main HEAD
//   npm run measure -- --images '[data-marquee-track="hero"] img' origin/main HEAD
//   npm run measure -- live=https://pauseai.uk HEAD      # a site that's already up, as it is
//   npm run measure -- --http2 origin/main HEAD          # each build over HTTP/2, as Netlify serves
//
// Each version is a commit (a branch, tag or hash), so commit what you want
// measured, or the address of a site to measure as it stands. A commit is
// built on fixture data in main's checkout and served there
// (scripts/serve-main.mjs), one at a time. Each is then loaded in Chromium,
// every load in a new browser profile with nothing cached:
//
// - on both of the storyboard's viewports: a 1280 by 800 desktop, and an
//   iPhone 13 with the processor slowed four times, as Lighthouse does for a
//   phone;
// - on both of Chrome DevTools' 4G presets (NETWORKS): "Slow 4G", which is
//   what Lighthouse and PageSpeed Insights measure a phone on, and "Fast 4G".
//
// A load is the whole page: its HTML, scripts, styles, fonts, the frames it
// embeds and every image the browser fetches without scrolling, all sharing
// the connection. The images timed are those `--images` selects (every <img>
// by default) that are in the window. The figures (METRICS):
//
// - "first paint" is the browser's First Contentful Paint: the first text or
//   picture on screen;
// - "first image" is when any of the images first shows at all: loaded, and
//   no longer transparent;
// - "last image" is when all of them first show in full: loaded and opaque,
//   so after any fade;
// - "largest paint" is the browser's Largest Contentful Paint;
// - "buttons work" is when React has taken over every <button> on the page,
//   so a tap on the menu does something;
// - "page loaded" is when the last thing the page fetched arrived;
// - "requests" and the KB count everything fetched, as sent over the
//   network, by kind, and what came from other sites.
//
// Each figure is the median of the runs (5 unless `--runs` says), with the
// fastest and slowest beside it. The first load of each version isn't
// counted: it's the one that waits for Next to resize each image. One more
// load is filmed, for the filmstrip.
//
// Other work on the machine slows a load, so each waits for the machine to
// go quiet (QUIET_CORES), and one that ran while it was busy (BUSY_CORES) is
// run again.
//
// Nothing reaches another site during the loads that count: not Google's
// Tag Manager or Analytics, which a fixture build loads as the live site
// does, nor the joining form's site. A stand-in on this machine answers for
// them all, with a copy of each of their files that it fetched once
// (scripts/measure-replay.mjs). So a measurement is never counted as a visit,
// and those sites' scripts still weigh on the connection what they weigh for
// a visitor.
//
// A commit's server is this machine's `next start`, so the figures compare
// versions with each other. They aren't the live site's: Netlify's CDN
// serves that, over HTTP/2, and a second visit depends on its cache headers,
// which this never sees. `--http2` puts HTTP/2 in front of each build
// (scripts/measure-http2.mjs), which is nearer to it; for the rest, measure
// the live site's address.
//
// It prints the tables, and writes them with the filmstrips to a page in
// tmp/measure/, beside every run as JSON.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, openSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { basename, join } from "node:path";
import { MAIN_URL } from "../tests/checkout.mjs";
import { lockMain } from "./main-checkout.mjs";
import { startHttp2 } from "./measure-http2.mjs";
import { startReplay } from "./measure-replay.mjs";

/**
 * Chrome DevTools' 4G presets, in bytes a second and milliseconds
 * (https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/core/sdk/NetworkManager.ts,
 * Slow4GConditions and Fast4GConditions): 1.6 Mbps down, 750 kbps up and a
 * 150ms round trip; 9 Mbps down, 1.5 Mbps up and a 60ms round trip. The
 * factors are DevTools' own, for throttling each request rather than the
 * connection.
 */
export const NETWORKS = {
  "slow-4g": {
    name: "Slow 4G",
    conditions: {
      downloadThroughput: ((1.6 * 1000 * 1000) / 8) * 0.9,
      uploadThroughput: ((750 * 1000) / 8) * 0.9,
      latency: 150 * 3.75,
    },
  },
  "fast-4g": {
    name: "Fast 4G",
    conditions: {
      downloadThroughput: ((9 * 1000 * 1000) / 8) * 0.9,
      uploadThroughput: ((1.5 * 1000 * 1000) / 8) * 0.9,
      latency: 60 * 2.75,
    },
  },
};

/**
 * The storyboard's two viewports (playwright.config.ts), by the name of
 * Playwright's device for each, the phone's processor slowed as Lighthouse
 * slows it.
 */
const VIEWPORTS = {
  phone: { name: "Phone", device: "iPhone 13", cpu: 4 },
  desktop: { name: "Desktop", device: "Desktop Chrome", viewport: { width: 1280, height: 800 }, cpu: 1 },
};

/** How long a load may take before its missing figures are left blank. */
const LOAD_TIMEOUT_MS = 90_000;
/**
 * A load, which keeps two or three cores busy itself, waits while other work
 * keeps more of the machine's cores busy than this: all but six,
 */
const QUIET_CORES = Math.max(1, cpus().length - 6);
/** for at most this long. */
const QUIET_WAIT_MS = 15 * 60_000;
/** A load during which more cores than this were busy, its own work included, is run again: all but three, */
const BUSY_CORES = Math.max(4, cpus().length - 3);
/** at most this many times. */
const BUSY_RETRIES = 3;
/** A film keeps at most one frame for each stretch of this long. */
const FILM_GAP_MS = 100;
/** The most frames a filmstrip shows, and the steps between them it chooses from, in seconds. */
const FILM_FRAMES = 16;
const FILM_STEPS = [0.25, 0.5, 1, 2, 3, 5];

/** Each figure's key in a run, its name, and whether it's a time. A name starting with a space is part of the KB above it. */
export const METRICS = [
  ["fcp", "First paint", "s"],
  ["first", "First image", "s"],
  ["last", "Last image", "s"],
  ["lcp", "Largest paint", "s"],
  ["working", "Buttons work", "s"],
  ["loaded", "Page loaded", "s"],
  ["images", "Images in the window", ""],
  ["requests", "Requests", ""],
  ["kb", "KB", ""],
  ["kbImages", "  images", ""],
  ["kbScripts", "  scripts", ""],
  ["kbFonts", "  fonts", ""],
  ["kbRest", "  the rest", ""],
  ["kbElsewhere", "KB from other sites", ""],
];

/** What the command line asks for: the page, the runs, and each version as `{ name, ref }` or `{ name, url }`. */
export function parseArgs(argv) {
  const options = {
    path: "/",
    runs: 5,
    images: "img",
    networks: Object.keys(NETWORKS),
    viewports: Object.keys(VIEWPORTS),
    film: true,
    http2: false,
    versions: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--path") options.path = argv[++i];
    else if (arg === "--runs") options.runs = Number(argv[++i]);
    else if (arg === "--images") options.images = argv[++i];
    else if (arg === "--network") options.networks = argv[++i].split(",");
    else if (arg === "--viewport") options.viewports = argv[++i].split(",");
    else if (arg === "--no-film") options.film = false;
    else if (arg === "--http2") options.http2 = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}.`);
    else {
      // A name can't have a slash or a colon in it, so an address with "=" in it isn't split.
      const named = arg.match(/^([^=/:]+)=(.+)$/);
      const [name, what] = named ? [named[1], named[2]] : [arg, arg];
      options.versions.push(/^https?:\/\//.test(what) ? { name, url: what } : { name, ref: what });
    }
  }
  if (options.versions.length === 0) {
    throw new Error("Name the versions to measure, e.g. npm run measure -- origin/main HEAD");
  }
  for (const network of options.networks) {
    if (!NETWORKS[network]) throw new Error(`Unknown network ${network}: one of ${Object.keys(NETWORKS).join(", ")}.`);
  }
  for (const viewport of options.viewports) {
    if (!VIEWPORTS[viewport]) {
      throw new Error(`Unknown viewport ${viewport}: one of ${Object.keys(VIEWPORTS).join(", ")}.`);
    }
  }
  return options;
}

/** The KB of a load's requests (`{ url, kind, bytes }`, kind as Chrome DevTools names it), by kind, and those from sites other than `origin`. */
export function weigh(requests, origin) {
  const kb = (list) => list.reduce((sum, request) => sum + request.bytes, 0) / 1024;
  const of = (...kinds) => requests.filter((request) => kinds.includes(request.kind));
  const named = of("Image", "Script", "Font");
  return {
    requests: requests.length,
    kb: kb(requests),
    kbImages: kb(of("Image")),
    kbScripts: kb(of("Script")),
    kbFonts: kb(of("Font")),
    kbRest: kb(requests.filter((request) => !named.includes(request))),
    kbElsewhere: kb(requests.filter((request) => new URL(request.url).origin !== origin)),
  };
}

/** The median of a figure over the runs, with its range if it varies; "–" where no run got one. */
export function summary(runs, key, unit) {
  const values = runs
    .map((run) => run[key])
    .filter((value) => value !== null && value !== undefined)
    .sort((a, b) => a - b);
  if (values.length === 0) return "–";
  const show = (value) => (unit === "s" ? (value / 1000).toFixed(2) : String(Math.round(value)));
  const median = show(values[Math.floor(values.length / 2)]);
  const [low, high] = [show(values[0]), show(values.at(-1))];
  return low === high ? `${median}${unit}` : `${median}${unit} (${low}–${high})`;
}

/** A table's cells: a row of the versions' names, then a row for each figure. `results` is each version's runs. */
export function tableRows(names, results) {
  return [
    ["", ...names],
    ...METRICS.map(([key, label, unit]) => [label, ...results.map((runs) => summary(runs, key, unit))]),
  ];
}

/** A table as text, its columns lined up. */
export function textTable(title, rows) {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  const line = (row) =>
    row
      .map((cell, column) => cell.padEnd(widths[column]))
      .join("  ")
      .trimEnd();
  return [
    title,
    "",
    line(rows[0]),
    widths.map((width) => "-".repeat(width)).join("  "),
    ...rows.slice(1).map(line),
    "",
  ].join("\n");
}

/** The seconds a filmstrip shows a frame at: from the first step to just past `untilMs`, in the smallest step that fits. */
export function filmTimes(untilMs) {
  const until = untilMs / 1000;
  const step = FILM_STEPS.find((each) => until / each <= FILM_FRAMES - 1) ?? FILM_STEPS.at(-1);
  const count = Math.min(FILM_FRAMES, Math.ceil(until / step) + 1);
  return Array.from({ length: count }, (_, index) => (index + 1) * step);
}

/** The last of a film's frames (`{ at }`, milliseconds into the load, in order) taken by `seconds`, or undefined before the first. */
export function frameAt(frames, seconds) {
  return frames.findLast((frame) => frame.at <= seconds * 1000);
}

const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The page of a measurement: for each viewport and network (`sections`:
 * `{ title, names, results, films }`), its table, then each version's
 * filmstrip, a film being `{ file, at }` frames with `file` beside the page.
 */
export function reportHtml(title, sections) {
  const section = ({ title: heading, names, results, films }) => {
    const [head, ...rows] = tableRows(names, results);
    const cells = (row, tag) => row.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join("");
    const table = `<table><thead><tr>${cells(head, "th")}</tr></thead><tbody>${rows
      .map(
        (row) =>
          `<tr${row[0].startsWith(" ") ? ' class="part"' : ""}><th>${escapeHtml(row[0])}</th>${cells(row.slice(1), "td")}</tr>`,
      )
      .join("")}</tbody></table>`;
    if (!films) return `<h2>${escapeHtml(heading)}</h2>${table}`;
    const lasts = results.flatMap((runs) => runs.map((run) => run.last ?? run.loaded));
    const times = filmTimes(Math.max(...lasts));
    const strip = (film, at) =>
      `<tr><th>${escapeHtml(names[at])}</th>${times
        .map((seconds) => {
          const frame = frameAt(film, seconds);
          return `<td>${frame ? `<img src="${frame.file}" alt="" loading="lazy">` : ""}</td>`;
        })
        .join("")}</tr>`;
    return `<h2>${escapeHtml(heading)}</h2>${table}<div class="film"><table><thead><tr><th></th>${times
      .map((seconds) => `<th>${seconds}s</th>`)
      .join("")}</tr></thead><tbody>${films.map(strip).join("")}</tbody></table></div>`;
  };
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${escapeHtml(title)}</title>
<style>
  body { font: 15px/1.4 system-ui, sans-serif; margin: 24px; color: #222; background: #fff; }
  h2 { margin-top: 40px; }
  table { border-collapse: collapse; }
  th, td { padding: 4px 12px; text-align: left; border-bottom: 1px solid #ddd; white-space: nowrap; }
  tr.part th, tr.part td { color: #666; border-bottom: 0; padding-top: 0; padding-bottom: 0; }
  tr.part th { padding-left: 28px; font-weight: normal; }
  .film { overflow-x: auto; margin-top: 16px; }
  .film td { padding: 4px; vertical-align: top; }
  .film img { display: block; height: 220px; width: auto; border: 1px solid #ccc; }
</style>
<h1>${escapeHtml(title)}</h1>
${sections.map(section).join("\n")}
`;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** The time the machine's cores have spent busy, and in all, since it started. */
function coreTimes() {
  let busy = 0;
  let all = 0;
  for (const { times } of cpus()) {
    const total = times.user + times.nice + times.sys + times.idle + times.irq;
    busy += total - times.idle;
    all += total;
  }
  return { busy, all };
}

/** Runs `work`, and returns how many of the machine's cores were busy meanwhile, with what it returned. */
async function coresBusyDuring(work) {
  const before = coreTimes();
  const result = await work();
  const after = coreTimes();
  return [((after.busy - before.busy) / Math.max(1, after.all - before.all)) * cpus().length, result];
}

/** Waits until other work leaves the machine quiet, or gives up waiting. */
async function quiet() {
  for (let waited = 0; waited < QUIET_WAIT_MS; waited += 6000) {
    const [cores] = await coresBusyDuring(() => sleep(1000));
    if (cores <= QUIET_CORES) return;
    if (waited % 60_000 === 0)
      console.log(`  Waiting for the machine to go quiet: ${cores.toFixed(1)} cores are busy.`);
    await sleep(5000);
  }
  console.log("  The machine is still busy: going on anyway.");
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

/**
 * Builds and serves `commit` from main's checkout. Returns `stop`, which
 * stops it, the build too, and `ready`, which resolves once it answers.
 */
function serve(commit, log) {
  const port = new URL(MAIN_URL).port;
  const server = spawn("node", ["scripts/serve-main.mjs", "--ref", commit, "--port", port], {
    stdio: ["ignore", log, log],
    detached: true,
  });
  let exited = false;
  server.on("exit", () => (exited = true));
  const stop = () =>
    new Promise((done) => {
      if (exited) return done();
      server.on("exit", done);
      process.kill(-server.pid, "SIGTERM");
    });
  const answers = async () => {
    for (;;) {
      if (exited) throw new Error(`The build of ${commit} failed: see its log in tmp/measure/.`);
      try {
        await fetch(MAIN_URL, { signal: AbortSignal.timeout(5000) });
        return;
      } catch {
        await sleep(1000);
      }
    }
  };
  return { stop, ready: answers() };
}

/**
 * Runs in the page before anything else: watches the images in the window,
 * each frame, for the first to show and for all of them to show in full, and
 * the page's buttons for React taking them over.
 */
function watchPage(selector) {
  const measured = (window.measured = {
    fcp: null,
    first: null,
    last: null,
    images: 0,
    lcp: null,
    lcpOf: null,
    working: null,
  });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      measured.lcp = entry.startTime;
      // What it was, for the JSON: the picture's address, or the start of the words.
      measured.lcpOf = entry.url || (entry.element?.textContent ?? "").trim().slice(0, 40);
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) if (entry.name === "first-contentful-paint") measured.fcp = entry.startTime;
  }).observe({ type: "paint", buffered: true });
  const inWindow = (img) => {
    const box = img.getBoundingClientRect();
    return box.width > 0 && box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth;
  };
  const opacity = (img) => (img.complete && img.naturalWidth > 0 ? Number(getComputedStyle(img).opacity) : 0);
  // React keeps each element's props on it, under a key of its own, once it has hydrated it.
  const taken = (element) => Object.keys(element).some((key) => key.startsWith("__reactProps$"));
  function frame() {
    const now = performance.now();
    if (measured.last === null) {
      const shown = [...document.querySelectorAll(selector)].filter(inWindow).map(opacity);
      if (shown.length > 0) {
        if (measured.first === null && shown.some((value) => value > 0)) measured.first = now;
        if (shown.every((value) => value >= 0.99)) {
          measured.last = now;
          measured.images = shown.length;
        }
      }
    }
    if (measured.working === null) {
      const buttons = [...document.querySelectorAll("button")];
      if (buttons.length > 0 && buttons.every(taken)) measured.working = now;
    }
    if (measured.last === null || measured.working === null) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/**
 * One load of the page in a new profile: its figures, and its requests.
 * `network` undefined is the uncounted first load, unthrottled. With
 * `filmTo`, a folder, the load is filmed, and its frames (`{ file, at }`)
 * returned too.
 */
async function load(browser, url, viewport, network, selector, filmTo) {
  const { devices } = await import("@playwright/test");
  const context = await browser.newContext({
    ...devices[viewport.device],
    ...(viewport.viewport ? { viewport: viewport.viewport } : {}),
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  const requests = new Map();
  cdp.on("Network.responseReceived", (event) => {
    if (/^https?:/.test(event.response.url))
      requests.set(event.requestId, { url: event.response.url, kind: event.type });
  });
  cdp.on("Network.loadingFinished", (event) => {
    const request = requests.get(event.requestId);
    if (request) Object.assign(request, { bytes: event.encodedDataLength, end: event.timestamp });
  });
  if (network) {
    await cdp.send("Network.emulateNetworkConditions", { offline: false, ...network.conditions });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: viewport.cpu });
  }
  const shots = [];
  if (filmTo) {
    cdp.on("Page.screencastFrame", (event) => {
      const shot = { data: event.data, time: event.metadata.timestamp * 1000 };
      // The browser sends a frame only when the page has changed, and while
      // anything on it moves that's sixty a second. Ten a second are kept:
      // the latest within each tenth of a second replaces the one before.
      const last = shots.at(-1);
      if (last && shot.time - last.since < FILM_GAP_MS) Object.assign(last, shot);
      else shots.push({ ...shot, since: shot.time });
      void cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, maxWidth: 480, maxHeight: 480 });
  }
  await page.addInitScript(watchPage, selector);
  if (new URL(url).hostname !== "localhost") {
    // A page on the internet isn't let to fetch from this machine, which is
    // where the stand-in for other sites is, without this permission.
    await context.grantPermissions(["local-network-access"]);
    // Google's tags can send their reports of a visit by way of the page's
    // own site, which the stand-in doesn't answer for. A build on this machine
    // has nowhere to pass them on to; on a site that's up, they're stopped.
    await context.route(/\/collect(\/|\?|$)/, (route) => route.abort());
  }
  await page.goto(url, { waitUntil: "load", timeout: LOAD_TIMEOUT_MS }).catch(() => {});
  await page
    .waitForFunction(() => window.measured.last !== null, undefined, { timeout: LOAD_TIMEOUT_MS })
    .catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: LOAD_TIMEOUT_MS }).catch(() => {});
  const result = await page.evaluate(() => ({
    ...window.measured,
    started: performance.timeOrigin,
    loaded: Math.max(
      performance.getEntriesByType("navigation")[0].loadEventEnd,
      ...performance.getEntriesByType("resource").map((entry) => entry.responseEnd),
    ),
  }));
  await context.close();
  const fetched = [...requests.values()].filter((request) => request.bytes !== undefined);
  const figures = { ...result, ...weigh(fetched, new URL(url).origin), fetched };
  if (!filmTo) return figures;
  mkdirSync(filmTo, { recursive: true });
  const frames = shots.map((shot, index) => {
    const file = join(filmTo, `${String(index).padStart(4, "0")}.jpg`);
    writeFileSync(file, Buffer.from(shot.data, "base64"));
    return { file, at: shot.time - result.started };
  });
  return { ...figures, frames };
}

/** A load once the machine is quiet, run again if the machine was busy during it. Its figures, with the cores busy during it. */
async function quietLoad(...args) {
  for (let attempt = 1; ; attempt++) {
    await quiet();
    const [cores, figures] = await coresBusyDuring(() => load(...args));
    if (cores <= BUSY_CORES || attempt > BUSY_RETRIES) return { ...figures, cores };
    console.log(`  ${cores.toFixed(1)} cores were busy during a load: running it again.`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { chromium } = await import("@playwright/test");
  const versions = options.versions.map((version) =>
    version.url ? version : { ...version, commit: git("rev-parse", "--short", `${version.ref}^{commit}`) },
  );
  if (
    versions.some((version) => version.ref === "HEAD") &&
    git("status", "--porcelain", "--untracked-files=no") !== ""
  ) {
    console.log("HEAD is measured as committed: this checkout's uncommitted changes aren't in it.\n");
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const out = join("tmp", "measure", stamp);
  mkdirSync(out, { recursive: true });

  const release = await lockMain();
  // Every host but the page's own is the stand-in (scripts/measure-replay.mjs),
  // whose certificate isn't checked.
  const replay = await startReplay();
  const own = [
    "localhost",
    "127.0.0.1",
    ...versions.filter((version) => version.url).map((version) => new URL(version.url).hostname),
  ];
  const browser = await chromium.launch({
    args: [
      // A frame from another site shares the page's process, as it does on
      // most phones, so its requests are slowed and counted with the page's.
      "--disable-site-isolation-trials",
      `--host-resolver-rules=MAP * 127.0.0.1:${replay.port}, ${own.map((host) => `EXCLUDE ${host}`).join(", ")}`,
      "--ignore-certificate-errors",
      "--disable-quic",
    ],
  });
  // results[viewport][network][version] is that version's runs, films[viewport][network][version] its film's frames.
  const results = {};
  const films = {};
  let stop = async () => {};
  process.on("SIGINT", () => void stop().then(() => process.exit(130)));
  try {
    for (const [at, version] of versions.entries()) {
      let base = version.url;
      if (version.commit) {
        console.log(`▶ ${version.name} (${version.commit}): building and serving it.`);
        const server = serve(version.commit, openSync(join(out, `build-${version.commit}.log`), "w"));
        stop = server.stop;
        await server.ready;
        base = MAIN_URL;
        if (options.http2) {
          const front = await startHttp2(MAIN_URL, replay.certificate);
          stop = () => front.stop().then(server.stop);
          base = front.url;
        }
      } else {
        console.log(`▶ ${version.name}: ${version.url}`);
      }
      const url = new URL(options.path, base).href;
      for (const viewportKey of options.viewports) {
        const viewport = VIEWPORTS[viewportKey];
        // The first load fetches what the stand-in hasn't kept of other sites' files; the loads that count fetch nothing.
        replay.thaw();
        await load(browser, url, viewport, undefined, options.images);
        replay.freeze();
        for (const networkKey of options.networks) {
          const network = NETWORKS[networkKey];
          const runs = [];
          for (let run = 0; run < options.runs; run++) {
            runs.push(await quietLoad(browser, url, viewport, network, options.images));
          }
          ((results[viewportKey] ??= {})[networkKey] ??= []).push(runs);
          if (options.film) {
            const folder = join(out, `film-${at}-${viewportKey}-${networkKey}`);
            const { frames } = await quietLoad(browser, url, viewport, network, options.images, folder);
            ((films[viewportKey] ??= {})[networkKey] ??= []).push(
              frames.map((frame) => ({ ...frame, file: join(basename(folder), basename(frame.file)) })),
            );
          }
          console.log(`  ${viewport.name}, ${network.name}: ${options.runs} loads.`);
        }
      }
      await stop();
      stop = async () => {};
    }
  } finally {
    await stop();
    await browser.close();
    await replay.stop();
    release();
  }
  console.log(
    `\nOther sites' files: ${replay.counts.kept} served from the copies kept, ${replay.counts.fetched} fetched from the sites.`,
  );
  if (replay.counts.missed > 0) {
    console.log(
      `${replay.counts.missed} requests during the loads that count were for files not kept: those loads were lighter than a visitor's.`,
    );
  }

  const names = versions.map((version) =>
    version.commit && version.commit !== version.name ? `${version.name} (${version.commit})` : version.name,
  );
  const sections = Object.entries(results).flatMap(([viewportKey, networks]) =>
    Object.entries(networks).map(([networkKey, versionRuns]) => ({
      title: `${VIEWPORTS[viewportKey].name}, ${NETWORKS[networkKey].name}`,
      names,
      results: versionRuns,
      films: films[viewportKey]?.[networkKey],
    })),
  );
  console.log("");
  for (const section of sections) console.log(textTable(section.title, tableRows(names, section.results)));
  writeFileSync(join(out, "results.json"), JSON.stringify({ ...options, versions, results, films }, null, 2));
  writeFileSync(join(out, "index.html"), reportHtml(`${options.path} on 4G`, sections));
  console.log(
    `The tables and filmstrips are in ${join(out, "index.html")}, every run in ${join(out, "results.json")}.`,
  );
}

if (basename(process.argv[1] ?? "") === "measure-page.mjs") await main();
