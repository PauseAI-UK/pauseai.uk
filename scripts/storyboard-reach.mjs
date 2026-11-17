// Which of the storyboard's flows a change can reach (docs/testing.md, "Which
// flows a review runs"). Each flow records what it opened (the pages,
// actions, API routes and public files of tests/storyboard/fixtures.ts's
// `opened`); a page reaches the files its route renders and everything they
// import; a flow reaches those and its spec file's imports. A changed file
// reaches the flows whose reach has it.
//
// Some files can't be traced like that, and reach every flow: the database's
// migrations and seed data, the build's and Playwright's set-up. Others reach
// none: docs, plans, unit tests, the review page's own code. A file that is
// none of these, and that nothing imports or names, can't be placed: every
// flow runs, and the review says which file it was, so this map can be taught.
//
// Plain JavaScript, as scripts/storyboard.mjs imports it with Node.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import ts from "typescript";

/**
 * Which way of recording what a flow opened its record was made by
 * (tests/storyboard/fixtures.ts, scripts/record-requests.mjs), as the
 * reporter stamps each flow. Add one whenever the recording, or how this map
 * reads it, changes what a record holds: a flow recorded another way is run
 * again, never carried on a record that may leave something out.
 */
export const RECORDING = 1;

/** Files no import leads to that every flow depends on: a change to one reruns everything. */
const EVERYTHING = [
  /^package(-lock)?\.json$/,
  /^\.(nvmrc|npmrc)$/,
  /^tsconfig\.json$/,
  /^playwright\.config\.ts$/,
  /^next\.config\.ts$/,
  /^proxy\.ts$/,
  /^instrumentation(-client)?\.ts$/,
  // The migrations, the schema and how they're applied; not the unit tests beside them.
  /^netlify\/database\/(?!.*\.test\.ts$)/,
  /^tests\/fixtures\/.*\.sql$/,
  /^tests\/checkout\.mjs$/,
  /^tests\/storyboard\/global-(setup|teardown)\.ts$/,
  /^scripts\/(fresh-database|serve-fixture|record-requests)\.mjs$/,
];

/** Files no flow runs or reads: a change to only these reruns nothing. */
const NOTHING = [
  /^docs\//,
  /^plans\//,
  /^investments\//,
  /^\.github\//,
  /^\.claude\//,
  /^backup\//,
  /^[^/]+\.md$/,
  /(^|\/)README\.md$/,
  /\.test\.[cm]?[jt]sx?$/,
  /\.d\.m?ts$/,
  /^tests\/checks\//,
  /^tests\/storyboard\/report\//,
  /^(eslint|stylelint|knip)\.config\.[cm]?[jt]s$/,
  /^vitest\.config\.mts$/,
  /^\.(gitignore|prettierignore|prettierrc\.json|stylelintignore|git-blame-ignore-revs|pre-commit-config\.yaml|env\.example)$/,
  /^docker-compose\.yml$/,
  /^netlify\.toml$/,
];

/** Whether `path` is one no flow runs or reads (NOTHING): a change to only such files needs no check of the map. */
export function readByNoFlow(path) {
  return NOTHING.some((re) => re.test(path));
}

/**
 * Folders of no source: what's built, installed or thrown away. Coverage's
 * reports among them, which a test run writes and deletes while another
 * test, such as the import-cycle check, may be reading the repo.
 */
const NOT_SOURCE = new Set([
  "node_modules",
  ".git",
  ".next",
  ".netlify",
  "tmp",
  "test-results",
  "playwright-report",
  "coverage",
]);
const CODE = /\.(tsx?|mts|mjs|jsx?|css|json)$/;
/** Code that's imported, never read as a file: the rest is data (JSON, pictures, fonts, emails, text). */
const IMPORTED = /\.(tsx?|mts|mjs|jsx?|css)$/;
/** What stands for an import() or require() of something other than a plain string, which can't be followed. */
const NOT_PLAIN = "(not a plain string)";
const RESOLVE = ["", ".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".json", "/index.ts", "/index.tsx", "/index.mjs"];

function walk(root, dir, out) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!NOT_SOURCE.has(entry.name)) walk(root, path, out);
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
  if (path.endsWith(".css"))
    return [...text.matchAll(/(?:@import\s+(?:url\()?|composes:[^;]*\bfrom\s+)["']([^"']+)["']/g)].map((m) => m[1]);
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
      node.arguments.length > 0
    ) {
      specs.push(ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : NOT_PLAIN);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specs;
}

/**
 * Code handed to a module as another loads, which the first then calls
 * without importing it: lib/server/problems.server.ts is told how to find the run
 * in progress by run-store.server.ts, and what keeps an error by instrumentation.ts.
 * A flow that reaches the module reaches what's handed to it, as if it were
 * imported. handOvers finds the places in the site's code that could be
 * another, and the tests check each is here or known not to be one.
 */
const HANDED_OVER = { "lib/server/problems.server.ts": ["lib/server/run-store.server.ts", "instrumentation.ts"] };

/**
 * Where the site's code (`dirs` under `root`) could hand code over without
 * an import: a call, as a module loads, of a function it imported, which is
 * how a module registers itself with another; and a use of `globalThis`.
 * Each as "file: what".
 */
export function handOvers(root, dirs) {
  const found = [];
  for (const path of dirs.flatMap((dir) => walk(root, dir, []))) {
    if (!/\.[cm]?[jt]sx?$/.test(path) || /\.test\.[cm]?[jt]sx?$/.test(path)) continue;
    const text = readFileSync(join(root, path), "utf8");
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const imported = new Set();
    for (const statement of source.statements) {
      const clause = ts.isImportDeclaration(statement) ? statement.importClause : undefined;
      if (clause?.name) imported.add(clause.name.text);
      const names = clause?.namedBindings;
      if (names && ts.isNamedImports(names)) for (const name of names.elements) imported.add(name.name.text);
      if (names && ts.isNamespaceImport(names)) imported.add(names.name.text);
    }
    for (const statement of source.statements) {
      if (!ts.isExpressionStatement(statement)) continue;
      const called = ts.isAwaitExpression(statement.expression)
        ? statement.expression.expression
        : statement.expression;
      if (!ts.isCallExpression(called)) continue;
      let callee = called.expression;
      while (ts.isPropertyAccessExpression(callee)) callee = callee.expression;
      if (ts.isIdentifier(callee) && imported.has(callee.text))
        found.push(`${path}: calls ${callee.text}() as it loads`);
    }
    const globals = (node) =>
      (ts.isIdentifier(node) && node.text === "globalThis") || ts.forEachChild(node, globals) || false;
    if (globals(source)) found.push(`${path}: uses globalThis`);
  }
  return found;
}

/**
 * Every source file under `root`, each with the repo's files it imports,
 * and what's handed over to it (HANDED_OVER), unless `handedOver` is false:
 * the imports alone, as a check of import cycles wants them.
 */
export function importGraph(root, { handedOver = true } = {}) {
  const graph = new Map();
  for (const path of walk(root, "", [])) {
    const text = readFileSync(join(root, path), "utf8");
    graph.set(path, [
      ...new Set(
        importsOf(path, text)
          .map((spec) => resolveImport(root, path, spec))
          .filter(Boolean),
      ),
    ]);
  }
  if (!handedOver) return graph;
  for (const [to, handed] of Object.entries(HANDED_OVER))
    if (graph.has(to)) graph.set(to, [...graph.get(to), ...handed.filter((path) => graph.has(path))]);
  return graph;
}

/**
 * The imports under `root`'s folders `dirs` that the map can't follow: one
 * naming a file of the repo (`@/`, `./`) that isn't there, and an import()
 * or require() of something other than a plain string.
 */
export function unresolvedImports(root, dirs) {
  const missing = [];
  for (const path of dirs.flatMap((dir) => walk(root, dir, [])))
    for (const spec of importsOf(path, readFileSync(join(root, path), "utf8")))
      if (spec === NOT_PLAIN || ((spec.startsWith("@/") || spec.startsWith(".")) && !resolveImport(root, path, spec)))
        missing.push(`${path}: ${spec}`);
  return missing;
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
const ROUTE_FILES = [
  "layout",
  "template",
  "loading",
  "error",
  "global-error",
  "not-found",
  "global-not-found",
  "default",
  "forbidden",
  "unauthorized",
];
/** Files Next serves from `app/` that this map doesn't match to an address: a change to one can't be placed. */
const UNMATCHED_ROUTE_FILES = /^app\/(.*\/)?(opengraph-image|twitter-image|icon|apple-icon|favicon)\.[a-z]+$/;
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
  return routes;
}

/**
 * The files that render `path`: those of every route whose pattern matches
 * it, as which of a page and a catch-all beside it Next picks isn't worked
 * out here; or the not-found page's if none does.
 */
export function routeFiles(routes, path) {
  const files = routes.filter((route) => route.pattern.test(path)).flatMap((route) => route.files);
  return files.length > 0 ? [...new Set(files)] : ["app/layout.tsx", "app/not-found.tsx"];
}

/**
 * Where the gallery's flows differ from what their imports say. Each group's
 * page renders only that group's examples, though the index it picks them
 * from imports every group's: `gallery: forms` reaches `_examples/forms.tsx`
 * (and `forms.client.tsx`), not the staff screens'. A flow whose group has
 * no examples file of its name, such as the gallery's own index, reaches
 * them all. The page still loads every group's code and styles, so this
 * holds only for what can't act on a page it isn't used on: a plain
 * stylesheet, which applies to every page that loads it, is reached through
 * the imports as they are (`whole`).
 */
const GALLERY_EXAMPLES = "app/(tools)/gallery/_examples/index.ts";

/** A gallery flow's group's own files of examples (`_examples/forms.tsx` and `forms.client.tsx`), if it has any. */
function groupFiles(graph, run) {
  const group = run.section === "gallery" ? /^gallery: (.+)$/.exec(run.flow)?.[1] : undefined;
  return (group ? (graph.get(GALLERY_EXAMPLES) ?? []) : []).filter(
    (path) => /([^/]+?)(\.client)?\.tsx?$/.exec(path)?.[1] === group,
  );
}

/**
 * The graph a flow's reach is worked out on: a gallery group's flow's
 * narrowed to its own examples, less, from them, the imports of `cut`.
 */
function flowGraph(graph, run, cut = new Set()) {
  const own = groupFiles(graph, run);
  if (own.length === 0) return graph;
  const narrowed = new Map([...graph, [GALLERY_EXAMPLES, own]]);
  for (const path of own)
    narrowed.set(
      path,
      (graph.get(path) ?? []).filter((to) => !cut.has(to)),
    );
  return narrowed;
}

/**
 * Where each of a gallery group's frames comes from, so a change can be
 * found to reach some of them and not the rest (docs/testing.md, "The
 * component gallery"). Each frame records the file of the component it
 * pictures (`file`), whose examples are in the file beside it,
 * `Component.gallery.tsx`, when the group imports one: that's the frame's
 * `root`, which reaches what the frame shows. A frame whose examples are in
 * the group's own file has none. What the group's page reaches with every
 * root taken out of the group's imports is the flow's `own` reach: the page,
 * the group's own file, and what both import. A change there, or to a plain
 * stylesheet, which applies to the whole page, can change any frame.
 *
 * Undefined for any other flow, and for one with a frame that recorded no
 * file: a run from before frames recorded theirs.
 */
function galleryParts(run, context) {
  const { graph } = context;
  const own = groupFiles(graph, run);
  const frames = run.frames ?? [];
  if (own.length === 0 || frames.length === 0 || frames.some((frame) => !frame.file)) return undefined;
  const imported = new Set(own.flatMap((path) => graph.get(path) ?? []));
  const roots = frames.map((frame) => {
    const beside = frame.file.replace(/\.tsx$/, ".gallery.tsx");
    return beside !== frame.file && imported.has(beside) ? beside : undefined;
  });
  return { roots, own: flowReach(run, context, false, new Set(roots.filter(Boolean))) };
}

/** What a gallery frame's root reaches (galleryParts): it and what it imports, worked out once for a context. */
function rootReach(context, root) {
  context.roots ??= new Map();
  if (!context.roots.has(root)) context.roots.set(root, closure(context.graph, [root]));
  return context.roots.get(root);
}

/**
 * The frames of a gallery flow that `hits`, the changed files in its reach,
 * can't change, which a review carries from the run it chose rather than
 * picturing again; undefined when they can change any of them, or the flow
 * isn't one whose frames can be told apart (galleryParts), or none would be
 * carried.
 */
function carriedFrames(run, context, hits) {
  const parts = galleryParts(run, context);
  if (!parts || hits.some((path) => plainStyles(path) || parts.own.has(path))) return undefined;
  const reached = parts.roots.map(
    (root) => root !== undefined && hits.some((path) => rootReach(context, root).has(path)),
  );
  const carried = run.frames.filter((frame, at) => !reached[at]);
  return carried.length > 0 ? carried : undefined;
}

/** A plain stylesheet, not a CSS module: it applies wherever it's loaded, so it's reached through the imports as they are. */
const plainStyles = (path) => path.endsWith(".css") && !path.endsWith(".module.css");

/**
 * What every flow runs, whatever it opens: the build's settings and the
 * proxy, and Playwright's own set-up. What they import, every flow reaches.
 */
const ALWAYS = [
  "next.config.ts",
  "proxy.ts",
  "playwright.config.ts",
  "tests/storyboard/global-setup.ts",
  "tests/storyboard/global-teardown.ts",
  "scripts/serve-fixture.mjs",
];
/** As ALWAYS, if the repo has it: what Next runs in every browser as a page starts. */
const ALWAYS_IF_THERE = ["instrumentation-client.ts"];

/** Where an error the server keeps is handed over (tests/storyboard/fixtures.ts records it as opened). */
const ERRORS_KEPT = "instrumentation.ts";

/** The files this map names by their paths: if one moves, its rule here stops applying (the tests check they exist). */
export const NAMED = [...ALWAYS, ERRORS_KEPT, GALLERY_EXAMPLES, ...Object.entries(HANDED_OVER).flat(2)];

/**
 * SQL with its comments taken out and each run of space between tokens made
 * one space: what Postgres runs. Text in quotes, names in double quotes and
 * dollar-quoted bodies are kept as they are, comments in them too, as a
 * function's body is the function's.
 */
export function sqlWithoutComments(sql) {
  let out = "";
  let at = 0;
  const space = () => {
    if (out !== "" && !out.endsWith(" ")) out += " ";
  };
  while (at < sql.length) {
    const rest = sql.slice(at, at + 2);
    if (rest === "--") {
      const end = sql.indexOf("\n", at);
      at = end === -1 ? sql.length : end;
      space();
    } else if (rest === "/*") {
      // Postgres's block comments nest.
      let depth = 0;
      do {
        const step = sql.startsWith("/*", at) ? 1 : sql.startsWith("*/", at) ? -1 : 0;
        depth += step;
        at += step === 0 ? 1 : 2;
      } while (depth > 0 && at < sql.length);
      space();
    } else if (/\s/.test(sql[at])) {
      at++;
      space();
    } else if (sql[at] === "'" || sql[at] === '"') {
      // A quote doubled inside is the quote itself, and the text goes on; so is one after a backslash in E'…'.
      const quote = sql[at];
      const escapes = quote === "'" && /(^|[^\w$])[Ee]$/.test(out);
      let end = at + 1;
      while (end < sql.length) {
        if (escapes && sql[end] === "\\") end += 2;
        else if (sql[end] === quote && sql[end + 1] === quote) end += 2;
        else if (sql[end] === quote) break;
        else end++;
      }
      end = Math.min(end + 1, sql.length);
      out += sql.slice(at, end);
      at = end;
    } else {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(at))?.[0];
      if (tag) {
        const close = sql.indexOf(tag, at + tag.length);
        const end = close === -1 ? sql.length : close + tag.length;
        out += sql.slice(at, end);
        at = end;
      } else out += sql[at++];
    }
  }
  return out.trim();
}

/** For each context's cache of flowReach, each run's answers, found by the run itself: whole, and not. */
const answersByRun = new WeakMap();

/**
 * The files a flow can reach: its spec file and what it imports; for each
 * page, action or API route it opened, the files that render it and what
 * they import; and what every flow runs (ALWAYS). A public file it fetched
 * counts as itself. An entry of `opened` that isn't a path names a file of
 * the repo whose code ran in the flow some other way
 * (tests/storyboard/fixtures.ts: `instrumentation.ts`, when the server kept
 * an error).
 *
 * `whole` takes the imports as they are, for a plain stylesheet. `cut`, for
 * a gallery group's flow, takes those files out of its group's imports
 * (galleryParts).
 */
export function flowReach(run, { graph, routes, root, reaches }, whole = false, cut = undefined) {
  const mode = whole ? "whole" : cut ? "own" : "flow";
  // A review asks this of every run for every changed file, so the run itself finds its answer, without
  // making the key below, which is as long as everything the flow opened.
  if (reaches && !answersByRun.has(reaches)) answersByRun.set(reaches, new WeakMap());
  const answers = reaches && answersByRun.get(reaches);
  const answered = answers?.get(run)?.[mode];
  if (answered) return answered;
  const keep = (files) => {
    answers?.set(run, { ...answers.get(run), [mode]: files });
    return files;
  };
  // The same flow, having opened the same things, reaches the same files, whichever run it's from.
  const cached = `${mode}|${run.section}|${run.flow}|${(run.opened ?? []).join("|")}|${[...(cut ?? [])].join("|")}`;
  if (reaches?.has(cached)) return keep(reaches.get(cached));
  const entries = [
    `tests/storyboard/${run.section}.spec.ts`,
    ...[...ALWAYS, ...ALWAYS_IF_THERE].filter((path) => graph.has(path)),
  ];
  const files = new Set();
  for (const path of run.opened ?? []) {
    if (!path.startsWith("/")) entries.push(path);
    else if (existsSync(join(root, "public", path)) && statSync(join(root, "public", path)).isFile())
      files.add(`public${path}`);
    else entries.push(...routeFiles(routes, path));
  }
  for (const path of closure(whole ? graph : flowGraph(graph, run, cut), entries)) files.add(path);
  reaches?.set(cached, files);
  return keep(files);
}

/** The text of a file of the checkout, read once for a context. */
function textOf(context, file) {
  context.texts ??= new Map();
  if (!context.texts.has(file)) context.texts.set(file, readFileSync(join(context.root, file), "utf8"));
  return context.texts.get(file);
}

/** Whether `text` names the folder `name` as somewhere to read from: a path's whole segment, ending a string or before a `${…}`. */
function namesFolder(text, name) {
  const folder = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(["'\`/])${folder}/?(["'\`]|\\$\\{)`).test(text);
}

/**
 * The files that may read `path` as the site or a flow runs, where it's
 * data and not imported code (a fixture's email, a CSV a flow uploads, a
 * font, a picture a flow stands in for another): those naming it, or naming
 * the folder it's in as somewhere to read from.
 */
function readers(context, path) {
  const name = path.split("/").at(-1);
  const folder = path.split("/").at(-2);
  return [...context.graph.keys()].filter((file) => {
    const text = textOf(context, file);
    return text.includes(name) || (folder !== undefined && namesFolder(text, folder));
  });
}

/**
 * The files that list a folder `path` is in or under (the sitemap and the
 * tests' list of routes walk `app/`): what they find changes when a file
 * there is added or deleted.
 */
function listers(context, path) {
  const folders = path.split("/").slice(0, -1);
  // The files that list any folder at all, found once for the context.
  context.listing ??= [...context.graph.keys()].filter((file) => /\breaddir(Sync)?\(/.test(textOf(context, file)));
  return context.listing.filter((file) => folders.some((folder) => namesFolder(textOf(context, file), folder)));
}

/** Whether a file of `graph` imports `path`. */
function graphImported(graph, path) {
  for (const imports of graph.values()) if (imports.includes(path)) return true;
  return false;
}

/** What working out reach needs of the checkout at `root`, built once for every call of reachedFlows. */
export function reachContext(root) {
  return { root, graph: importGraph(root), routes: appRoutes(root), reaches: new Map() };
}

/**
 * The flows of `runs` (each with its key and `opened`) that changed `files`
 * can reach; `addedOrDeleted` are those of them added or deleted. Returns:
 *
 * - `keys`, the flows reached;
 * - `carried`, of those, the gallery's flows that the files reach only some
 *   frames of, each with the frames of its run they can't change
 *   (carriedFrames), by key;
 * - `everything`, the files that reach every flow, if any changed;
 * - `unknown`, the files the map can't place.
 */
export function reachedFlows({ files, addedOrDeleted = [], runs, context }) {
  const { graph } = context;
  // The files whose flows are reached, each run then checked once against all of them, below.
  const reaching = new Set();
  const reachThrough = (paths) => paths.forEach((path) => reaching.add(path));
  const flowsThatOpened = (matches) => runs.filter((run) => (run.opened ?? []).some(matches)).map((run) => run.key);

  const keys = new Set();
  const add = (found) => found.forEach((key) => keys.add(key));
  const everything = [];
  const unknown = [];
  for (const path of files) {
    // Imported, whatever kind of file it is: the flows whose reach has it.
    reachThrough([path]);
    if (EVERYTHING.some((re) => re.test(path))) {
      everything.push(path);
    } else if (NOTHING.some((re) => re.test(path))) {
      continue;
    } else if (IMPORTED.test(path)) {
      // A route's own file, added or deleted as well as changed: the flows that opened an address it serves, or one below it.
      const routeFile = /^(app(?:\/.*)?)\/([\w-]+)\.[jt]sx?$/.exec(path);
      if (routeFile && [...ROUTE_FILES, ...LEAVES].includes(routeFile[2])) {
        const pattern = folderPattern(routeFile[1], ROUTE_FILES.includes(routeFile[2]));
        add(flowsThatOpened((opened) => pattern.test(opened)));
      }
      // One Next serves at an address this map doesn't work out, or a file at the top that nothing imports,
      // such as a build tool's settings: what it changes isn't known.
      if (UNMATCHED_ROUTE_FILES.test(path) || (!path.includes("/") && !graphImported(graph, path))) unknown.push(path);
    } else {
      // Data. A public file is fetched by its address, there now or not.
      const isPublic = path.startsWith("public/");
      if (isPublic) add(flowsThatOpened((opened) => opened === path.slice("public".length)));
      // Read as the site or a flow runs: the flows that reach a file naming it. If it isn't public, and nothing
      // names or imports it, what reads it isn't known.
      const found = readers(context, path);
      reachThrough(found);
      if (UNMATCHED_ROUTE_FILES.test(path) || (!isPublic && found.length === 0 && !graphImported(graph, path)))
        unknown.push(path);
    }
  }
  // What lists a folder finds something else when a file in it comes or goes. Not for a file that reaches every
  // flow anyway, as a new migration does: how far that goes is flowsToRun's to say.
  for (const path of addedOrDeleted) if (!EVERYTHING.some((re) => re.test(path))) reachThrough(listers(context, path));
  const paths = [...reaching];
  const carried = new Map();
  for (const run of runs) {
    if (keys.has(run.key)) continue;
    const hits = paths.filter((path) => flowReach(run, context, plainStyles(path)).has(path));
    if (hits.length === 0) continue;
    keys.add(run.key);
    const frames = carriedFrames(run, context, hits);
    if (frames) carried.set(run.key, frames);
  }
  return { keys, carried, everything, unknown };
}

/**
 * Which flows of `suite` (keys) a review runs, against `carried`, the last
 * run's flows (each with the tree it ran on and what it opened):
 *
 * - a flow with no run to carry, or one that didn't pass, or one that
 *   recorded no tree or nothing of what it opened, or recorded it another
 *   way (RECORDING) (`fresh`);
 * - a flow that ran on other installed dependencies than `setup`, which
 *   the tree doesn't hold (`fresh` too);
 * - a flow whose tree git no longer has, so `changedSince(tree)` is
 *   undefined (`fresh` too);
 * - a flow that the files changed since its tree reach (`reached`);
 * - when one of those files reaches everything (a migration, the seed
 *   data): every desktop flow, and the phone's flows of `phoneTagged`, the
 *   ones CI runs there (`everything`, the files, and `swept`, the flows);
 * - when the map can't place one of them (`unknown`: a file at the top
 *   that nothing imports, or one no code names): every flow.
 *
 * A flow a review carried says the tree it was carried at (`seen`): the
 * files changed since then are what can have reached it since, as those
 * before were found not to. `changedSince(tree)` gives the files changed
 * since `tree`, and those of them added or deleted. Returns the keys to run, and why,
 * for the run to say, and `carried`: of the gallery flows to run, those a
 * change reaches only some frames of, each with the frames of its run that
 * it needn't picture again (reachedFlows).
 */
export function flowsToRun({ suite, carried, phoneTagged, context, setup, changedSince }) {
  const byKey = new Map(carried.map((run) => [run.key, run]));
  const run = new Set();
  for (const key of suite) {
    const last = byKey.get(key);
    const recorded = last?.tree && last.opened && last.recording === RECORDING;
    if (!recorded || last.status !== "passed" || last.setup !== setup) run.add(key);
  }
  // By the tree each was last known to look as it does: the one a review last carried it at (`seen`), or the one it ran on.
  const trees = new Map();
  for (const last of carried) {
    if (!suite.has(last.key) || run.has(last.key)) continue;
    const tree = last.seen ?? last.tree;
    if (!trees.has(tree)) trees.set(tree, []);
    trees.get(tree).push(last);
  }
  const everything = new Set();
  const unknown = new Set();
  const changed = new Set();
  const reached = new Set();
  const swept = new Set();
  const inPart = new Map();
  for (const [tree, runs] of trees) {
    const since = changedSince(tree);
    if (!since) {
      for (const { key } of runs) run.add(key);
      continue;
    }
    for (const file of since.files) changed.add(file);
    if (since.files.length === 0) continue;
    const found = reachedFlows({ ...since, runs, context });
    for (const file of found.everything) everything.add(file);
    for (const file of found.unknown) unknown.add(file);
    for (const key of found.keys) reached.add(key);
    for (const [key, frames] of found.carried) inPart.set(key, frames);
    if (found.everything.length > 0)
      for (const { key } of runs) if (key.startsWith("desktop|") || phoneTagged.has(key)) swept.add(key);
  }
  const fresh = run.size;
  for (const key of [...reached, ...swept]) run.add(key);
  // A file the map can't place: every flow, on both viewports.
  if (unknown.size > 0) for (const key of suite) run.add(key);
  // Only what nothing else makes run whole: a file that reaches everything, or one the map can't place.
  return {
    run,
    carried: new Map(unknown.size > 0 ? [] : [...inPart].filter(([key]) => !swept.has(key))),
    fresh,
    reached: reached.size,
    swept: swept.size,
    everything: [...everything],
    unknown: [...unknown],
    changed: [...changed],
  };
}
