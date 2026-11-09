#!/usr/bin/env node
// Counts, by week, what agents keep doing by hand, from Claude Code's
// session logs for this repo, for the monthly review of investments/
// (investments/README.md). The logs stay on this machine: they hold private
// data, and the repo is public. So this writes only counts, and the paths of
// files in the repo, to tmp/friction-sweep.txt, and prints the same. It
// quotes nothing else from a log.
//
//   npm run friction-sweep
//   npm run friction-sweep -- --logs <folder>   # another folder of logs
//
// The logs are ~/.claude/projects/<folder>/*.jsonl, one a session, and
// <session>/subagents/*.jsonl, its subagents', where <folder> is the main
// checkout's path with every character but a letter or digit made "-"
// (/pauseai.uk is -pauseai-uk). A session counts once for each measure,
// in the week (from Monday) of its first line.
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

/** What a session can have done, each counted once a session, in the report's order. */
const MEASURES = [
  ["testDatabaseUrl", "set TEST_DATABASE_URL by hand"],
  ["gateByHand", "ran two or more of the gate's checks by hand"],
  ["worktreeByHand", "set up a worktree by hand (git worktree add)"],
  ["killedServer", "killed a server on a port"],
  ["storyboardJson", "read storyboard.json with a script"],
  ["scriptedEdit", "edited files with sed -i, perl -i or inline Python"],
  ["compacted", "ran out of context and was summarised"],
  ["bashFirst", "had the Bash-first experiment on"],
];

// The gate's checks (scripts/gate.mjs), any two of which in one command
// are the gate run by hand rather than `npm run gate`.
const GATE_CHECKS = [
  /\bnpm (run )?test(?![:\w-])/,
  /\bnpm run typecheck\b/,
  /\bnpm run lint(?![:\w-])/,
  /\bnpm run lint:css\b/,
  /\bnpm run lint:unused\b/,
  /\bnpm run format:check\b/,
  /\bnpm run test:storyboard\b/,
  /\bnpx tsc\b/,
  /\bnpx (eslint|stylelint)\b/,
];

/**
 * The measures a Bash command counts towards. Only the command is looked
 * at, and only these yes-or-no answers leave this function.
 */
export function commandMeasures(command) {
  const found = new Set();
  if (/\bTEST_DATABASE_URL=/.test(command)) found.add("testDatabaseUrl");
  if (!/\bnpm run gate\b/.test(command) && GATE_CHECKS.filter((check) => check.test(command)).length >= 2)
    found.add("gateByHand");
  if (/\bgit worktree add\b/.test(command)) found.add("worktreeByHand");
  if (
    /\b(kill|pkill|killall)\b|\bfuser\b.*\s-k\b/.test(command) &&
    /\blsof\b|:\d{4,5}\b|\b\d{4,5}\/tcp\b|next[ -](start|server)|serve-(fixture|main)/.test(command)
  )
    found.add("killedServer");
  if (/storyboard\.json/.test(command) && /\b(node|python3?|jq|bun|deno)\b/.test(command)) found.add("storyboardJson");
  if (
    /\bsed\b[^|;&]*\s(-[a-zA-Z]*i|--in-place)\b/.test(command) ||
    /\bperl\b[^|;&]*\s-[a-zA-Z]*i/.test(command) ||
    (/\bpython3?\b/.test(command) && /write_text\(|\.write\(|open\([^)]*["'][wa]\+?["']/.test(command))
  )
    found.add("scriptedEdit");
  return found;
}

/** The Monday, "YYYY-MM-DD" in UTC, of the week a timestamp falls in. */
export function weekOf(timestamp) {
  const day = new Date(timestamp);
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

/** The folder under ~/.claude/projects/ that Claude Code keeps a checkout's logs in. */
export function projectFolder(checkout) {
  return checkout.replace(/[^a-zA-Z0-9]/g, "-");
}

/** Every session log in a project folder: the sessions', then their subagents'. */
export function logFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const sessions = entries.filter((e) => e.isFile() && e.name.endsWith(".jsonl")).map((e) => join(dir, e.name));
  const subagents = entries
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, "subagents")))
    .flatMap((e) =>
      readdirSync(join(dir, e.name, "subagents"))
        .filter((name) => name.endsWith(".jsonl"))
        .map((name) => join(dir, e.name, "subagents", name)),
    );
  return [...sessions, ...subagents].sort();
}

/** The session a log belongs to: its own name, or for a subagent's, its session's folder. */
function sessionOf(file) {
  return basename(dirname(file)) === "subagents" ? basename(dirname(dirname(file))) : basename(file, ".jsonl");
}

const TIMESTAMP = /"timestamp":"([^"]+)"/;
// Git's report of a conflicted file: "Merge conflict in <path>", or for a
// file deleted on one side, "<path> deleted in ...".
const CONFLICT = /CONFLICT \([^)]*\): (?:Merge conflict in (\S+)|(\S+) deleted in )/g;

/** The text of a tool result: a string, or a list of blocks whose text parts count. */
function resultText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => (block?.type === "text" && typeof block.text === "string" ? block.text : ""))
    .join("\n");
}

/**
 * Reads the logs line by line and counts. A line is parsed as JSON only if
 * it could count: a Bash call, the result of a rebase, a summary of the
 * context, or Claude Code's auto mode settings. `isRepoFile` says whether a
 * conflicted path is a file in the repo; any other is counted under null,
 * so no path from a log is reported that isn't the repo's own.
 */
export async function sweep(files, isRepoFile) {
  /**
   * Session id -> its first time, the measures it counts towards, and its
   * rebase conflicts by file ("" for a file not in the repo).
   */
  const sessions = new Map();

  for (const file of files) {
    const id = sessionOf(file);
    const session = sessions.get(id) ?? { first: undefined, measures: new Set(), conflicts: new Map() };
    sessions.set(id, session);
    const rebaseCalls = new Set();

    const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
    for await (const line of lines) {
      const stamp = TIMESTAMP.exec(line)?.[1];
      if (stamp && !Number.isNaN(Date.parse(stamp)) && (session.first === undefined || stamp < session.first))
        session.first = stamp;
      if (line.includes('"compact_boundary"')) session.measures.add("compacted");
      if (line.includes('"auto_mode"') && line.includes('"bashFirst":true')) session.measures.add("bashFirst");

      const bashCall = line.includes('"tool_use"') && line.includes('"Bash"');
      const rebaseResult = rebaseCalls.size > 0 && line.includes('"tool_result"') && line.includes("CONFLICT");
      if (!bashCall && !rebaseResult) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const content = entry?.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block?.type === "tool_use" && block.name === "Bash" && typeof block.input?.command === "string") {
          for (const measure of commandMeasures(block.input.command)) session.measures.add(measure);
          if (/\bgit\b.*\brebase\b/.test(block.input.command)) rebaseCalls.add(block.id);
        }
        if (block?.type === "tool_result" && rebaseCalls.has(block.tool_use_id)) {
          for (const [, merged, deleted] of resultText(block.content).matchAll(CONFLICT)) {
            const path = isRepoFile(merged ?? deleted) ? (merged ?? deleted) : "";
            session.conflicts.set(path, (session.conflicts.get(path) ?? 0) + 1);
          }
        }
      }
    }
  }
  return sessions;
}

/**
 * The report: a table of sessions and each measure by week, then rebase
 * conflicts by file. A log with no time in it counts nowhere.
 */
export function report(sessions, source) {
  const counted = [...sessions.values()].filter((s) => s.first).map((s) => ({ ...s, week: weekOf(s.first) }));
  const weeks = [...new Set(counted.map((s) => s.week))].sort();
  const inWeek = (week) => counted.filter((s) => s.week === week);

  const rows = [
    ["sessions", ...weeks.map((week) => inWeek(week).length)],
    ...MEASURES.map(([key, label]) => [
      label,
      ...weeks.map((week) => inWeek(week).filter((s) => s.measures.has(key)).length),
    ]),
  ];
  // Files in the repo by name, then those that aren't.
  const paths = [...new Set(counted.flatMap((s) => [...s.conflicts.keys()]))].sort((a, b) =>
    a === "" ? 1 : b === "" ? -1 : a.localeCompare(b),
  );
  const conflictRows = paths.map((path) => [
    path || "(a path not in the repo's history)",
    ...weeks.map((week) => inWeek(week).reduce((sum, s) => sum + (s.conflicts.get(path) ?? 0), 0)),
  ]);

  const table = (title, body) => {
    const all = [[title, ...weeks], ...body].map((row) => row.map(String));
    const widths = all[0].map((_, i) => Math.max(...all.map((row) => row[i].length)));
    return all.map((row) => row.map((cell, i) => (i ? cell.padStart(widths[i]) : cell.padEnd(widths[i]))).join("  "));
  };

  return [
    `Friction sweep of ${source}: sessions by the week (from Monday) each began.`,
    "",
    ...table("Sessions that", rows),
    "",
    ...(conflictRows.length ? table("Rebase conflicts, by file", conflictRows) : ["Rebase conflicts: none."]),
    "",
  ].join("\n");
}

async function main(args) {
  const git = (...gitArgs) => execFileSync("git", gitArgs, { encoding: "utf8" }).trim();
  const checkout = dirname(git("rev-parse", "--path-format=absolute", "--git-common-dir"));
  const at = args.indexOf("--logs");
  const logs = at === -1 ? join(homedir(), ".claude", "projects", projectFolder(checkout)) : args[at + 1];
  if (!existsSync(logs)) throw new Error(`No session logs at ${logs}.`);

  const repoFiles = new Set(git("log", "--all", "--format=", "--name-only").split("\n").filter(Boolean));
  const result = await sweep(logFiles(logs), (path) => repoFiles.has(path));
  const text = report(result, basename(logs));
  const out = join(git("rev-parse", "--show-toplevel"), "tmp", "friction-sweep.txt");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  console.log(text);
  console.log(`Written to ${out}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
