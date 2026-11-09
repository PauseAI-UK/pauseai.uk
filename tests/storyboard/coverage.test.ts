import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// A mild check that the storyboard's reach is written down: docs/testing.md
// ("What the storyboard covers") names every spec file and every route
// handler, either with the flow that drives it or with why nothing does. A
// new route or section without a line there fails here. The pages need no
// line: public-pages.spec.ts loads every one in tests/routes.ts, and the
// staff section checks each staff page redirects to the login page.

const ROOT = join(__dirname, "..", "..");
const docs = readFileSync(join(ROOT, "docs", "testing.md"), "utf8");
const list = docs.slice(docs.indexOf("### What the storyboard covers"), docs.indexOf("## The database"));

/** The URL paths of every route handler under app/, e.g. "/api/signatories". */
function routeHandlers(dir = join(ROOT, "app"), base = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isFile()) return entry.name === "route.ts" ? [base || "/"] : [];
    const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
    return routeHandlers(join(dir, entry.name), isGroup ? base : `${base}/${entry.name}`);
  });
}

describe("what the storyboard covers", () => {
  it("is a section of docs/testing.md, a list", () => {
    expect(list).toContain("\n- `public-pages.spec.ts`: ");
  });

  it("names every route handler", () => {
    const handlers = routeHandlers();
    expect(handlers).toContain("/api/signatories");
    for (const route of handlers) expect(list, `${route} is missing from the list`).toContain(`\`${route}\``);
  });

  it("names every section", () => {
    const specs = readdirSync(__dirname).filter((f) => f.endsWith(".spec.ts"));
    expect(specs.length).toBeGreaterThan(5);
    for (const spec of specs)
      expect(list, `${relative(ROOT, join(__dirname, spec))} has no line of its own`).toContain(`\n- \`${spec}\`: `);
  });
});
