import ts from "typescript";
import { describe, expect, it } from "vitest";
import { isAppServerFile, parse, serverSources } from "./server-code";

// Something going wrong is reported with problem() (lib/server/problems.server.ts),
// which keeps it, never only written to the log, where nobody looks. ESLint
// keeps console itself out of the site's code (CONSOLE_RULE in
// eslint.config.mjs), so what's left is note(), the log's one way in, and
// String(error), which drops the error's cause, so a network failure is kept
// as "fetch failed" and nothing more; problem() and describeError() keep it.
// This fails on a note() handed an error, and on String(error), in the code
// where jobs and requests run (server-code.ts), other than problems.server.ts
// itself. The exceptions below are the few failures that are only noted, each
// with why.

const HELPER = "lib/server/problems.server.ts";

/** Names an error is usually caught as. */
const ERROR_NAMES = /^(e|err|error|cause|reason)$/;

/** The failures that are only noted, as "file  function", with why nobody need be told. */
const ONLY_NOTED = new Map([
  [
    "lib/supporters/email-settings.server.ts  offCalendarNow",
    "the Luma import's next pass tries again within the hour, and reports it if that fails too",
  ],
  ["lib/server/db.server.ts  getPool", "the pool opens another connection, and the next query carries on"],
]);

/** The name of the function `node` is in, for naming a hit. */
function enclosingFunction(node: ts.Node): string {
  for (let up: ts.Node | undefined = node; up; up = up.parent) {
    if (ts.isFunctionDeclaration(up) && up.name) return up.name.text;
  }
  return "(top level)";
}

/** Whether `node` is an error by its name, or describeError() of one. */
function isError(node: ts.Node): boolean {
  if (ts.isIdentifier(node)) return ERROR_NAMES.test(node.text);
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "describeError";
}

type Hit = { what: string; line: number; fn: string };

/** Every note() handed an error, and every String(error), in `source`. */
export function handWrittenReports(source: ts.SourceFile): Hit[] {
  const found: Hit[] = [];
  const hit = (node: ts.Node, what: string) =>
    found.push({
      what,
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      fn: enclosingFunction(node),
    });
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const [first] = node.arguments;
      if (node.expression.text === "note" && node.arguments.some(isError)) hit(node, "note(error)");
      if (
        node.expression.text === "String" &&
        node.arguments.length === 1 &&
        ts.isIdentifier(first) &&
        ERROR_NAMES.test(first.text)
      ) {
        hit(node, `String(${first.text})`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

// Parsing every server file takes about a second alone, and past the 5s default beside the gate's other checks.
describe("problem reporting", { timeout: 60_000 }, () => {
  it("finds a note() handed an error and String(error), and lets other notes and strings through", () => {
    const code = `
      note("Nothing to record");
      note("y", count);
      function quiet() { note("It broke", describeError(error)); }
      note("It broke", e);
      const a = String(error), b = String(err), c = String(reason);
      const d = String(42), f = String(name);
      problem("It broke", error);`;
    expect(handWrittenReports(parse("a.ts", code)).map((h) => `${h.what}@${h.line} in ${h.fn}`)).toEqual([
      "note(error)@4 in quiet",
      "note(error)@5 in (top level)",
      "String(error)@6 in (top level)",
      "String(err)@6 in (top level)",
      "String(reason)@6 in (top level)",
    ]);
  });

  it("knows the server's files under app/ by their name or their directive", () => {
    expect(isAppServerFile("app/api/x/route.ts", "")).toBe(true);
    expect(isAppServerFile("app/(staff)/staff/page.tsx", "")).toBe(true);
    expect(isAppServerFile("app/(staff)/layout.tsx", "")).toBe(true);
    expect(isAppServerFile("app/x/mp-letters.server.ts", "")).toBe(true);
    expect(isAppServerFile("app/x/actions.ts", '"use server";\n')).toBe(true);
    expect(isAppServerFile("app/x/Form.tsx", '"use client";\n')).toBe(false);
    expect(isAppServerFile("app/x/draft.client.ts", "")).toBe(false);
  });

  it("nothing where jobs and requests run only notes an error, or loses its cause", () => {
    const hits = serverSources()
      .filter((source) => source.fileName !== HELPER)
      .flatMap((source) =>
        handWrittenReports(source).map((hit) =>
          hit.what === "note(error)" ? `${source.fileName}  ${hit.fn}` : `${source.fileName}  ${hit.what}@${hit.line}`,
        ),
      );
    const unexplained = hits.filter((hit) => !ONLY_NOTED.has(hit));
    expect(
      unexplained,
      "report it with problem(), which keeps it, or keep it in a column with keptError(); note() is for what isn't a failure",
    ).toEqual([]);
    // An exception that no longer notes an error is one to delete.
    expect([...ONLY_NOTED.keys()].filter((key) => !hits.includes(key))).toEqual([]);
  });
});
