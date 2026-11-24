import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parse, siteSources } from "./server-code";

// A problem is one a feature has declared (defineProblems in lib/problems.ts),
// so it has a code, which a run's alert knows it by, and values that the
// types keep free of names and addresses. This holds what the types can't:
// that two features don't declare under one name, so no two problems share a
// code; that each declared problem is reported somewhere, so the list of
// what can go wrong stays true; and that only the files still to declare
// theirs report a sentence written in place.

/**
 * The files that still report with problemInWords(). One leaves this list as
 * its feature declares its problems, and none joins it.
 */
const UNDECLARED = [
  "app/(staff)/staff/api/gmail/callback/route.ts",
  "app/api/luma/webhook/route.ts",
  "app/api/whatsapp/route.ts",
  "lib/broadcasts/answers.server.ts",
  "lib/broadcasts/channels.server.ts",
  "lib/broadcasts/drafts.server.ts",
  "lib/broadcasts/sending.server.ts",
  "lib/broadcasts/whatsapp-templates.server.ts",
  "lib/broadcasts/whatsapp-webhooks.server.ts",
  "lib/email/email.server.ts",
  "lib/email/gmail-accounts.server.ts",
  "lib/email/notifications.server.ts",
  "lib/erasure/erase.server.ts",
  "lib/events/luma-import.server.ts",
  "lib/events/tagging.server.ts",
  "lib/jobs/civicrm-import.server.ts",
  "lib/jobs/controlai-statement-import.server.ts",
  "lib/jobs/edm-import.server.ts",
  "lib/jobs/gmail-reading.server.ts",
  "lib/politicians/aliases.server.ts",
  "lib/politicians/find-mp.server.ts",
  "lib/politicians/imports.server.ts",
  "lib/supporters/civicrm-updates.server.ts",
  "lib/supporters/email-settings.server.ts",
  "lib/supporters/places.server.ts",
];

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

/** Whether `source` imports problemInWords. */
export function reportsInWords(source: ts.SourceFile): boolean {
  return source.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      statement.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some((element) => element.name.text === "problemInWords"),
  );
}

// Parsing every file of the site takes a busy CI runner more than the default 5s.
describe("declared problems", { timeout: 60_000 }, () => {
  it("reads a feature's declaration, the problems called, and an import of problemInWords", () => {
    const source = parse(
      "a.ts",
      `import { note, problemInWords } from "@/lib/server/problems.server";
       export const letterProblems = defineProblems("letters", {
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
    expect(reportsInWords(source)).toBe(true);
    expect(reportsInWords(parse("b.ts", `import { problem } from "x"; import y from "y"; import "z";`))).toBe(false);
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

  it("only the files still to declare their problems report a sentence written in place", () => {
    const inWords = siteSources()
      .filter((source) => source.fileName !== "lib/server/problems.server.ts" && reportsInWords(source))
      .map((source) => source.fileName);
    expect(
      inWords.filter((file) => !UNDECLARED.includes(file)),
      "declare the problem in the feature's copy file with defineProblems() (lib/problems.ts) and report it with problem()",
    ).toEqual([]);
    // A file that has declared its problems is one to take off the list.
    expect(UNDECLARED.filter((file) => !inWords.includes(file))).toEqual([]);
  });
});
