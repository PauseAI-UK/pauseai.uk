import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { featureLibFolders } from "../../eslint.config.mjs";

// An error that's caught is rethrown or reported with problem()
// (lib/server/problems.server.ts), so that carrying on past it leaves a record on
// the run, or at least in the log. This fails on any catch block, or
// function passed to .catch(), that does neither, or has a way out (break,
// continue, return) ahead of its report, as an early exit for one kind of
// error skips it; in the code where jobs and requests run: lib/server, each
// feature's folder of logic, app/api and netlify/functions. A named handler
// passed to .catch() is read too, so one that rethrows all but one error
// passes. The exceptions below are the few places that catch to answer a
// question ("is there a request?") rather than to carry on past a failure.

const ROOT = join(__dirname, "..", "..");
const DIRS = ["lib/server", ...featureLibFolders(), "app/api", "netlify/functions"];

/** The catches that aren't losing anything, as "file  function", with why. */
const EXCEPTIONS = new Map([
  // Asking Next for the request's cookies throws outside a request: the catch is the question.
  ["lib/server/flow-database.server.ts  flowDatabase", "outside a request there's no cookie, and nothing to report"],
  // A development-only warning about migrations: the query after it reports the database being down.
  ["lib/server/db.server.ts  warnIfBehind", "the query that follows reports the database being unreachable"],
  // "Not JSON" is an answer, not a failure: the one place that swallows the parse error.
  ["lib/server/json.server.ts  parseJsonIfAny", "a body that isn't JSON is an answer the caller asked for"],
  // The tests' reader of a fixture build's outbox: one not made yet holds no emails.
  ["lib/server/fixtures/outbox.ts  readOutbox", "an outbox that isn't there yet has no emails in it"],
  ["lib/server/fixtures/whatsapp-outbox.ts  readTexts", "an outbox that isn't there yet has no texts in it"],
  // Asking Next to wait for work after the response throws outside a request: the work is already going.
  [
    "lib/oversight/errors-seen.server.ts  heldOpen",
    "outside a request there's nothing to hold open, and the work goes on",
  ],
  // Gmail's history of a mailbox expires: the read searches instead, and its run says it restarted.
  [
    "lib/server/outside-services/gmail.server.ts  gmailHistory",
    "history gone is an answer: the read searches, and says so",
  ],
  // Postmark refusing a suppressed address is kept as that address blocked, which staff see.
  ["lib/email/email.server.ts  sendWith", "a suppressed address is recorded as blocked, its own report"],
  // A file that isn't UTF-8 is read as Windows-1252, as spreadsheets save it: the catch is the question.
  ["lib/supporters/signup-csv.ts  signupFileText", "a file that isn't UTF-8 is an answer: it's read as Windows-1252"],
  // What's typed as a link that the URL parser refuses is no link: the catch is the question.
  ["lib/letters/format.ts  linkHref", "text that isn't a web address is an answer: it's no link"],
]);

/**
 * Handlers passed to .catch() whose way out ahead of their throw is an
 * answer, not a failure, with why: they rethrow all else.
 */
const ANSWERING_HANDLERS = new Map([["unlessGone", "a message deleted since is gone, not a failure"]]);

function codeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return codeFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Whether `node` is, or has in it, a throw or a call to problem(). */
function reports(node: ts.Node): boolean {
  if (ts.isThrowStatement(node)) return true;
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "problem") return true;
  return ts.forEachChild(node, reports) ?? false;
}

/**
 * The ways out of a catch's block, or a handler's, that come before any report
 * in it: a break, continue or return that doesn't report, ahead of the first
 * throw or problem(). Those skip the report, as an early exit for one kind of
 * error would. Nested functions are their own.
 */
function exitsBeforeReport(body: ts.Node): ts.Node[] {
  let reported = false;
  const exits: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (reported || ts.isFunctionLike(node)) return;
    if (ts.isBreakStatement(node) || ts.isContinueStatement(node) || ts.isReturnStatement(node)) {
      if (reports(node)) reported = true;
      else exits.push(node);
      return;
    }
    if (ts.isThrowStatement(node) || (ts.isCallExpression(node) && reports(node) && !ts.forEachChild(node, reports))) {
      reported = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(body, visit);
  return exits;
}

/** Whether a catch's block, or a handler, rethrows or reports, with no way out ahead of it. */
function handles(node: ts.Node): boolean {
  return reports(node) && exitsBeforeReport(node).length === 0;
}

/** The name of the function `node` is in, for naming a hit. */
function enclosingFunction(node: ts.Node): string {
  for (let up: ts.Node | undefined = node; up; up = up.parent) {
    if ((ts.isFunctionDeclaration(up) || ts.isMethodDeclaration(up)) && up.name) return up.name.getText();
    if (ts.isVariableDeclaration(up) && ts.isIdentifier(up.name)) return up.name.text;
  }
  return "(top level)";
}

type Hit = { file: string; what: string; line: number; fn: string };

/** Every function declared by name across the files, for a named handler passed to .catch(). */
function declaredFunctions(sources: ts.SourceFile[]): Map<string, ts.Node> {
  const found = new Map<string, ts.Node>();
  for (const source of sources) {
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name && node.body) found.set(node.name.text, node.body);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

/** Every catch that neither rethrows nor reports, in `sources`. */
export function unhandledCatches(sources: ts.SourceFile[]): Hit[] {
  const named = declaredFunctions(sources);
  const hits: Hit[] = [];
  for (const source of sources) {
    const hit = (node: ts.Node, what: string) =>
      hits.push({
        file: source.fileName,
        what,
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        fn: enclosingFunction(node),
      });
    const visit = (node: ts.Node) => {
      if (ts.isCatchClause(node) && !handles(node.block)) hit(node, "catch");
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "catch" &&
        node.arguments.length === 1
      ) {
        const [handler] = node.arguments;
        const body = ts.isIdentifier(handler) ? named.get(handler.text) : handler;
        const answers = ts.isIdentifier(handler) && ANSWERING_HANDLERS.has(handler.text);
        if (!body || !(answers ? reports(body) : handles(body)))
          hit(node, `.catch(${ts.isIdentifier(handler) ? handler.text : "…"})`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return hits;
}

function parse(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

describe("caught errors", () => {
  it("finds a catch that swallows, and lets through one that rethrows, reports, or hands to a handler that does", () => {
    const code = `
      function unlessGone(error) { if (error.status === 404) return undefined; throw error; }
      function swallows(error) { return undefined; }
      async function a() {
        try { x(); } catch { return 1; }
        try { x(); } catch (e) { if (!(e instanceof Y)) throw e; }
        try { x(); } catch (e) { problem("It broke", e); }
        try { x(); } catch (e) { log(e); }
        for (;;) { try { x(); } catch (e) { if (e.soon) break; problem("It broke", e); } }
        try { x(); } catch (e) { problem("It broke", e); if (e.soon) return 2; }
        try { x(); } catch (e) { if (e.gone) return problem("Gone", e); throw e; }
        await y().catch(unlessGone);
        await y().catch(swallows);
        await y().catch(() => null);
        await y().catch((e) => problem("Nope", e));
        await y().catch((e) => { throw new Z(e); });
      }`;
    const hits = unhandledCatches([parse("a.ts", code)]);
    expect(hits.map((h) => `${h.what}@${h.line} in ${h.fn}`)).toEqual([
      "catch@5 in a",
      "catch@8 in a",
      "catch@9 in a",
      ".catch(swallows)@13 in a",
      ".catch(…)@14 in a",
    ]);
  });

  it("names the method or arrow function a catch is in, or the top level", () => {
    const code = `
      class C { async m() { try { x(); } catch { return 1; } } }
      const f = async () => { try { x(); } catch { return 1; } };
      try { x(); } catch { }`;
    expect(unhandledCatches([parse("b.ts", code)]).map((h) => h.fn)).toEqual(["m", "f", "(top level)"]);
  });

  it("every catch where jobs and requests run rethrows or reports, but for the few that answer a question", () => {
    const sources = DIRS.flatMap((dir) => codeFiles(join(ROOT, dir))).map((path) =>
      parse(relative(ROOT, path), readFileSync(path, "utf8")),
    );
    const hits = unhandledCatches(sources).map((h) => `${h.file}  ${h.fn}`);
    const unexplained = hits.filter((hit) => !EXCEPTIONS.has(hit));
    expect(unexplained, "rethrow the error, or report it with problem()").toEqual([]);
    // An exception that no longer catches anything is one to delete.
    expect([...EXCEPTIONS.keys()].filter((key) => !hits.includes(key))).toEqual([]);
  });
});
