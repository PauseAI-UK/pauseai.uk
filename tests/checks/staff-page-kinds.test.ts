import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { PAGE_KINDS } from "@/lib/staff-page-kinds";
import { staffPageOf } from "@/lib/staff-sections";

// Every staff page is one of a few kinds, and starts the way its kind does
// (docs/style-guide.md, "Kinds of page"), so the pages can't each grow a
// head of their own. This fails on:
//
// - a page.tsx that doesn't return ui/Page, saying its kind;
// - a page under one of the navigation's that doesn't say where it is, or
//   says it's under a different page than the sidebar marks for it, and a
//   page the navigation leads to that has a trail;
// - an <h1> anywhere in the staff pages but the two heads, ui/PageHead and
//   ui/Band, and the few below with their reasons.
const ROOT = join(__dirname, "..", "..");
const STAFF = join(ROOT, "app", "(staff)", "staff");
const PAGES = join(STAFF, "(signed-in)");

/** Files with a title of their own, and why. A new one isn't added here without a reason. */
const OWN_TITLE: Record<string, string> = {
  "_components/ui/PageHead.tsx": "the head of every page but a record's",
  "_components/ui/Band.tsx": "the head of a record's page",
  "_components/DraftWriter.tsx": "a draft's title, which the bar held at the window's top repeats once it scrolls away",
  "_components/LoginCard.tsx": "the login page, which isn't one of the pages staff work in",
};

function files(dir: string, wanted: (name: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path, wanted);
    return wanted(entry.name) ? [path] : [];
  });
}

/** A page file's route: /staff/supporters/[id] for (signed-in)/supporters/[id]/page.tsx. */
function routeOf(file: string): string {
  const folders = relative(PAGES, file).split("\\").join("/").split("/").slice(0, -1);
  return ["/staff", ...folders].join("/");
}

/** What a page's default export returns, its brackets taken off. */
function returned(source: ts.SourceFile): ts.Expression | undefined {
  let found: ts.Expression | undefined;
  const isDefault = (node: ts.Node) =>
    ts.isFunctionDeclaration(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);
  const visit = (node: ts.Node) => {
    if (ts.isReturnStatement(node) && node.expression) found = node.expression;
    else if (!ts.isFunctionLike(node)) ts.forEachChild(node, visit);
  };
  source.forEachChild((node) => {
    if (isDefault(node)) (node as ts.FunctionDeclaration).body!.forEachChild(visit);
  });
  while (found && ts.isParenthesizedExpression(found)) found = found.expression;
  return found;
}

/** An element's attributes: a string's value, and "{…}" for anything worked out. */
function attributes(element: ts.JsxOpeningLikeElement): Record<string, string> {
  const said: Record<string, string> = {};
  for (const attribute of element.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue;
    const value = attribute.initializer;
    said[attribute.name.getText()] = value && ts.isStringLiteral(value) ? value.text : "{…}";
  }
  return said;
}

/** What's wrong with how a page says its kind and where it is: nothing, for a page that says both rightly. */
function problems(route: string, text: string): string[] {
  const source = ts.createSourceFile("page.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const root = returned(source);
  const opening = root && ts.isJsxElement(root) ? root.openingElement : undefined;
  if (!opening || opening.tagName.getText() !== "Page") return ["doesn't return <Page>"];
  const { kind, under, here } = attributes(opening);
  const wrong: string[] = [];
  if (!(PAGE_KINDS as readonly string[]).includes(kind)) wrong.push(`kind="${kind}" isn't a kind of page`);
  const nav = staffPageOf(route);
  if (!nav || nav.href === route) {
    if (under) wrong.push("has a trail, though the navigation leads to it");
  } else if (under !== nav.id || !here) {
    wrong.push(`should say under="${nav.id}", as the sidebar marks it, and here`);
  }
  return wrong;
}

describe("the kinds of staff page", () => {
  it("has every page say its kind, and where it is under the navigation's pages", () => {
    const pages = files(PAGES, (name) => name === "page.tsx");
    expect(pages.length).toBeGreaterThan(30);
    const wrong = pages.flatMap((file) =>
      problems(routeOf(file), readFileSync(file, "utf8")).map((problem) => `${relative(ROOT, file)} ${problem}`),
    );
    expect(wrong).toEqual([]);
  });

  it("leaves a page's title to the two heads", () => {
    const own = files(STAFF, (name) => name.endsWith(".tsx") && !name.includes(".test."))
      .filter((file) => /<h1[\s>]/.test(readFileSync(file, "utf8")))
      .map((file) => relative(STAFF, file).split("\\").join("/"));
    expect(own.sort()).toEqual(Object.keys(OWN_TITLE).sort());
  });

  it("works out a page's route from its file", () => {
    expect(routeOf(join(PAGES, "page.tsx"))).toBe("/staff");
    expect(routeOf(join(PAGES, "supporters", "[id]", "erase", "page.tsx"))).toBe("/staff/supporters/[id]/erase");
  });

  const page = (jsx: string) =>
    `export default async function A() {\n  const b = () => { return 1; };\n  return (${jsx});\n}`;

  it("passes a page the navigation leads to that says its kind, and one under it that says where it is", () => {
    expect(problems("/staff/supporters", page(`<Page kind="list"><Table /></Page>`))).toEqual([]);
    expect(problems("/staff/me", page(`<Page kind="board"><Sessions /></Page>`))).toEqual([]);
    expect(
      problems("/staff/letters/[id]", page(`<Page kind="item" under="campaigns" via={[one]} here={title}>x</Page>`)),
    ).toEqual([]);
  });

  it("fails a page that returns something else, or no kind there is", () => {
    expect(problems("/staff/supporters", page(`<><h1>Supporters</h1></>`))).toEqual(["doesn't return <Page>"]);
    expect(problems("/staff/supporters", page(`<Table />`))).toEqual(["doesn't return <Page>"]);
    expect(problems("/staff/supporters", `export default function A() {}`)).toEqual(["doesn't return <Page>"]);
    expect(problems("/staff/supporters", page(`<Page kind="table">x</Page>`))).toEqual([
      `kind="table" isn't a kind of page`,
    ]);
    expect(problems("/staff/supporters", page(`<Page kind={kind}>x</Page>`))).toEqual([
      `kind="{…}" isn't a kind of page`,
    ]);
    expect(problems("/staff/supporters", page(`<Page {...props}>x</Page>`))).toEqual([
      `kind="undefined" isn't a kind of page`,
    ]);
  });

  it("fails a trail on a page the navigation leads to, and a missing or mismatched one under it", () => {
    expect(problems("/staff/supporters", page(`<Page kind="list" under="supporters" here="x">x</Page>`))).toEqual([
      "has a trail, though the navigation leads to it",
    ]);
    const should = [`should say under="campaigns", as the sidebar marks it, and here`];
    expect(problems("/staff/letters/[id]", page(`<Page kind="item">x</Page>`))).toEqual(should);
    expect(problems("/staff/letters/[id]", page(`<Page kind="item" under="supporters" here="x">x</Page>`))).toEqual(
      should,
    );
    expect(problems("/staff/letters/[id]", page(`<Page kind="item" under="campaigns">x</Page>`))).toEqual(should);
  });
});
