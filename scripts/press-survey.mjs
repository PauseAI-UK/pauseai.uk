#!/usr/bin/env node
// The weekly press survey (.github/workflows/press-survey.yml runs it on
// Mondays): finds the last week's coverage that mentions PauseAI, and adds
// what passes lib/content/press-coverage.ts's rules to a draft pull request
// for a person to check. The work is in lib/press-survey/ (survey.ts says
// how); this wires it to the network, `claude`, git and `gh`.
//
//   npm run press-survey                 search, then commit, push and open or update the pull request
//   npm run press-survey -- --dry-run    search and edit the file here, writing the description to tmp/press-survey/
//
// With CLAUDE_CODE_OAUTH_TOKEN set, one `claude -p` call, with no tools,
// decides the candidates; without, only pages naming PauseAI UK are added.
// It opens no pull request when it finds nothing new.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { addToCoverageFile } from "../lib/press-survey/coverage-file.ts";
import { checkOut, FILE, openSurvey, publish } from "../lib/press-survey/publish.ts";
import { description } from "../lib/press-survey/report.ts";
import { SYSTEM_PROMPT, VERDICT_SCHEMA } from "../lib/press-survey/review.ts";
import { runSurvey } from "../lib/press-survey/survey.ts";

const dryRun = process.argv.includes("--dry-run");
const OUT = "tmp/press-survey";
const PAGE_LIMIT = 3_000_000;

/** Runs a command, giving what it printed; throws if it fails. */
const run = (command, args, input) =>
  execFileSync(command, args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "inherit"], maxBuffer: 20_000_000 });

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; press-survey)",
      accept: "text/html,application/json,application/rss+xml;q=0.9,*/*;q=0.5",
      "accept-language": "en-GB,en;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  return {
    status: response.status,
    text: text.slice(0, PAGE_LIMIT),
    contentType: response.headers.get("content-type") ?? "",
  };
}

/** One `claude -p`, in an empty folder so no project's settings or instructions load, with no tools at all. */
async function review(prompt) {
  const folder = mkdtempSync(join(tmpdir(), "press-survey-"));
  try {
    const args = [
      "-p",
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify(VERDICT_SCHEMA),
      "--tools",
      "",
      "--strict-mcp-config",
      "--no-session-persistence",
      "--system-prompt",
      SYSTEM_PROMPT,
    ];
    const done = spawnSync("claude", args, {
      cwd: folder,
      input: prompt,
      encoding: "utf8",
      timeout: 15 * 60_000,
      maxBuffer: 20_000_000,
    });
    if (!done.stdout) throw new Error(`claude printed nothing (exit ${done.status}): ${done.stderr || done.error}`);
    return done.stdout;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** The outlets in `path`, loaded fresh; throws, listing the problems, if they're malformed. */
async function outletsIn(path) {
  mkdirSync(OUT, { recursive: true });
  const copy = join(OUT, `check-${Date.now()}.ts`);
  copyFileSync(path, copy);
  try {
    return (await import(pathToFileURL(copy).href)).OUTLETS;
  } finally {
    rmSync(copy);
  }
}

const day = new Date().toISOString().slice(0, 10);
const open = dryRun ? undefined : openSurvey(run);
const branch = dryRun ? undefined : checkOut(run, open, day);

const file = readFileSync(FILE, "utf8");
const outlets = await outletsIn(FILE);
const onMain = run("git", ["show", `origin/main:${FILE}`]);
const token = process.env.CLAUDE_CODE_OAUTH_TOKEN;
const result = await runSurvey(
  { file, outlets, alsoKnown: `${onMain}\n${open?.body ?? ""}` },
  { fetch: fetchText, wait: (ms) => new Promise((done) => setTimeout(done, ms)), review: token ? review : undefined },
);

let changed = false;
if (result.added.length > 0) {
  writeFileSync(
    FILE,
    addToCoverageFile(
      file,
      result.added,
      outlets.map((outlet) => outlet.name),
    ),
  );
  run("node_modules/.bin/prettier", ["--write", FILE]);
  try {
    await outletsIn(FILE);
    changed = true;
  } catch (error) {
    writeFileSync(FILE, file);
    result.notes.push(`The additions made the file invalid, so they're listed as leads instead: ${error.message}`);
    result.leads.unshift(...result.added.map((addition) => ({ ...addition, why: addition.note })));
    result.added = [];
  }
}

for (const note of result.notes) console.log(`note: ${note}`);
console.log(`${result.added.length} added, ${result.leads.length} leads, ${result.setAside.length} set aside.`);
if (result.added.length === 0 && result.leads.length === 0) {
  console.log("Nothing new, so no pull request.");
  process.exit(0);
}

const body = description({ day, ...result }, open?.body);
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "description.md"), body);
if (dryRun) {
  console.log(`Dry run: the description is in ${OUT}/description.md, and the file's changes are in git diff.`);
} else {
  console.log(publish(run, { open, branch, changed, body, day }));
}
