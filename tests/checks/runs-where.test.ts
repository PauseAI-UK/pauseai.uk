import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, normalize } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// A module's name says where it runs (docs/code-structure.md, "Where code
// runs"): x.server.ts only on the server, and it imports "server-only";
// x.client.ts only in the browser, and it imports "client-only"; anything
// else, components included, runs on both. Each marker is in its file's name
// and its file's imports, or in neither. And a module that reads
// process.env, or imports the database, the settings or an outside
// service's binding, can only run on the server, so it's x.server.ts.
//
// Left out: tests; Next's own files (pages, layouts, routes and the like),
// whose names Next gives them; Server Actions ("use server"), which the
// browser calls; components (.tsx), as a server component that loads data
// is still a component; the gallery's examples (*.client.tsx, "use client"),
// components with state; the fakes in lib/server/fixtures/, which the
// storyboard loads outside the site, where "server-only" throws; and
// lib/now.ts, the clock, which reads FIXTURE_NOW and runs in the browser too.

const ROOT = join(__dirname, "..", "..");
const DIRS = ["app", "components", "lib"];
const CODE = /\.(ts|tsx|mts)$/;
const TEST = /\.test\.(ts|tsx|mts)$/;
const NEXT_FILES = new Set([
  "page",
  "layout",
  "template",
  "default",
  "route",
  "loading",
  "error",
  "global-error",
  "not-found",
  "sitemap",
  "robots",
  "manifest",
  "icon",
  "apple-icon",
  "opengraph-image",
  "twitter-image",
]);
const ANY_WHERE = ["lib/server/fixtures/", "lib/now.ts"];

/** What only the server can reach: the database, the settings and the outside services' bindings. */
const SERVER_ONLY_TARGET = /^lib\/server\/((db|sql|config)\.server|outside-services\/[^/]+\.server)$/;

function codeFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return codeFiles(path);
    return CODE.test(entry.name) && !TEST.test(entry.name) ? [path] : [];
  });
}

/** A module specifier as a path from the root without its extension, or undefined for a package. */
function target(file: string, specifier: string): string | undefined {
  if (specifier.startsWith("@/")) return specifier.slice(2).replace(/\.(ts|tsx|mts)$/, "");
  if (specifier.startsWith(".")) return normalize(join(dirname(file), specifier)).replace(/\.(ts|tsx|mts)$/, "");
  return undefined;
}

/** What `text`, the module at `path`, does that says where it runs. */
function facts(path: string, text: string) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  let readsEnv = false;
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const typesOnly =
        clause?.isTypeOnly ||
        (clause !== undefined &&
          !clause.name &&
          clause.namedBindings !== undefined &&
          ts.isNamedImports(clause.namedBindings) &&
          clause.namedBindings.elements.length > 0 &&
          clause.namedBindings.elements.every((element) => element.isTypeOnly));
      if (!typesOnly) imports.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push(node.arguments[0].text);
    } else if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "process" &&
      node.name.text === "env"
    ) {
      readsEnv = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const directive = source.statements[0];
  const said =
    directive && ts.isExpressionStatement(directive) && ts.isStringLiteral(directive.expression)
      ? directive.expression.text
      : undefined;
  return { imports, readsEnv, said };
}

/** Why the module at `path`, written `text`, is misnamed for where it runs: nothing if it isn't. */
export function misplaced(path: string, text: string): string[] {
  const name = basename(path);
  if (path.startsWith("app/") && NEXT_FILES.has(name.replace(/\.(ts|tsx)$/, ""))) return [];
  // Most modules mention none of it, and parsing every one is slow.
  if (!/\.(server|client)\./.test(name) && !/server-only|client-only|process\.env|\.server["']/.test(text)) return [];
  const { imports, readsEnv, said } = facts(path, text);
  if (said === "use server") return [];
  const server = /\.server\.(ts|tsx|mts)$/.test(name);
  const client = /\.client\.(ts|tsx|mts)$/.test(name);
  const component = name.endsWith(".tsx");
  const found: string[] = [];
  const marked = (marker: string) => imports.includes(marker);

  if (server && !marked("server-only")) found.push(`${path}: a .server module imports "server-only"`);
  if (!server && marked("server-only")) found.push(`${path}: imports "server-only", so it's named .server`);
  if (client && !marked("client-only") && !(component && said === "use client")) {
    found.push(`${path}: a .client module imports "client-only"`);
  }
  if (!client && marked("client-only")) found.push(`${path}: imports "client-only", so it's named .client`);

  if (!server && !component && !ANY_WHERE.some((where) => path.startsWith(where))) {
    if (readsEnv) found.push(`${path}: reads process.env, so it's named .server`);
    for (const specifier of imports) {
      const to = target(path, specifier);
      if (to && SERVER_ONLY_TARGET.test(to)) found.push(`${path}: imports ${to}, so it's named .server`);
    }
  }
  return found;
}

// Reading every module takes over Vitest's five seconds on a loaded CI runner.
describe("where code runs", { timeout: 60_000 }, () => {
  it("every module's name says where it runs", () => {
    const files = DIRS.flatMap((dir) => codeFiles(dir));
    expect(files.length).toBeGreaterThan(100);
    expect(files.flatMap((path) => misplaced(path, readFileSync(join(ROOT, path), "utf8")))).toEqual([]);
  });

  it("would spot a module named for the server that doesn't import server-only, and the other way", () => {
    expect(misplaced("lib/x.server.ts", `export const x = 1;`)).toEqual([
      `lib/x.server.ts: a .server module imports "server-only"`,
    ]);
    expect(misplaced("lib/x.ts", `import "server-only";\nexport const x = 1;`)).toEqual([
      `lib/x.ts: imports "server-only", so it's named .server`,
    ]);
    expect(misplaced("lib/x.server.ts", `import "server-only";\nexport const x = 1;`)).toEqual([]);
  });

  it("would spot a module named for the browser that doesn't import client-only, and the other way", () => {
    expect(misplaced("lib/x.client.ts", `export const x = () => window;`)).toEqual([
      `lib/x.client.ts: a .client module imports "client-only"`,
    ]);
    expect(misplaced("lib/x.ts", `import "client-only";\nexport const x = () => window;`)).toEqual([
      `lib/x.ts: imports "client-only", so it's named .client`,
    ]);
    expect(misplaced("lib/x.client.ts", `import "client-only";\nexport const x = () => window;`)).toEqual([]);
    // The gallery's examples with state: components.
    expect(misplaced("app/x/X.gallery.client.tsx", `"use client";\nexport const X = () => null;`)).toEqual([]);
  });

  it("would spot a module that can only run on the server but isn't named for it", () => {
    expect(misplaced("lib/x.ts", `export const x = () => process.env.SECRET;`)).toEqual([
      "lib/x.ts: reads process.env, so it's named .server",
    ]);
    expect(
      misplaced(
        "lib/supporters/x.ts",
        [
          `import { query } from "@/lib/server/db.server";`,
          `import { config } from "../server/config.server";`,
          `import { getEvents } from "@/lib/server/outside-services/luma-calendar.server";`,
          `export const x = [query, config, getEvents];`,
        ].join("\n"),
      ),
    ).toEqual([
      "lib/supporters/x.ts: imports lib/server/db.server, so it's named .server",
      "lib/supporters/x.ts: imports lib/server/config.server, so it's named .server",
      "lib/supporters/x.ts: imports lib/server/outside-services/luma-calendar.server, so it's named .server",
    ]);
    expect(misplaced("lib/x.ts", `const sql = await import("./server/sql.server");`)).toEqual([
      "lib/x.ts: imports lib/server/sql.server, so it's named .server",
    ]);
  });

  it("leaves out types, Next's own files, Server Actions, components and the fakes", () => {
    const database = `import { query } from "@/lib/server/db.server";\nexport const x = query;`;
    expect(misplaced("lib/x.ts", `import type { Row } from "@/lib/server/db.server";\nexport type X = Row;`)).toEqual(
      [],
    );
    expect(misplaced("lib/x.ts", `import { type Row } from "@/lib/server/db.server";\nexport type X = Row;`)).toEqual(
      [],
    );
    expect(misplaced("app/x/route.ts", database)).toEqual([]);
    expect(misplaced("app/x/actions.ts", `"use server";\n${database}`)).toEqual([]);
    expect(misplaced("components/X.tsx", database)).toEqual([]);
    expect(misplaced("lib/server/fixtures/x.ts", `export const dir = process.env.DIR;`)).toEqual([]);
    expect(misplaced("lib/now.ts", `export const fixed = process.env.FIXTURE_NOW;`)).toEqual([]);
  });
});
