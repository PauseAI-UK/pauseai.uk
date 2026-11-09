#!/usr/bin/env node
// The copy waiting for approval: one page showing each placeholder this
// branch adds or changes since it left origin/main, committed or not, with
// its file and line and the storyboard frames that picture it, each the
// whole page with the copy boxed. The sidebar lists the copy in clusters (its
// file, or in lib/content/ the set of strings it's in); clicking one shows
// its frames.
//
//   npm run copy                       # from the latest storyboard run, without running anything
//   npm run copy -- <run>              # another run: its folder, or its name under runs/
//   npm run copy -- --storyboard       # runs the storyboard first, for the sections that show the copy
//   npm run copy -- --storyboard --no-main   # anything after --storyboard goes to npm run storyboard
//
// A placeholder starts with the mark U+2042 (AGENTS.md, "Never write final
// copy"). Each storyboard frame records the placeholder text it pictures and
// where (tests/storyboard/frame.ts), and this matches the copy in the source
// with it: a string as it's written, a template's `${…}` and JSX's `{…}` as
// anything, whitespace collapsed and HTML entities decoded on both sides.
// Copy with the same text in two places is shown once, with both places.
//
// The page is test-results/copy.html, with its pictures in it, so it opens
// from the filesystem on its own.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { sections } from "../tests/storyboard/report/frames.ts";
import { runDirOf } from "./storyboard-changed.mjs";

/** The placeholder mark, by its code point, so this file isn't taken for copy (tests/checks/placeholder-copy.test.ts). */
export const MARK = String.fromCodePoint(0x2042);
const BASE = "origin/main";
export const PAGE = "test-results/copy.html";

/**
 * Part of a piece of copy: text, as it reads, or an expression (`${n}` in a
 * template, `{n}` in JSX), which could read as anything.
 *
 * @typedef {string | { expr: string }} Part
 * @typedef {{ file: string, line: number, endLine: number, parts: Part[], source: string }} Placeholder
 */

/**
 * The lines each file's diff adds, by their number in the file as it is now,
 * from `git diff -U0`'s output.
 *
 * @returns {Map<string, Set<number>>}
 */
export function addedLines(diff) {
  const files = new Map();
  let lines;
  let next = 0;
  let inHunk = false;
  for (const text of diff.split("\n")) {
    if (text.startsWith("diff --git ")) {
      inHunk = false;
      lines = undefined;
    } else if (!inHunk && text.startsWith("+++ ")) {
      const path = text.slice(4);
      lines = path === "/dev/null" ? undefined : new Set();
      if (lines) files.set(path.replace(/^b\//, ""), lines);
    } else if (text.startsWith("@@ ")) {
      inHunk = true;
      next = Number(/\+(\d+)/.exec(text)[1]);
    } else if (inHunk && text.startsWith("+")) {
      lines?.add(next++);
    } else if (inHunk && text.startsWith(" ")) {
      next++;
    }
  }
  return files;
}

/** Files whose placeholders aren't copy: tests, which check for it, and the notes about the code. */
const NOT_COPY = /(^|\/)tests\/|\.(test|spec)\.[cm]?[jt]sx?$|^(docs|plans|investments)\/|^AGENTS\.md$/;

/** How a file's copy is read: JSX, the rest of JavaScript and TypeScript, or plain text. */
export function kindOf(file) {
  if (/\.[jt]sx$/.test(file)) return "jsx";
  if (/\.[cm]?[jt]s$/.test(file)) return "js";
  return "text";
}

/**
 * The placeholders a branch adds or changes since `base`, committed or not,
 * new files too, in file then line order: each one any of whose lines the
 * diff adds. `git` runs git and returns its output; `read` reads a file.
 *
 * @returns {Placeholder[]}
 */
export function changedPlaceholders(
  base = BASE,
  git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }),
  read = (file) => readFileSync(file, "utf8"),
) {
  const from = git(["merge-base", base, "HEAD"]).trim();
  const changed = addedLines(git(["-c", "core.quotePath=false", "diff", "-U0", "--no-color", "--no-ext-diff", from]));
  for (const file of git(["-c", "core.quotePath=false", "ls-files", "--others", "--exclude-standard"]).split("\n")) {
    if (file) changed.set(file, "all");
  }
  const found = [];
  for (const [file, lines] of [...changed].sort(([a], [b]) => a.localeCompare(b))) {
    if (NOT_COPY.test(file)) continue;
    let source;
    try {
      source = read(file);
    } catch {
      continue;
    }
    if (!source.includes(MARK)) continue;
    for (const placeholder of placeholdersIn(file, source)) {
      const { line, endLine } = placeholder;
      if (lines === "all" || [...lines].some((n) => n >= line && n <= endLine)) found.push(placeholder);
    }
  }
  return found;
}

/** Every placeholder in a file's text, with the lines it spans. */
export function placeholdersIn(file, source) {
  const kind = kindOf(file);
  const lineAt = (index) => source.slice(0, index).split("\n").length;
  const found = [];
  for (let at = source.indexOf(MARK); at !== -1; at = source.indexOf(MARK, at + 1)) {
    const { parts, end } = readCopy(source, at, kind);
    const line = lineAt(at);
    const endLine = lineAt(end);
    const lines = source.split("\n").slice(line - 1, endLine);
    found.push({ file, line, endLine, parts, source: lines.join("\n") });
  }
  return found;
}

/** Inline HTML elements, and the components that render one: the copy reads on through them. */
const INLINE = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "cite",
  "code",
  "data",
  "dfn",
  "em",
  "i",
  "kbd",
  "mark",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "Link",
]);

/**
 * The copy that starts at the mark at `at`, and the index just after it.
 * Inside a string or template, to its end; in JSX text, through inline
 * elements and `{…}`, to the next element that isn't inline; otherwise, to
 * the end of the line. Never past the next mark, which starts copy of its own.
 *
 * @returns {{ parts: Part[], end: number }}
 */
export function readCopy(source, at, kind) {
  const quote = kind === "text" ? undefined : openQuote(source, at);
  const { parts, end } =
    quote === "`"
      ? readTemplate(source, at)
      : quote
        ? readString(source, at, quote)
        : kind === "jsx"
          ? readJsxText(source, at)
          : readLine(source, at);
  return { parts: quote || kind !== "jsx" ? cutHtml(parts) : decodeParts(parts), end };
}

/** The quote of the string or template that `at` is in, on its line, if it's in one. */
export function openQuote(source, at) {
  if (`"'\``.includes(source[at - 1])) return source[at - 1];
  let quote;
  for (let i = source.lastIndexOf("\n", at - 1) + 1; i < at; i++) {
    const c = source[i];
    if (quote && c === "\\") i++;
    else if (quote && c === quote) quote = undefined;
    else if (!quote && `"'\``.includes(c)) quote = c;
  }
  return quote;
}

const ESCAPES = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", 0: "\0" };

/** The character an escape at `i` (its backslash) stands for, and the index after it. */
function readEscape(source, i) {
  const c = source[i + 1];
  if (c === "u" && source[i + 2] === "{") {
    const close = source.indexOf("}", i);
    return [String.fromCodePoint(parseInt(source.slice(i + 3, close), 16)), close + 1];
  }
  if (c === "u") return [String.fromCharCode(parseInt(source.slice(i + 2, i + 6), 16)), i + 6];
  if (c === "x") return [String.fromCharCode(parseInt(source.slice(i + 2, i + 4), 16)), i + 4];
  if (c === "\n") return ["", i + 2];
  return [ESCAPES[c] ?? c, i + 2];
}

function readString(source, at, quote) {
  let text = "";
  let i = at;
  while (i < source.length && source[i] !== quote && source[i] !== "\n" && !(i > at && source[i] === MARK)) {
    if (source[i] === "\\") {
      const [c, after] = readEscape(source, i);
      text += c;
      i = after;
    } else text += source[i++];
  }
  return { parts: [text], end: i };
}

function readTemplate(source, at) {
  const parts = [];
  let text = "";
  let i = at;
  while (i < source.length && source[i] !== "`" && !(i > at && source[i] === MARK)) {
    if (source[i] === "\\") {
      const [c, after] = readEscape(source, i);
      text += c;
      i = after;
    } else if (source.startsWith("${", i)) {
      const close = matchingBrace(source, i + 1);
      parts.push(text, { expr: source.slice(i + 2, close).trim() });
      text = "";
      i = close + 1;
    } else text += source[i++];
  }
  parts.push(text);
  return { parts, end: i };
}

function readLine(source, at) {
  const newline = source.indexOf("\n", at);
  const mark = source.indexOf(MARK, at + 1);
  const ends = [newline, mark, source.length].filter((n) => n !== -1);
  const end = Math.min(...ends);
  return { parts: [source.slice(at, end)], end };
}

/** The index of the `}` that closes the `{` at `open`, past strings, templates and nested braces. */
export function matchingBrace(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < source.length && source[i] !== c; i++) if (source[i] === "\\") i++;
    } else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  return source.length;
}

/** The index after the `>` closing the tag that starts at `open`, past its attributes' strings and expressions. */
function tagEnd(source, open) {
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === '"' || c === "'") i = source.indexOf(c, i + 1);
    else if (c === "{") i = matchingBrace(source, i);
    else if (c === ">") return i + 1;
    if (i === -1) break;
  }
  return source.length;
}

/** A JSX expression's value, if it's a plain string: `{" "}`, `{"text"}`, a template without `${`. Empty for a comment. */
function literalValue(expr) {
  if (/^\/\*[^]*\*\/$/.test(expr)) return "";
  const quote = expr[0];
  if (!`"'\``.includes(quote) || expr.at(-1) !== quote || expr.length < 2) return undefined;
  if (quote === "`" && expr.includes("${")) return undefined;
  const { parts, end } = readString(expr, 1, quote);
  return end === expr.length - 1 ? parts[0] : undefined;
}

function readJsxText(source, at) {
  const parts = [];
  let text = "";
  // JSX text between one tag or expression and the next, whose whitespace JSX trims (jsxWhitespace).
  let raw = "";
  let i = at;
  while (i < source.length) {
    const c = source[i];
    if ((i > at && c === MARK) || c === "}") break;
    if (c === "<" || c === "{") {
      text += jsxWhitespace(raw);
      raw = "";
    }
    if (c === "<") {
      const tag = /^<\/?([A-Za-z][\w.]*)/.exec(source.slice(i, i + 64));
      if (!tag || !INLINE.has(tag[1])) break;
      i = tagEnd(source, i);
    } else if (c === "{") {
      const close = matchingBrace(source, i);
      const expr = source.slice(i + 1, close).trim();
      const value = literalValue(expr);
      if (value === undefined) {
        parts.push(text, { expr });
        text = "";
      } else text += value;
      i = close + 1;
    } else raw += source[i++];
  }
  parts.push(text + jsxWhitespace(raw));
  return { parts, end: i };
}

/** JSX text as React renders it: each line trimmed, and the lines that aren't empty joined with a space. */
function jsxWhitespace(text) {
  if (!text.includes("\n")) return text;
  const lines = text.split("\n");
  return lines
    .map((line, i) => {
      if (i > 0) line = line.trimStart();
      if (i < lines.length - 1) line = line.trimEnd();
      return line;
    })
    .filter((line) => line !== "")
    .join(" ");
}

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  pound: "£",
  middot: "·",
};

/** Text with its HTML entities decoded, as a browser shows it. */
export function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
    if (name[0] === "#")
      return String.fromCodePoint(name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
    return ENTITIES[name] ?? entity;
  });
}

const decodeParts = (parts) => parts.map((part) => (typeof part === "string" ? decodeEntities(part) : part));

/**
 * A string's copy, when it's HTML (an email's): its inline tags dropped,
 * and cut at the first tag that isn't inline, as a frame's text ends at its
 * block. Its entities decoded, as a browser shows them.
 */
export function cutHtml(parts) {
  // Across the parts, as a tag can hold an expression (<a href="${url}">): each expression stands in as SLOT.
  const exprs = parts.filter((part) => typeof part !== "string");
  let html = parts.map((part) => (typeof part === "string" ? part : SLOT)).join("");
  const block = [...html.matchAll(TAG)].find((tag) => !INLINE.has(tag[1].toLowerCase()));
  if (block) html = html.slice(0, block.index);
  const out = [];
  let i = 0;
  let pending = "";
  for (const piece of html.split(TAG_SPLIT)) {
    if (TAG_ONLY.test(piece)) {
      // A tag: an expression in it isn't shown.
      i += (piece.match(new RegExp(SLOT, "g")) ?? []).length;
      continue;
    }
    const texts = piece.split(SLOT);
    texts.forEach((t, n) => {
      pending += t;
      if (n < texts.length - 1) {
        out.push(decodeEntities(pending), exprs[i++]);
        pending = "";
      }
    });
  }
  out.push(decodeEntities(pending));
  return out;
}

const SLOT = "\u0001";
const TAG = /<\/?([A-Za-z][\w-]*)[^>]*>/g;
const TAG_SPLIT = /(<\/?[A-Za-z][\w-]*[^>]*>)/;
const TAG_ONLY = /^<\/?[A-Za-z][\w-]*[^>]*>$/;

/** Whitespace as a frame's text has it (frame.ts): any run of it, non-breaking spaces too, one space. */
const collapse = (text) => text.replace(/[\s ]+/g, " ");

/** The copy as it reads, an expression shown as `{expr}`: for the page, and to tell copy with the same text. */
export function copyText(parts, expr = (e) => `{${e}}`) {
  return collapse(parts.map((part) => (typeof part === "string" ? part : expr(part.expr))).join("")).trim();
}

/** What copy with the same text has in common: its text, with each expression as one placeholder. */
export const sameText = (parts) => copyText(parts, () => "\u0000");

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A pattern matching the start of a frame's text that reads as the copy:
 * its text as written, a space or none where it has whitespace (JSX drops
 * some at a line break), anything for an expression, and ending where a
 * word does.
 */
export function copyPattern(parts) {
  const body = parts
    .map((part) => (typeof part === "string" ? escapeRegExp(collapse(part)).replaceAll(" ", " ?") : "(?:.*?)"))
    .join("");
  return new RegExp(`^${body.replace(/( \?)+$/, "")}(?=$|[^\\p{L}\\p{N}])`, "su");
}

/**
 * Placeholders with the same text, as one, in the order of the first of each.
 *
 * @param {Placeholder[]} placeholders
 * @returns {{ key: string, parts: Part[], places: Placeholder[] }[]}
 */
export function groupPlaceholders(placeholders) {
  const groups = new Map();
  for (const placeholder of placeholders) {
    const key = sameText(placeholder.parts);
    if (!groups.has(key)) groups.set(key, { key, parts: placeholder.parts, places: [] });
    groups.get(key).places.push(placeholder);
  }
  return [...groups.values()];
}

/**
 * Where in a storyboard's frames each group of copy appears: each frame of
 * this branch's whose placeholder text it matches, with the boxes of the
 * part that matched. Where a frame's text matches more than one, the
 * longest match wins, so `X` doesn't claim the frames of `X and Y`.
 *
 * @param {ReturnType<typeof groupPlaceholders>} groups
 * @param {import("../tests/storyboard/report/frames.ts").Storyboard} storyboard
 * @returns {Map<string, { frame: object, boxes: number[][] }[]>} by group key
 */
export function findInFrames(groups, storyboard) {
  const patterns = groups.map((group) => ({ key: group.key, pattern: copyPattern(group.parts) }));
  const seen = new Map(groups.map((group) => [group.key, []]));
  for (const frame of storyboard.frames) {
    if (!frame.branch || !frame.placeholders) continue;
    const inFrame = new Map();
    for (const shown of frame.placeholders) {
      const matches = patterns.flatMap(({ key, pattern }) => {
        const match = pattern.exec(shown.text);
        return match ? [{ key, length: match[0].length }] : [];
      });
      const longest = Math.max(...matches.map((m) => m.length));
      for (const { key, length } of matches) {
        if (length !== longest || inFrame.has(key)) continue;
        inFrame.set(
          key,
          shown.boxes.filter(([at]) => at < Math.max(length, 1)).map(([, ...box]) => box),
        );
      }
    }
    for (const [key, boxes] of inFrame) seen.get(key).push({ frame, boxes });
  }
  return seen;
}

/**
 * The boxes (each [x, y, width, height]) cut to a picture `width` by
 * `height`: undefined if none is in it, as copy below the fold of a picture
 * of the window.
 */
export function boxesInside(boxes, width, height) {
  const inside = boxes
    .map(([x, y, w, h]) => {
      const left = Math.max(0, x);
      const top = Math.max(0, y);
      return [left, top, Math.min(width, x + w) - left, Math.min(height, y + h) - top];
    })
    .filter(([, , w, h]) => w > 0 && h > 0);
  return inside.length ? inside : undefined;
}

/** Room between the copy and the box drawn around it, in CSS pixels. */
const BOX_PADDING = 4;

/** The tallest a WebP can be, in pixels: a taller page is scaled down to it. */
const WEBP_MAX = 16383;

/** A frame's whole picture, as WebP, with its size before any scaling, which its boxes are in. */
export async function framePicture(png) {
  const image = sharp(png, { limitInputPixels: false });
  const { width, height } = await image.metadata();
  const webp = await (height > WEBP_MAX ? image.resize({ height: WEBP_MAX }) : image).webp({ quality: 80 }).toBuffer();
  return { webp, width, height };
}

/**
 * Each frame's whole picture, once however many pieces of copy it shows (and
 * once for frames that are the same picture), and each group's shots: a
 * picture, the boxes of its copy in it, and the frames it's of.
 */
export async function picturesOf(groups, found, runDir, name = frameName) {
  const images = [];
  const byFrame = new Map();
  const byHash = new Map();
  const picture = async (frame) => {
    if (!byFrame.has(frame.branch)) {
      const { webp, width, height } = await framePicture(join(runDir, frame.branch));
      const hash = createHash("sha1").update(webp).digest("hex");
      if (!byHash.has(hash)) {
        const image = {
          id: `i${images.length + 1}`,
          src: `data:image/webp;base64,${webp.toString("base64")}`,
          width,
          height,
        };
        images.push(image);
        byHash.set(hash, image);
      }
      byFrame.set(frame.branch, byHash.get(hash));
    }
    return byFrame.get(frame.branch);
  };
  const shots = new Map();
  for (const group of groups) {
    const list = [];
    const same = new Map();
    for (const { frame, boxes } of found.get(group.key) ?? []) {
      const image = await picture(frame);
      const inside = boxesInside(boxes, image.width, image.height);
      if (!inside) continue;
      const key = `${image.id} ${JSON.stringify(inside)}`;
      if (same.has(key)) {
        same.get(key).where.push(name(frame));
        continue;
      }
      const shot = { image: image.id, boxes: inside, where: [name(frame)] };
      same.set(key, shot);
      list.push(shot);
    }
    shots.set(group.key, list);
  }
  return { images, shots };
}

/** A key of the copy objects in lib/content/, at its top level: `  messagePages: {`. */
const COPY_SET = /^ {2}["']?([\w$-]+)["']?\??\s*:/;

/**
 * The cluster a piece of copy is listed under: in lib/content/, its file and
 * the set of strings it's in (the copy object's key at the top level);
 * elsewhere, its file, which is its component or page.
 */
export function clusterOf(place, source) {
  if (!place.file.startsWith("lib/content/")) return place.file;
  const lines = source.split("\n").slice(0, place.line).reverse();
  const top = lines.findIndex((line) => COPY_SET.test(line));
  if (top === -1) return place.file;
  // Within the set, the nearest heading a level in: the key of the object it's in, or the comment over its part.
  const part = lines
    .slice(0, top)
    .map((line) => SET_PART.exec(line))
    .find(Boolean);
  const name = `${place.file} › ${COPY_SET.exec(lines[top])[1]}`;
  return part ? `${name} › ${part[1] ?? shortHeading(part[2])}` : name;
}

/** A comment as a heading: its first clause, cut to a few words. */
function shortHeading(comment) {
  const clause = comment.split(/[:,.;(]/)[0].trim();
  return clause.length > 40 ? `${clause.slice(0, 39).trimEnd()}…` : clause;
}

/** A line a level into a copy set that heads part of it: a key opening an object, or a comment. */
const SET_PART = /^ {4}(?:["']?([\w$-]+)["']?\??\s*:\s*\{\s*$|\/\/\s*(.+?)\s*$)/;

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** The copy for the page: its text, each expression marked as the slot it is. */
function copyHtml(parts) {
  return parts
    .map((part) =>
      typeof part === "string"
        ? escapeHtml(collapse(part))
        : `<span class="slot" title="Filled in as the page is made">${escapeHtml(part.expr)}</span>`,
    )
    .join("")
    .trim();
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A cluster's heading and, if it's a part of a copy set, the part: "file › set" and "part". */
const splitCluster = (cluster) => {
  const pieces = cluster.split(" › ");
  return pieces.length > 2 ? [pieces.slice(0, -1).join(" › "), pieces.at(-1)] : [cluster, undefined];
};

/**
 * The page: a sidebar listing every piece of copy under its cluster (clusterOf),
 * and beside it the copy clicked, with its places and every frame that shows
 * it, each the whole page with the copy boxed, scrolled to it. A frame's
 * picture is in the page once, however many pieces of copy it shows; the
 * script puts it in the shots of the copy shown.
 *
 * @param {{ branch: string, base: string, run?: { name: string, at: string }, warnings: string[],
 *   images?: { id: string, src: string, width: number, height: number }[],
 *   groups: { key: string, parts: Part[], places: Placeholder[], cluster?: string,
 *     shots: { image: string, boxes: number[][], where: string[] }[] }[] }} data
 */
export function renderCopyPage({ branch, base, run, warnings, images = [], groups }) {
  const seen = groups.filter((g) => g.shots.length > 0);
  const sizes = new Map(images.map((image) => [image.id, image]));
  const clusterOfGroup = (group) => group.cluster ?? group.places[0].file;
  const clusters = [...new Set(groups.map(clusterOfGroup))];
  const cardId = (group) => `copy-${groups.indexOf(group) + 1}`;
  // The copy in the sidebar, without its mark, each expression an ellipsis.
  const link = (group) => {
    const text = copyText(group.parts, () => "…").replace(/^\u2042\s*/, "");
    const none = group.shots.length === 0;
    return `<li${none ? ' class="none"' : ""}><a href="#${cardId(group)}" title="${escapeHtml(text)}${none ? " (in no frame)" : ""}">${escapeHtml(text)}</a></li>`;
  };
  const places = (group) =>
    group.places
      .map(
        (p) =>
          `<details class="place"><summary><code>${escapeHtml(p.file)}:${p.line}</code></summary><pre>${escapeHtml(p.source)}</pre></details>`,
      )
      .join("");
  const percent = (n, of) => `${Math.round((n / of) * 100000) / 1000}%`;
  const box =
    (image) =>
    ([x, y, w, h]) =>
      `<span class="box" style="left:${percent(x - BOX_PADDING, image.width)};top:${percent(y - BOX_PADDING, image.height)};width:${percent(w + 2 * BOX_PADDING, image.width)};height:${percent(h + 2 * BOX_PADDING, image.height)}"></span>`;
  const shot = (s) => {
    const image = sizes.get(s.image);
    return `
        <figure>
          <div class="frame"><div class="picture"><img data-image="${s.image}" width="${image.width}" height="${image.height}" alt="">${s.boxes.map(box(image)).join("")}</div></div>
          <figcaption>${escapeHtml(s.where[0])}${
            s.where.length > 1
              ? `<details><summary>and ${plural(s.where.length - 1, "more frame")} the same</summary><ul>${s.where
                  .slice(1)
                  .map((w) => `<li>${escapeHtml(w)}</li>`)
                  .join("")}</ul></details>`
              : ""
          }</figcaption>
        </figure>`;
  };
  const card = (group) => `
    <article class="copy" id="${cardId(group)}" hidden>
      <p class="cluster">${escapeHtml(clusterOfGroup(group))}</p>
      <p class="text">${copyHtml(group.parts)}</p>
      <div class="places">${places(group)}</div>
      ${
        group.shots.length
          ? `<p class="meta">${plural(group.shots.length, "frame")}.</p><div class="shots">${group.shots.map(shot).join("")}</div>`
          : `<p class="meta">No storyboard frame shows this: it needs a flow that reaches it, or can't be reached.</p>`
      }
    </article>`;
  // The pictures by id, for the script; `<` escaped so nothing in them closes the script.
  const pictures = JSON.stringify(Object.fromEntries(images.map((image) => [image.id, image.src]))).replace(
    /</g,
    "\\u003c",
  );
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Copy to approve</title>
<style>
:root { color-scheme: light dark; --bg: #fafaf7; --card: #fff; --text: #1d1d1b; --muted: #66665f; --line: #deded6; --accent: #e5007d; --slot: #fde7f2; --warn: #fff4d6; --current: #fde7f2; }
@media (prefers-color-scheme: dark) { :root { --bg: #161615; --card: #20201e; --text: #ececea; --muted: #a3a39c; --line: #3a3a36; --slot: #4a1a33; --warn: #3d3315; --current: #4a1a33; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, sans-serif; }
.layout { display: grid; grid-template-columns: 340px minmax(0, 1fr); }
aside { position: sticky; top: 0; height: 100vh; overflow-y: auto; padding: 16px 12px 32px 16px; border-right: 1px solid var(--line); font-size: 13px; }
aside h2 { margin: 16px 0 4px; font-size: 12px; font-family: ui-monospace, monospace; overflow-wrap: anywhere; }
aside h2:first-of-type { margin-top: 8px; }
aside h3 { margin: 8px 0 2px 8px; font-size: 12px; color: var(--muted); font-weight: 600; }
aside .count { color: var(--muted); font-weight: 400; }
aside ol { margin: 0; padding-left: 22px; color: var(--muted); }
aside li a { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: inherit; text-decoration: none; padding: 1px 4px; border-radius: 4px; }
aside li a:hover { color: var(--text); text-decoration: underline; }
aside li.none a { font-style: italic; opacity: 0.7; }
aside li a[aria-current] { background: var(--current); color: var(--text); font-weight: 600; }
aside .help { color: var(--muted); margin: 0; }
@media (max-width: 900px) { .layout { display: block; } aside { position: static; height: auto; max-height: 40vh; border-right: 0; border-bottom: 1px solid var(--line); } }
main { padding: 24px 16px 64px; min-width: 0; }
h1 { font-size: 24px; margin: 0 0 4px; }
.meta { color: var(--muted); margin: 0 0 16px; }
.warning { background: var(--warn); border: 1px solid var(--line); border-radius: 6px; padding: 8px 12px; margin: 8px 0; }
.copy { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; }
.cluster { margin: 0; color: var(--muted); font: 12px ui-monospace, monospace; }
.text { font-size: 20px; margin: 4px 0 6px; white-space: pre-wrap; }
.slot { background: var(--slot); border-radius: 4px; padding: 0 4px; font-family: ui-monospace, monospace; font-size: 15px; }
.places { display: flex; flex-wrap: wrap; gap: 4px 16px; color: var(--muted); font-size: 13px; margin-bottom: 8px; }
.place pre { font-size: 12px; background: var(--bg); border: 1px solid var(--line); border-radius: 4px; padding: 8px; overflow-x: auto; color: var(--text); white-space: pre; }
summary { cursor: pointer; }
.shots { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; }
figure { margin: 0; max-width: 100%; }
.frame { max-height: 85vh; overflow: auto; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); }
.picture { position: relative; }
.picture img { display: block; max-width: 100%; height: auto; }
.box { position: absolute; border: 3px solid var(--accent); border-radius: 4px; pointer-events: none; }
figcaption { font-size: 13px; color: var(--muted); margin-top: 4px; max-width: 640px; }
figcaption ul { margin: 2px 0 0; padding-left: 18px; }
</style>
</head>
<body>
<div class="layout">
<aside>
<p class="help">Click a piece of copy to see every frame it's in. <kbd>j</kbd> and <kbd>k</kbd> go down and up.</p>
${clusters
  .map((cluster, i) => {
    const inCluster = groups.filter((g) => clusterOfGroup(g) === cluster);
    // A cluster in a copy set's part: the set its heading, once, and the part under it.
    const [head, part] = splitCluster(cluster);
    const inHead = groups.filter((g) => splitCluster(clusterOfGroup(g))[0] === head);
    const heading =
      i > 0 && splitCluster(clusters[i - 1])[0] === head
        ? ""
        : `<h2>${escapeHtml(head)} <span class="count">(${inHead.length})</span></h2>`;
    return `${heading}${part ? `<h3>${escapeHtml(part)}</h3>` : ""}<ol>${inCluster.map(link).join("")}</ol>`;
  })
  .join("\n")}
</aside>
<main>
<h1>Copy to approve</h1>
<p class="meta">${plural(groups.length, "placeholder")} that <code>${escapeHtml(branch)}</code> adds or changes since it left main at <code>${escapeHtml(base)}</code>: ${seen.length} in frames, ${groups.length - seen.length} in none.${
    run ? ` Frames from storyboard run ${escapeHtml(run.name)}, made ${escapeHtml(run.at)}.` : ""
  }</p>
${warnings.map((w) => `<p class="warning">${escapeHtml(w)}</p>`).join("\n")}
${groups.map(card).join("")}
</main>
</div>
<script>
const PICTURES = ${pictures};
const links = [...document.querySelectorAll("aside li a")];
// Scrolls a frame to the first of its boxes, a little above it.
function toBox(frame) {
  const box = frame.querySelector(".box");
  if (box) frame.scrollTop = Math.max(0, box.offsetTop - 120);
}
function show(id) {
  const card = document.getElementById(id) ?? document.querySelector("article.copy");
  if (!card) return;
  for (const other of document.querySelectorAll("article.copy")) other.hidden = other !== card;
  for (const img of card.querySelectorAll("img[data-image]")) {
    const frame = img.closest(".frame");
    if (!img.src) {
      img.addEventListener("load", () => toBox(frame), { once: true });
      img.src = PICTURES[img.dataset.image];
    } else toBox(frame);
  }
  for (const link of links) {
    if (link.hash === "#" + card.id) {
      link.setAttribute("aria-current", "true");
      link.scrollIntoView({ block: "nearest" });
    } else link.removeAttribute("aria-current");
  }
}
const current = () => decodeURIComponent(location.hash.slice(1));
addEventListener("hashchange", () => {
  show(current());
  scrollTo({ top: 0 });
});
addEventListener("keydown", (event) => {
  if (event.target.closest("input, textarea") || event.metaKey || event.ctrlKey || event.altKey) return;
  const step = { j: 1, k: -1 }[event.key];
  if (!step) return;
  const at = links.findIndex((link) => link.hasAttribute("aria-current"));
  const next = links[at + step];
  if (next) location.hash = next.hash;
});
show(current());
</script>
</body>
</html>
`;
}

/** A frame's name on the page: its viewport, section, flow and caption. */
export function frameName(frame, names = new Map(sections().map((s) => [s.id, s.name]))) {
  return `${frame.viewport} › ${names.get(frame.section) ?? frame.section} › ${frame.flow} › ${frame.index}. ${frame.caption}`;
}

/**
 * Why the run's frames may not show the copy as it is: the run is older
 * than the branch's last commit, or than a file with changed copy.
 */
export function staleness(runAt, lastCommitAt, modified) {
  const warnings = [];
  const at = Date.parse(runAt);
  if (Date.parse(lastCommitAt) > at)
    warnings.push(
      `The storyboard run is older than the branch's last commit (${lastCommitAt}), so its frames may not show the copy as it is. npm run copy -- --storyboard runs it again.`,
    );
  const newer = modified.filter(({ mtime }) => mtime > at).map(({ file }) => file);
  if (newer.length)
    warnings.push(`Changed since the storyboard run: ${newer.join(", ")}. Its frames may not show that copy as it is.`);
  return warnings;
}

/**
 * The sections a storyboard run for this copy runs: those whose frames, in
 * the latest run, showed any of it, if they showed all of it. Otherwise
 * every section (an empty list), as copy no frame has shown could be in any.
 */
export function sectionsToRun(groups, found) {
  const sectionsSeen = new Set();
  for (const group of groups) {
    const frames = found.get(group.key) ?? [];
    if (frames.length === 0) return [];
    for (const { frame } of frames) sectionsSeen.add(frame.section);
  }
  return [...sectionsSeen].sort();
}

/** Writes the page for `runDir`'s storyboard and returns its path and what it found. */
export async function writeCopyPage({ runDir, out = PAGE, base = BASE, git: run } = {}) {
  const git = run ?? ((args) => execFileSync("git", args, { encoding: "utf8" }).trim());
  const groups = groupPlaceholders(changedPlaceholders(base));
  const storyboard = runDir ? JSON.parse(readFileSync(join(runDir, "storyboard.json"), "utf8")) : { frames: [] };
  const found = findInFrames(groups, storyboard);
  const warnings = [];
  if (!runDir) warnings.push("There's no storyboard run, so no frames. npm run copy -- --storyboard runs one.");
  else {
    const modified = [...new Set(groups.flatMap((g) => g.places.map((p) => p.file)))]
      .filter((file) => existsSync(file))
      .map((file) => ({ file, mtime: statSync(file).mtimeMs }));
    warnings.push(...staleness(storyboard.generatedAt, git(["log", "-1", "--format=%cI"]), modified));
  }
  const { images, shots } = runDir ? await picturesOf(groups, found, runDir) : { images: [], shots: new Map() };
  const withShots = groups.map((group) => ({
    ...group,
    cluster: clusterOf(group.places[0], readFileSync(group.places[0].file, "utf8")),
    shots: shots.get(group.key) ?? [],
  }));
  const html = renderCopyPage({
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    base: git(["rev-parse", "--short", git(["merge-base", base, "HEAD"])]),
    run: runDir && { name: basename(runDir), at: storyboard.generatedAt },
    warnings,
    images,
    groups: withShots,
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  return { out, groups: withShots, warnings, found };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const storyboardAt = args.indexOf("--storyboard");
  let runDir;
  if (storyboardAt !== -1) {
    const groups = groupPlaceholders(changedPlaceholders());
    const latest = runDirOf();
    const found = latest
      ? findInFrames(groups, JSON.parse(readFileSync(join(latest, "storyboard.json"), "utf8")))
      : new Map();
    const run = sectionsToRun(groups, found);
    console.log(
      run.length
        ? `▶ Copy: running the storyboard for the sections that showed the copy: ${run.join(", ")}`
        : "▶ Copy: running the whole storyboard, as some of the copy is in no frame yet",
    );
    const result = spawnSync("node", ["scripts/storyboard.mjs", "--no-open", ...args.slice(storyboardAt + 1), ...run], {
      stdio: "inherit",
    });
    if (result.status !== 0)
      console.log(`The storyboard exited with ${result.status}; the page shows what it pictured.`);
    runDir = runDirOf();
  } else {
    runDir = runDirOf(args[0]);
    if (args[0] && !runDir) {
      console.error(`No storyboard.json in ${args[0]}.`);
      process.exit(1);
    }
  }
  const { out, groups, warnings } = await writeCopyPage({ runDir });
  for (const warning of warnings) console.log(`Note: ${warning}`);
  const seen = groups.filter((g) => g.shots.length > 0).length;
  console.log(
    `Copy: ${plural(groups.length, "placeholder")} added or changed, ${seen} in frames, ${groups.length - seen} in none. ${resolve(out)}`,
  );
}
