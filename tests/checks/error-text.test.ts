import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parse, serverSources } from "./server-code";

// What to do about an error is decided by what kind it is, never by its
// words: an outside service's failure says its kind and its own code in
// fields (OutsideFailure, lib/server/outside-services/outside-failure.server.ts),
// so a service rewording a message can't send the code down the wrong path.
// This fails on a caught error's `.message` or `.name` being read, and on
// `as Error`, which is how one gets read without a check, in the code where
// jobs and requests run (server-code.ts). A service's own binding may read
// what the service said, to set those fields, and describeError() reads an
// error's words to say them.

/** Where an error's words may be read: the outside services' bindings, and what says an error in words. */
const MAY_READ = /^lib\/server\/outside-services\/|^lib\/server\/problems\.server\.ts$/;

/** The properties that are an error's words. */
const WORDS = ["message", "name"];

type Hit = { what: string; line: number };

/** The name a catch clause, or a function handed to .catch(), gives what it caught, if it names it. */
function caughtName(node: ts.Node): string | undefined {
  if (ts.isCatchClause(node)) {
    const name = node.variableDeclaration?.name;
    return name && ts.isIdentifier(name) ? name.text : undefined;
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "catch"
  ) {
    const [handler] = node.arguments;
    const name = handler && ts.isFunctionLike(handler) ? handler.parameters[0]?.name : undefined;
    return name && ts.isIdentifier(name) ? name.text : undefined;
  }
  return undefined;
}

/** Every read of a caught error's words in `source`, and every `as Error`. */
export function wordsRead(source: ts.SourceFile): Hit[] {
  const found: Hit[] = [];
  const hit = (node: ts.Node, what: string) =>
    found.push({ what, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
  const visit = (node: ts.Node, caught: readonly string[]) => {
    if (ts.isAsExpression(node) && node.type.getText(source) === "Error") hit(node, "as Error");
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      caught.includes(node.expression.text) &&
      WORDS.includes(node.name.text)
    ) {
      hit(node, `${node.expression.text}.${node.name.text}`);
    }
    const name = caughtName(node);
    ts.forEachChild(node, (child) => visit(child, name ? [...caught, name] : caught));
  };
  visit(source, []);
  return found;
}

// Parsing every server file takes a busy CI runner more than the default 5s.
describe("an error's words", { timeout: 60_000 }, () => {
  it("finds a caught error's message or name being read, and `as Error`, and lets the rest through", () => {
    const code = `
      try { x(); } catch (error) {
        if (error.message.includes("quota")) retry();
        if (error instanceof OutsideFailure && error.kind === "rate-limited") retry();
        problem(said(), error);
      }
      try { x(); } catch { later(); }
      try { x(); } catch ({ code }) { later(code); }
      await y().catch((e) => e.name === "TimeoutError");
      await y().catch(handler);
      await y().catch(() => null);
      const text = (thrown as Error).message;
      const name = person.name, message = email.message;
      const error = { message: "not caught" }; error.message;`;
    expect(wordsRead(parse("a.ts", code)).map((h) => `${h.what}@${h.line}`)).toEqual([
      "error.message@3",
      "e.name@9",
      "as Error@12",
    ]);
  });

  it("nothing where jobs and requests run decides by an error's words", () => {
    const hits = serverSources()
      .filter((source) => !MAY_READ.test(source.fileName))
      .flatMap((source) => wordsRead(source).map((h) => `${source.fileName}:${h.line}  ${h.what}`));
    expect(
      hits,
      "ask what kind of failure it was (OutsideFailure's kind, status and serviceCode), having its binding set a field if it says so only in words; to keep an error's words, problem() or keptError()",
    ).toEqual([]);
  });
});
