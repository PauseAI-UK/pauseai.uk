#!/usr/bin/env node
// Tries ESLint rules before they're adopted: how many lines each would flag,
// in the site's code and in its tests, then each line. A rule that flags two
// lines is fixed in passing; one that flags forty is left out, or needs a
// list of files still to change.
//
//   npm run lint:try -- <rule> [<rule>…] [-- <file or glob>…]
//   npm run lint:try -- @typescript-eslint/strict-boolean-expressions
//   npm run lint:try -- 'no-console={"allow":["warn"]}' -- lib app
//
// A rule's options follow an `=`, as JSON: an object is the rule's one
// option, an array its options in order. Each rule is added, for this run
// only, beside the typed rules in eslint.config.mjs (every .ts and .tsx file
// but the backup's), so a rule that needs the types works. With no files
// named, it lints the whole repo, which takes a minute or two.
import { ESLint } from "eslint";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The rules asked for, by name, each with its setting for ESLint, and the
 * files to lint.
 *
 * @param {string[]} args
 * @returns {{ rules: Record<string, unknown>, files: string[] }}
 */
export function parseTry(args) {
  const split = args.indexOf("--");
  const named = split === -1 ? args : args.slice(0, split);
  const files = split === -1 ? ["."] : args.slice(split + 1);
  if (named.length === 0) throw new Error("Name a rule or more: npm run lint:try -- <rule> [-- <files>]");
  const rules = Object.fromEntries(
    named.map((arg) => {
      const at = arg.indexOf("=");
      if (at === -1) return [arg, "error"];
      const options = JSON.parse(arg.slice(at + 1));
      return [arg.slice(0, at), ["error", ...(Array.isArray(options) ? options : [options])]];
    }),
  );
  return { rules, files: files.length > 0 ? files : ["."] };
}

/** Whether a file is a test's, or the tests' own code, rather than the site's. */
export const isTest = (file) => /\.test\.tsx?$/.test(file) || file.startsWith("tests/");

/**
 * What the rules flagged in `results` (ESLint's), by rule: how many lines in
 * site code and in tests, and each line as "file:line message", with files
 * relative to `root`.
 *
 * @param {import("eslint").ESLint.LintResult[]} results
 * @param {string[]} rules
 * @param {string} root
 */
export function tally(results, rules, root) {
  return rules.map((rule) => {
    const lines = results.flatMap((result) =>
      result.messages
        .filter((message) => message.ruleId === rule)
        .map((message) => ({
          file: relative(root, result.filePath),
          line: message.line,
          message: message.message,
        })),
    );
    return {
      rule,
      site: lines.filter((line) => !isTest(line.file)).length,
      tests: lines.filter((line) => isTest(line.file)).length,
      lines: lines.map(({ file, line, message }) => `${file}:${line} ${message}`),
    };
  });
}

/** The report of `tally`, as it's printed. */
export function report(tallies) {
  return tallies
    .map(({ rule, site, tests, lines }) =>
      [`${rule}: ${site} in site code, ${tests} in tests`, ...lines.map((line) => `  ${line}`)].join("\n"),
    )
    .join("\n\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { rules, files } = parseTry(process.argv.slice(2));
  const eslint = new ESLint({
    overrideConfig: [{ files: ["**/*.{ts,tsx}"], ignores: ["backup/**"], rules }],
  });
  console.error(`Linting ${files.join(" ")} with ${Object.keys(rules).join(", ")}…`);
  const results = await eslint.lintFiles(files);
  console.log(report(tally(results, Object.keys(rules), process.cwd())));
}
