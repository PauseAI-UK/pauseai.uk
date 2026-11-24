import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parse, serverSources } from "./server-code";

// An error that's caught is rethrown or reported, so that carrying on past
// it leaves a record: with problem() (lib/server/problems.server.ts), on the
// run or as an error, or with keepCaught() (lib/oversight/errors-seen.server.ts),
// as the error Next would have kept had it been thrown. This fails on any
// catch block, or function passed to .catch(), that does neither, or has a
// way out (break, continue, return) ahead of its report, as an early exit
// for one kind of error skips it; in the code where jobs and requests run
// (server-code.ts). A named handler passed to .catch() is read too, so one
// that rethrows all but one error passes. The exceptions below are the few
// places that catch to answer a question ("is there a request?") rather
// than to carry on past a failure.

/** The functions that report a caught error. */
const REPORTERS = ["problem", "keepCaught"];

/** The catches that aren't losing anything, as "file  function", with why. */
const EXCEPTIONS = new Map([
  // Asking Next for the request's cookies throws outside a request: the catch is the question.
  ["lib/server/flow-database.server.ts  flowDatabase", "outside a request there's no cookie, and nothing to report"],
  // A development-only warning about migrations: the query after it reports the database being down.
  ["lib/server/db.server.ts  warnIfBehind", "the query that follows reports the database being unreachable"],
  // "Not JSON" and "not a form" are answers, not failures: the one place that swallows the parse error.
  ["lib/server/json.server.ts  parseJsonIfAny", "a body that isn't JSON is an answer the caller asked for"],
  ["lib/server/json.server.ts  readFormIfAny", "a body that isn't a form is an answer the caller asked for"],
  // The tests' reader of a fixture build's outbox: one not made yet holds no emails.
  ["lib/server/fixtures/outbox.ts  readOutbox", "an outbox that isn't there yet has no emails in it"],
  ["lib/server/fixtures/whatsapp-outbox.ts  readTexts", "an outbox that isn't there yet has no texts in it"],
  // Asking Next to wait for work after the response throws outside a request: the work is already going.
  [
    "lib/oversight/errors-seen.server.ts  heldOpen",
    "outside a request there's nothing to hold open, and the work goes on",
  ],
  // The same for a staff request's timing, logged after its response: outside a request there's none to time.
  ["lib/server/request-timing.server.ts  logTiming", "outside a request there's no response to time, nor to log"],
  // Gmail's history of a mailbox expires: the read searches instead, and its run says it restarted.
  [
    "lib/server/outside-services/gmail.server.ts  gmailHistory",
    "history gone is an answer: the read searches, and says so",
  ],
  // Luma failing to take someone off the calendar as they opt out: the next full pass over its contacts retries and reports.
  [
    "lib/supporters/email-settings.server.ts  offCalendarNow",
    "the Luma import's next pass tries again, and reports it if that fails too",
  ],
  // Postmark refusing a suppressed address is kept as that address blocked, which staff see.
  ["lib/email/email.server.ts  sendWith", "a suppressed address is recorded as blocked, its own report"],
  // A file that isn't UTF-8 is read as Windows-1252, as spreadsheets save it: the catch is the question.
  ["lib/supporters/signup-csv.ts  signupFileText", "a file that isn't UTF-8 is an answer: it's read as Windows-1252"],
  // What's typed as a link that the URL parser refuses is no link: the catch is the question.
  ["lib/letters/format.ts  linkHref", "text that isn't a web address is an answer: it's no link"],
  // A page a text links to that can't be reached gets no card, in WhatsApp as in the preview: the catch is the question.
  [
    "lib/server/outside-services/link-pages.server.ts  linkCard",
    "a page that can't be reached is an answer: its link has no card",
  ],
  // CiviCRM's refusal that isn't JSON is said as it came: the catch is the question.
  [
    "lib/server/outside-services/civicrm.server.ts  said",
    "an answer that isn't JSON is an answer: it's said as it came",
  ],
]);

/**
 * The files with a catch of their own. Most code needs none: what carries
 * on without an outside service uses orFallback()
 * (lib/server/outside-services/fallback.server.ts), sending something uses
 * sendWithCare() (lib/email/send-with-care.server.ts), and anything else is
 * thrown, and kept as an error. A file leaves this list when its last catch
 * goes. One joins it only with a comment here saying why no helper fits.
 */
const OWN_CATCHES = [
  "app/(staff)/staff/_components/jobs/actions.ts",
  "app/(staff)/staff/api/gmail/callback/route.ts",
  // Logging in with Google: when Google refuses the code, or the live site
  // can't sign a preview's login, the person is sent back to the login page
  // to try again, which is no fallback's value and no send, and the failure
  // is reported as a problem.
  "app/(staff)/staff/api/google/callback/route.ts",
  "app/api/email-your-mp/letters/mp-letters.server.ts",
  "app/api/luma/webhook/route.ts",
  "app/api/signatories/route.ts",
  "app/api/whatsapp/route.ts",
  "lib/broadcasts/channels.server.ts",
  "lib/broadcasts/drafts.server.ts",
  "lib/broadcasts/sending.server.ts",
  "lib/broadcasts/whatsapp-webhooks.server.ts",
  "lib/email/email.server.ts",
  "lib/email/gmail-accounts.server.ts",
  "lib/email/send-with-care.server.ts",
  "lib/erasure/erase.server.ts",
  "lib/events/luma-import.server.ts",
  "lib/events/tagging.server.ts",
  "lib/jobs/gmail-reading.server.ts",
  "lib/letters/format.ts",
  "lib/letters/letters-inbox-reading.server.ts",
  "lib/letters/one-off-emails.server.ts",
  "lib/oversight/errors-seen.server.ts",
  "lib/politicians/aliases.server.ts",
  "lib/politicians/find-mp.server.ts",
  "lib/server/db.server.ts",
  "lib/server/fixtures/outbox.ts",
  "lib/server/fixtures/whatsapp-outbox.ts",
  "lib/server/flow-database.server.ts",
  // Asking Next to log after the response throws outside a request, where there's nothing to log: no helper asks.
  "lib/server/request-timing.server.ts",
  "lib/server/import-runs.server.ts",
  "lib/server/json.server.ts",
  "lib/server/outside-services/civicrm.server.ts",
  "lib/server/outside-services/fallback.server.ts",
  "lib/server/outside-services/gmail.server.ts",
  "lib/server/outside-services/link-pages.server.ts",
  "lib/server/outside-services/luma-calendar.server.ts",
  "lib/server/outside-services/luma-guests.server.ts",
  "lib/server/outside-services/outside-failure.server.ts",
  "lib/server/outside-services/outside-fetch.server.ts",
  "lib/server/outside-services/whatsapp.server.ts",
  "lib/supporters/civicrm-updates.server.ts",
  "lib/supporters/email-settings.server.ts",
  "lib/supporters/places.server.ts",
  "lib/supporters/signup-csv.ts",
];

/**
 * Handlers passed to .catch() whose way out ahead of their throw is an
 * answer, not a failure, with why: they rethrow all else.
 */
const ANSWERING_HANDLERS = new Map([["unlessGone", "a message deleted since is gone, not a failure"]]);

/** Whether `node` is, or has in it, a throw or a call to a reporter. */
function reports(node: ts.Node): boolean {
  if (ts.isThrowStatement(node)) return true;
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && REPORTERS.includes(node.expression.text))
    return true;
  return ts.forEachChild(node, reports) ?? false;
}

/**
 * The ways out of a catch's block, or a handler's, that come before any report
 * in it: a break, continue or return that doesn't report, ahead of the first
 * throw or reporter. Those skip the report, as an early exit for one kind of
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

/** Whether `source` has a catch of its own: a catch clause, or a function handed to .catch(). */
export function hasCatch(source: ts.SourceFile): boolean {
  const visit = (node: ts.Node): boolean =>
    ts.isCatchClause(node) ||
    (ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "catch") ||
    (ts.forEachChild(node, visit) ?? false);
  return visit(source);
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
        try { x(); } catch (e) { await keepCaught(e, "/staff"); }
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
      ".catch(swallows)@14 in a",
      ".catch(…)@15 in a",
    ]);
  });

  it("knows a file with a catch of its own from one without", () => {
    expect(hasCatch(parse("a.ts", "try { x(); } catch (e) { throw e; }"))).toBe(true);
    expect(hasCatch(parse("b.ts", "await y().catch(unlessGone);"))).toBe(true);
    expect(hasCatch(parse("c.ts", "const all = await orFallback(said(), [], () => list());"))).toBe(false);
  });

  it(
    "a new catch where jobs and requests run goes through a helper, or its file is listed with why",
    { timeout: 60_000 },
    () => {
      const files = serverSources()
        .filter(hasCatch)
        .map((source) => source.fileName);
      expect(
        files.filter((file) => !OWN_CATCHES.includes(file)),
        "carry on without an outside service with orFallback() (lib/server/outside-services/fallback.server.ts), send with sendWithCare() (lib/email/send-with-care.server.ts), or let the error be thrown; if none fits, list the file in OWN_CATCHES with why",
      ).toEqual([]);
      // A file whose last catch has gone is one to take off the list.
      expect(OWN_CATCHES.filter((file) => !files.includes(file))).toEqual([]);
    },
  );

  it("names the method or arrow function a catch is in, or the top level", () => {
    const code = `
      class C { async m() { try { x(); } catch { return 1; } } }
      const f = async () => { try { x(); } catch { return 1; } };
      try { x(); } catch { }`;
    expect(unhandledCatches([parse("b.ts", code)]).map((h) => h.fn)).toEqual(["m", "f", "(top level)"]);
  });

  // It parses every file where jobs and requests run, which takes a busy CI runner more than the default 5s.
  it(
    "every catch where jobs and requests run rethrows or reports, but for the few that answer a question",
    { timeout: 60_000 },
    () => {
      const hits = unhandledCatches(serverSources()).map((h) => `${h.file}  ${h.fn}`);
      const unexplained = hits.filter((hit) => !EXCEPTIONS.has(hit));
      expect(
        unexplained,
        "rethrow the error, or report it with problem() (lib/server/problems.server.ts); in a Server Action whose page carries on, keepCaught() (lib/oversight/errors-seen.server.ts)",
      ).toEqual([]);
      // An exception that no longer catches anything is one to delete.
      expect([...EXCEPTIONS.keys()].filter((key) => !hits.includes(key))).toEqual([]);
    },
  );
});
