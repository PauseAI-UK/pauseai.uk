import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commandMeasures, logFiles, projectFolder, report, sweep, weekOf } from "./friction-sweep.mjs";

// Made-up session logs, shaped like Claude Code's: one JSON object a line.
const SECRET = "Jane Smith, jane.smith@example.com";

const bash = (id: string, command: string, timestamp = "2026-11-03T10:00:00Z") =>
  JSON.stringify({
    type: "assistant",
    timestamp,
    message: { content: [{ type: "tool_use", id, name: "Bash", input: { command, description: SECRET } }] },
  });

const result = (id: string, content: unknown, timestamp = "2026-11-03T10:01:00Z") =>
  JSON.stringify({
    type: "user",
    timestamp,
    message: { content: [{ type: "tool_result", tool_use_id: id, content }] },
  });

const said = (text: string, timestamp: string) =>
  JSON.stringify({ type: "assistant", timestamp, message: { content: [{ type: "text", text }] } });

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "friction-sweep-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function log(path: string, lines: string[]) {
  mkdirSync(join(dir, path, ".."), { recursive: true });
  writeFileSync(join(dir, path), lines.join("\n") + "\n");
}

describe("commandMeasures", () => {
  it.each([
    ['export TEST_DATABASE_URL="postgresql://dev@localhost/postgres"', "testDatabaseUrl"],
    ["npm run typecheck && npm test && npm run lint:css", "gateByHand"],
    ["npx tsc --noEmit; npx eslint lib/a.ts", "gateByHand"],
    ["git worktree add tmp/worktrees/x -b x origin/main", "worktreeByHand"],
    ["lsof -ti:3100 | xargs kill", "killedServer"],
    ["fuser -k 4798/tcp", "killedServer"],
    ['pkill -f "next start"', "killedServer"],
    ["node -e 'require(\"./test-results/storyboard/latest/storyboard.json\")'", "storyboardJson"],
    ["jq .frames test-results/storyboard/latest/storyboard.json", "storyboardJson"],
    ["sed -i 's/a/b/' lib/a.ts", "scriptedEdit"],
    ["perl -pi -e 's/a/b/' lib/a.ts", "scriptedEdit"],
    ["python3 - <<'EOF'\nopen('lib/a.ts', 'w').write(text)\nEOF", "scriptedEdit"],
    ["python3 -c \"Path('a').write_text(t)\"", "scriptedEdit"],
  ])("counts %j as %s", (command, measure) => {
    expect([...commandMeasures(command)]).toEqual([measure]);
  });

  it.each([
    "npm run gate",
    "npm run gate -- --fast && npm test",
    "npm test",
    "npm run test:changed && npm run lint",
    "kill 1234",
    "lsof -i :3100",
    "cat storyboard.json",
    "sed -n 1,20p lib/a.ts",
    "python3 -c 'print(1)'",
    "git worktree list",
  ])("counts %j as nothing", (command) => {
    expect(commandMeasures(command).size).toBe(0);
  });
});

describe("weekOf", () => {
  it("is the Monday of the week, in UTC", () => {
    expect(weekOf("2026-11-09T00:00:00Z")).toBe("2026-11-09");
    expect(weekOf("2026-11-15T23:59:59Z")).toBe("2026-11-09");
    expect(weekOf("2026-11-08T12:00:00Z")).toBe("2026-11-02");
  });
});

describe("projectFolder", () => {
  it("is the checkout's path with everything but letters and digits made a dash", () => {
    expect(projectFolder("/pauseai.uk")).toBe("-pauseai-uk");
    expect(projectFolder("/Users/jane/code/pause_ai")).toBe("-Users-jane-code-pause-ai");
  });
});

describe("logFiles", () => {
  it("finds the sessions' logs and their subagents', and nothing else", () => {
    log("a.jsonl", []);
    log("a/subagents/agent-1.jsonl", []);
    log("a/subagents/notes.txt", []);
    log("a/tool-results/x.jsonl", []);
    log("b.jsonl", []);
    mkdirSync(join(dir, "c"));
    expect(logFiles(dir)).toEqual(["a.jsonl", "a/subagents/agent-1.jsonl", "b.jsonl"].map((path) => join(dir, path)));
  });
});

describe("sweep and report", () => {
  async function run() {
    return report(await sweep(logFiles(dir), (path: string) => path.startsWith("lib/")), "-pauseai-uk");
  }

  it("counts each session once a measure, in the week it began, and conflicts by file", async () => {
    log("one.jsonl", [
      said(SECRET, "2026-11-01T09:00:00Z"),
      bash("t1", `TEST_DATABASE_URL=x npm run test:node # ${SECRET}`),
      bash("t2", "TEST_DATABASE_URL=y npm run test:node"),
      bash("t3", "git rebase origin/main"),
      result(
        "t3",
        `CONFLICT (content): Merge conflict in lib/a.ts\nCONFLICT (content): Merge conflict in ${SECRET}.ts`,
      ),
      bash("t4", "git rebase --continue"),
      result("t4", [
        { type: "text", text: "CONFLICT (modify/delete): lib/b.ts deleted in HEAD and modified in x." },
        { type: "image" },
      ]),
      bash("t5", "git status"),
      result("t5", "CONFLICT (content): Merge conflict in lib/c.ts"),
      JSON.stringify({ type: "system", subtype: "compact_boundary", timestamp: "2026-11-03T11:00:00Z" }),
    ]);
    log("one/subagents/agent-1.jsonl", [bash("s1", "sed -i 's/a/b/' lib/a.ts", "2026-11-04T10:00:00Z")]);
    log("two.jsonl", [
      JSON.stringify({ type: "attachment", attachment: { type: "auto_mode", bashFirst: true } }),
      bash("u1", "lsof -ti:4798 | xargs kill", "2026-11-10T08:00:00Z"),
      bash("u2", "git rebase main", "2026-11-10T08:00:00Z"),
      result("u2", "CONFLICT (content): Merge conflict in lib/a.ts", "2026-11-10T08:01:00Z"),
      "not JSON, but it says tool_use and Bash",
      JSON.stringify({ type: "assistant", message: { content: "tool_use Bash" } }),
    ]);
    log("three.jsonl", [JSON.stringify({ type: "attachment", attachment: { type: "auto_mode", bashFirst: false } })]);

    const text = await run();
    expect(text).not.toContain("Jane");
    expect(text).not.toContain("example.com");
    expect(text).not.toContain("lib/c.ts");
    expect(text).toBe(
      [
        "Friction sweep of -pauseai-uk: sessions by the week (from Monday) each began.",
        "",
        "Sessions that                                       2026-10-26  2026-11-09",
        "sessions                                                     1           1",
        "set TEST_DATABASE_URL by hand                                1           0",
        "ran two or more of the gate's checks by hand                 0           0",
        "set up a worktree by hand (git worktree add)                 0           0",
        "killed a server on a port                                    0           1",
        "read storyboard.json with a script                           0           0",
        "edited files with sed -i, perl -i or inline Python           1           0",
        "ran out of context and was summarised                        1           0",
        "had the Bash-first experiment on                             0           1",
        "",
        "Rebase conflicts, by file           2026-10-26  2026-11-09",
        "lib/a.ts                                     1           1",
        "lib/b.ts                                     1           0",
        "(a path not in the repo's history)           1           0",
        "",
      ].join("\n"),
    );
  });

  it("says so when there were no rebase conflicts, and leaves out a log with no times", async () => {
    log("one.jsonl", [bash("t1", "git worktree add x")]);
    log("two.jsonl", [JSON.stringify({ type: "mode", timestamp: "not a time" })]);
    expect(await run()).toBe(
      [
        "Friction sweep of -pauseai-uk: sessions by the week (from Monday) each began.",
        "",
        "Sessions that                                       2026-11-02",
        "sessions                                                     1",
        "set TEST_DATABASE_URL by hand                                0",
        "ran two or more of the gate's checks by hand                 0",
        "set up a worktree by hand (git worktree add)                 1",
        "killed a server on a port                                    0",
        "read storyboard.json with a script                           0",
        "edited files with sed -i, perl -i or inline Python           0",
        "ran out of context and was summarised                        0",
        "had the Bash-first experiment on                             0",
        "",
        "Rebase conflicts: none.",
        "",
      ].join("\n"),
    );
  });
});
