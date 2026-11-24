import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parse, siteSources } from "./server-code";

// A problem is one a feature has declared (defineProblems in lib/problems.ts),
// so it has a code, which a run's alert knows it by, and values that the
// types keep free of names and addresses. This holds what the types can't:
// that two features don't declare under one name, so no two problems share a
// code; and that each declared problem is reported somewhere, so the list of
// what can go wrong stays true.

type Declaration = { feature: string; name: string; problems: string[] };

/** Each `const name = defineProblems("feature", { … })` in `source`, with the problems it declares. */
export function declarations(source: ts.SourceFile): Declaration[] {
  const found: Declaration[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "defineProblems"
    ) {
      const [feature, sentences] = node.initializer.arguments;
      if (ts.isStringLiteral(feature) && ts.isObjectLiteralExpression(sentences)) {
        found.push({
          feature: feature.text,
          name: node.name.text,
          problems: sentences.properties.map((property) => property.name!.getText(source)),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Every `object.property` that's called in `source`, as "object.property". */
export function calls(source: ts.SourceFile): Set<string> {
  const found = new Set<string>();
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression)
    ) {
      found.add(`${node.expression.expression.text}.${node.expression.name.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

// Parsing every file of the site takes a busy CI runner more than the default 5s.
describe("declared problems", { timeout: 60_000 }, () => {
  it("reads a feature's declaration and the problems called", () => {
    const source = parse(
      "a.ts",
      `export const letterProblems = defineProblems("letters", {
         noInbox: "Nobody was emailed",
         notSent: (p: { letter: number }) => \`Letter \${p.letter}\`,
       });
       const other = define("x", {});
       problem(letterProblems.notSent({ letter: 1 }), error);
       letterProblems.noInbox;
       plain();`,
    );
    expect(declarations(source)).toEqual([
      { feature: "letters", name: "letterProblems", problems: ["noInbox", "notSent"] },
    ]);
    expect([...calls(source)]).toEqual(["letterProblems.notSent"]);
  });

  it("no two features declare under one name, and every declared problem is reported somewhere", () => {
    const sources = siteSources();
    const declared = sources.flatMap(declarations);
    const features = declared.map(({ feature }) => feature);
    expect(
      features.filter((feature, at) => features.indexOf(feature) !== at),
      "a problem's code is its feature's name and its own, so two declarations under one name could clash",
    ).toEqual([]);
    const called = new Set(sources.flatMap((source) => [...calls(source)]));
    const unused = declared.flatMap(({ name, problems }) =>
      problems.map((problem) => `${name}.${problem}`).filter((problem) => !called.has(problem)),
    );
    expect(unused, "a problem nothing reports is one to delete from its feature's defineProblems()").toEqual([]);
  });
});
