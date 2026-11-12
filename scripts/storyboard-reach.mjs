// Which of the storyboard's flows a change can reach (docs/testing.md, "Which
// flows a review runs"). Each flow records what it opened (the pages,
// actions, API routes and public files of tests/storyboard/fixtures.ts's
// `opened`); a page reaches the files its route renders and everything they
// import; a flow reaches those and its spec file's imports. A changed file
// reaches the flows whose reach has it.
//
// Some files can't be traced like that, and reach every flow: the database's
// migrations and seed data, the build's and Playwright's set-up. Others reach
// none: docs, plans, unit tests, the review page's own code.
//
// Plain JavaScript, as scripts/storyboard.mjs imports it with Node.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import ts from "typescript";

/** Files no import leads to that every flow depends on: a change to one reruns everything. */
export const EVERYTHING = [
  /^package(-lock)?\.json$/,
  /^tsconfig\.json$/,
  /^playwright\.config\.ts$/,
  /^next\.config\.ts$/,
  /^proxy\.ts$/,
  /^instrumentation(-client)?\.ts$/,
  /^netlify\/database\//,
  /^tests\/fixtures\/.*\.sql$/,
  /^tests\/checkout\.mjs$/,
  /^tests\/storyboard\/global-(setup|teardown)\.ts$/,
  /^scripts\/(fresh-database|serve-fixture)\.mjs$/,
];

/** Files no flow runs or reads: a change to only these reruns nothing. */
export const NOTHING = [
  /^docs\//,
  /^plans\//,
  /^investments\//,
  /^\.github\//,
  /^\.claude\//,
  /^backup\//,
  /\.md$/,
  /\.test\.[cm]?[jt]sx?$/,
  /\.d\.mts$/,
  /^tests\/checks\//,
  /^tests\/storyboard\/report\//,
  /^scripts\//,
  /^(eslint|stylelint|knip)\.config\.[cm]?[jt]s$/,
  /^vitest\.config\.mts$/,
];

const SOURCE_DIRS = ["app", "components", "lib", "styles", "data", "tests"];
const CODE = /\.(tsx?|mts|mjs|jsx?|css|json)$/;
const RESOLVE = ["", ".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".json", "/index.ts", "/index.tsx", "/index.mjs"];

function walk(root, dir, out) {
  if (!existsSync(join(root, dir))) return out;
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walk(root, path, out);
    } else if (CODE.test(entry.name)) out.push(path);
  }
  return out;
}

/** The repo's file that `spec`, imported from `from`, names: `@/` from the root, `./` from beside it. Not a package's. */
export function resolveImport(root, from, spec) {
  const base = spec.startsWith("@/") ? spec.slice(2) : spec.startsWith(".") ? join(dirname(from), spec) : undefined;
  if (base === undefined) return undefined;
  for (const ending of RESOLVE) {
    const path = base + ending;
    if (existsSync(join(root, path)) && statSync(join(root, path)).isFile()) return path;
  }
  return undefined;
}

/**
 * What a file imports that runs: not `import type`, nor an import whose
 * every name is a type, which are gone once compiled. Dynamic `import()`
 * and `require()` of a string count; a stylesheet's `@import` too.
 */
export function importsOf(path, text) {
  if (path.endsWith(".json")) return [];
  if (path.endsWith(".css")) return [...text.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/g)].map((m) => m[1]);
  const specs = [];
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  const typeOnly = (names) => !!names && names.length > 0 && names.every((name) => name.isTypeOnly);
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const names =
        clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : undefined;
      if (!clause?.isTypeOnly && !(clause && !clause.name && typeOnly(names))) specs.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const names = node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause.elements : undefined;
      if (!node.isTypeOnly && !typeOnly(names)) specs.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specs.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specs;
}

/** Every source file under `root`, each with the repo's files it imports. */
export function importGraph(root) {
  const graph = new Map();
  const files = SOURCE_DIRS.flatMap((dir) => walk(root, dir, []));
  for (const name of readdirSync(root)) if (/\.(ts|mts|mjs)$/.test(name)) files.push(name);
  for (const path of files) {
    const text = readFileSync(join(root, path), "utf8");
    graph.set(path, [
      ...new Set(
        importsOf(path, text)
          .map((spec) => resolveImport(root, path, spec))
          .filter(Boolean),
      ),
    ]);
  }
  return graph;
}

/** Every file `entries` reach through `graph`, themselves included. */
export function closure(graph, entries) {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length > 0) {
    const path = stack.pop();
    if (seen.has(path)) continue;
    seen.add(path);
    stack.push(...(graph.get(path) ?? []));
  }
  return seen;
}

/** The files Next renders a route with, from its folder up: the folder's own and each above it. */
const ROUTE_FILES = ["layout", "template", "loading", "error", "not-found", "default", "forbidden", "unauthorized"];
const LEAVES = ["page", "route"];
const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

/** A folder's name as it matches a URL's segment: a group or a slot matches none. */
function segmentPattern(name) {
  if (/^\(.*\)$/.test(name) || name.startsWith("@")) return undefined;
  if (/^\[\[\.\.\..+\]\]$/.test(name)) return "(?:/.*)?";
  if (/^\[\.\.\..+\]$/.test(name)) return "/.+";
  if (/^\[.+\]$/.test(name)) return "/[^/]+";
  return `/${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
}

/** The URL pattern of an `app/` folder, as a regular expression's source: `prefix` also matches what's below it. */
export function folderPattern(folder, prefix = false) {
  const parts = folder
    .split("/")
    .slice(1)
    .map(segmentPattern)
    .filter((part) => part !== undefined);
  const path = parts.join("");
  return new RegExp(`^${path}${prefix ? "(?:/.*)?" : "/?"}$`);
}

/**
 * The app's routes, each with its URL pattern and the files Next renders it
 * with. Metadata routes (`sitemap.ts` for /sitemap.xml) are routes too.
 */
export function appRoutes(root) {
  const routes = [];
  const visit = (folder, around) => {
    const here = [...around];
    for (const name of ROUTE_FILES)
      for (const ext of EXTENSIONS) if (existsSync(join(root, folder, name + ext))) here.push(join(folder, name + ext));
    for (const name of LEAVES)
      for (const ext of EXTENSIONS)
        if (existsSync(join(root, folder, name + ext)))
          routes.push({ pattern: folderPattern(folder), files: [...here, join(folder, name + ext)] });
    for (const [file, url] of [
      ["sitemap", "sitemap.xml"],
      ["robots", "robots.txt"],
      ["manifest", "manifest.webmanifest"],
    ])
      for (const ext of EXTENSIONS)
        if (existsSync(join(root, folder, file + ext)))
          routes.push({ pattern: folderPattern(join(folder, url)), files: [...here, join(folder, file + ext)] });
    for (const entry of readdirSync(join(root, folder), { withFileTypes: true }))
      if (entry.isDirectory() && !entry.name.startsWith("_")) visit(join(folder, entry.name), here);
  };
  if (existsSync(join(root, "app"))) visit("app", []);
  // A route's own folder before a catch-all's, so /blog/feed.xml is the feed, not a post.
  return routes.sort((a, b) => b.pattern.source.length - a.pattern.source.length);
}

/** The files that render `path`: its route's, or the not-found page's if none matches. */
export function routeFiles(routes, path) {
  const route = routes.find((r) => r.pattern.test(path));
  if (route) return route.files;
  return ["app/layout.tsx", "app/not-found.tsx"];
}

/**
 * Where the gallery's flows differ from what their imports say. Each group's
 * page renders only that group's examples, though the index it picks them
 * from imports every group's: `gallery: forms` reaches `_examples/forms.tsx`
 * (and `forms.client.tsx`), not the staff screens'.
 */
const GALLERY_EXAMPLES = "app/(tools)/gallery/_examples/index.ts";

function flowGraph(graph, run) {
  const group = run.section === "gallery" ? /^gallery: (.+)$/.exec(run.flow)?.[1] : undefined;
  if (!group || !graph.has(GALLERY_EXAMPLES)) return graph;
  const own = graph
    .get(GALLERY_EXAMPLES)
    .filter((path) => /^(.*)\/([^/]+?)(\.client)?\.tsx?$/.exec(path)?.[2] === group);
  return new Map([...graph, [GALLERY_EXAMPLES, own]]);
}

/**
 * The files a flow can reach: its spec file and what it imports, and for
 * each page, action or API route it opened, the files that render it and
 * what they import. A public file it fetched counts as itself.
 */
export function flowReach(run, { graph, routes, root }) {
  const entries = [`tests/storyboard/${run.section}.spec.ts`];
  const files = new Set();
  for (const path of run.opened ?? []) {
    if (existsSync(join(root, "public", path)) && statSync(join(root, "public", path)).isFile())
      files.add(`public${path}`);
    else entries.push(...routeFiles(routes, path));
  }
  for (const path of closure(flowGraph(graph, run), entries)) files.add(path);
  return files;
}

/**
 * The staff interface's words are one object, `staffCopy`, read by most of
 * the staff pages. A change to it counts only for the files that read the
 * keys it changed (staffCopy.letters, or `const { letters } = staffCopy`), or
 * that pass the object whole.
 */
export const STAFF_COPY = "lib/content/staff-interface.ts";

/** The top-level keys of `staffCopy` whose lines a diff (`git diff -U0`) changed, from the file before and after; "*" for a line outside any. */
export function changedCopyKeys(diff, before, after) {
  const keyAt = (text) => {
    const starts = [];
    text.split("\n").forEach((line, at) => {
      const key = /^ {2}(\w+): /.exec(line)?.[1];
      if (key) starts.push({ key, line: at + 1 });
    });
    return (line) => starts.findLast((start) => start.line <= line)?.key ?? "*";
  };
  const old = keyAt(before);
  const now = keyAt(after);
  const keys = new Set();
  for (const hunk of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    const [from, removed, to, added] = [hunk[1], hunk[2] ?? "1", hunk[3], hunk[4] ?? "1"].map(Number);
    for (let line = from; line < from + removed; line++) keys.add(old(line));
    for (let line = to; line < to + added; line++) keys.add(now(line));
  }
  return keys;
}

/** The keys of `staffCopy` a file reads, or "*" if it uses the object whole. */
export function copyKeysRead(text) {
  const keys = new Set();
  for (const match of text.matchAll(/staffCopy\.(\w+)/g)) keys.add(match[1]);
  for (const match of text.matchAll(/\{([^}]*)\}\s*=\s*staffCopy\b/g))
    for (const name of match[1].split(",")) if (name.trim()) keys.add(name.trim().split(/[\s:]/)[0]);
  const elsewhere = text
    .replace(/import[^;]*\bstaffCopy\b[^;]*;/g, "")
    .replace(/staffCopy\.\w+/g, "")
    .replace(/\{[^}]*\}\s*=\s*staffCopy\b/g, "");
  if (/\bstaffCopy\b/.test(elsewhere)) keys.add("*");
  return keys;
}

/**
 * A file read while the site runs rather than imported (a fixture's email,
 * a CSV a flow uploads) reaches the flows that reach a file naming it, or the
 * folder it's read from.
 */
function readers(root, graph, path, specs) {
  const name = path.split("/").at(-1);
  const folder = path.split("/").at(-2);
  const out = [];
  for (const file of [...graph.keys(), ...specs]) {
    const text = readFileSync(join(root, file), "utf8");
    if (text.includes(name) || (folder && (text.includes(`/${folder}/`) || text.includes(`"${folder}"`))))
      out.push(file);
  }
  return out;
}

/** What working out reach needs of the checkout at `root`, built once for every call of reachedFlows. */
export function reachContext(root) {
  const specs = readdirSync(join(root, "tests/storyboard"))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => `tests/storyboard/${name}`);
  return { root, graph: importGraph(root), routes: appRoutes(root), specs };
}

/**
 * The flows of `runs` (each with its key and `opened`) that changed `files`
 * can reach. `copyKeys`, if `staffCopy`'s file is one, are the keys of it that changed (changedCopyKeys).
 * Returns the keys of the flows reached, and the files that reach every flow,
 * if any changed; with those, `keys` is still what the rest reach.
 */
export function reachedFlows({ files, runs, context, copyKeys }) {
  const { graph, root, specs } = context;
  const reach = new Map(runs.map((run) => [run.key, flowReach(run, context)]));
  const flowsReaching = (paths) =>
    new Set(runs.filter((run) => paths.some((p) => reach.get(run.key).has(p))).map((run) => run.key));

  const keys = new Set();
  const everything = [];
  for (const path of files) {
    if (EVERYTHING.some((re) => re.test(path))) {
      everything.push(path);
      continue;
    }
    if (NOTHING.some((re) => re.test(path))) continue;
    if (path === STAFF_COPY && copyKeys && !copyKeys.has("*")) {
      const readersOfKeys = [...graph]
        .filter(([, imports]) => imports.includes(STAFF_COPY))
        .map(([file]) => file)
        .filter((file) => {
          const read = copyKeysRead(readFileSync(join(root, file), "utf8"));
          return read.has("*") || [...copyKeys].some((key) => read.has(key));
        });
      for (const key of flowsReaching(readersOfKeys)) keys.add(key);
      continue;
    }
    // A route's own file, added or deleted as well as changed: the flows that opened a URL it serves, or one below it.
    const routeFile = /^(app\/.*)\/([\w-]+)\.[jt]sx?$/.exec(path);
    if (routeFile && [...ROUTE_FILES, ...LEAVES].includes(routeFile[2])) {
      const pattern = folderPattern(routeFile[1], ROUTE_FILES.includes(routeFile[2]));
      for (const run of runs) if ((run.opened ?? []).some((opened) => pattern.test(opened))) keys.add(run.key);
    }
    if (CODE.test(path) || path.startsWith("public/")) {
      for (const key of flowsReaching([path])) keys.add(key);
      continue;
    }
    for (const key of flowsReaching(readers(root, graph, path, specs))) keys.add(key);
  }
  return { keys, everything };
}

/**
 * Which flows of `suite` (keys) a review runs, against `carried`, the last
 * run's flows (each with the tree it ran on and what it opened):
 *
 * - a flow with no run to carry, or one that didn't pass, or one recorded
 *   before flows kept their tree and what they opened;
 * - a flow that the files changed since its tree (`changedSince(tree)`)
 *   reach;
 * - when one of those files reaches everything (a migration, the seed
 *   data): every desktop flow, and the phone's flows of `phoneTagged`, the
 *   ones the gate runs there too.
 *
 * `copyKeysSince(tree)` gives the keys of staffCopy changed since `tree`,
 * if its file changed. Returns the keys to run, and why, for the run to say.
 */
export function flowsToRun({ suite, carried, phoneTagged, context, changedSince, copyKeysSince }) {
  const byKey = new Map(carried.map((run) => [run.key, run]));
  const run = new Set();
  let fresh = 0;
  for (const key of suite) {
    const last = byKey.get(key);
    if (!last || last.status !== "passed" || !last.tree || !last.opened) {
      run.add(key);
      fresh++;
    }
  }
  const trees = new Map();
  for (const last of carried) {
    if (!suite.has(last.key) || run.has(last.key)) continue;
    if (!trees.has(last.tree)) trees.set(last.tree, []);
    trees.get(last.tree).push(last);
  }
  const everything = new Set();
  let reached = 0;
  const changed = new Set();
  for (const [tree, runs] of trees) {
    const files = changedSince(tree);
    for (const file of files) changed.add(file);
    if (files.length === 0) continue;
    const found = reachedFlows({ files, runs, context, copyKeys: copyKeysSince(tree) });
    for (const file of found.everything) everything.add(file);
    for (const key of found.keys) {
      run.add(key);
      reached++;
    }
    if (found.everything.length > 0)
      for (const { key } of runs) if (key.startsWith("desktop|") || phoneTagged.has(key)) run.add(key);
  }
  return { run, fresh, reached, everything: [...everything], changed: [...changed] };
}
