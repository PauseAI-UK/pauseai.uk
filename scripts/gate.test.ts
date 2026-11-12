import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  changedFiles,
  fastPlan,
  formatDuration,
  formatTable,
  groupState,
  parseArgs,
  passed,
  runPlan,
  runStep,
  slowPlan,
  statusWriter,
  tail,
} from "./gate.mjs";

/** A step that runs a line of JavaScript in Node. */
const node = (id: string, code: string, extra: { minutes?: number; required?: boolean } = {}) => ({
  id,
  label: id,
  command: "node",
  args: ["-e", code],
  minutes: extra.minutes ?? 1,
  required: extra.required,
});

describe("parseArgs", () => {
  it("runs everything by default, the fast checks alone with --fast, and leaves out the storyboard with --no-storyboard", () => {
    expect(parseArgs([])).toEqual({ fast: false, storyboard: true });
    expect(parseArgs(["--fast"])).toEqual({ fast: true, storyboard: true });
    expect(parseArgs(["--no-storyboard"])).toEqual({ fast: false, storyboard: false });
  });

  it("refuses anything else", () => {
    expect(() => parseArgs(["--slow"])).toThrow("Unknown option --slow");
  });
});

describe("changedFiles", () => {
  it("lists each changed file once, sorted, leaving out the deleted", () => {
    const exists = (file: string) => file !== "gone.ts";
    expect(changedFiles(["lib/b.ts\ngone.ts\nlib/a.ts\n", "lib/a.ts\nnew.css\n"], exists)).toEqual([
      "lib/a.ts",
      "lib/b.ts",
      "new.css",
    ]);
  });
});

describe("fastPlan", () => {
  it("formats every changed file first, then checks the types, the scripts with ESLint and the CSS with Stylelint at once", () => {
    const [[[prettier]], lanes] = fastPlan(["README.md", "lib/a.ts", "scripts/b.mjs", "styles/c.css"]);
    expect(prettier.args).toEqual([
      "prettier",
      "--write",
      "--ignore-unknown",
      "README.md",
      "lib/a.ts",
      "scripts/b.mjs",
      "styles/c.css",
    ]);
    expect(lanes.map(([step]) => [step.id, step.args, step.skip])).toEqual([
      ["tsc", ["tsc", "--noEmit"], undefined],
      ["eslint", ["eslint", "--max-warnings", "0", "--no-warn-ignored", "lib/a.ts", "scripts/b.mjs"], undefined],
      ["stylelint", ["stylelint", "--allow-empty-input", "styles/c.css"], undefined],
      ["migration-order", ["scripts/migration-order.mjs", "--open-prs"], undefined],
    ]);
  });

  it("skips the checks that have no files to look at, but not the types or the migrations' order", () => {
    const [[[prettier]], lanes] = fastPlan([]);
    expect(prettier.skip).toBe("no changed files");
    expect(lanes.map(([step]) => step.skip)).toEqual([undefined, "no changed scripts", "no changed CSS", undefined]);
  });
});

describe("slowPlan", () => {
  it("runs CI's jobs as lanes at once: the types then the storyboard, the tests, the linters, and the backup Worker", () => {
    const [lanes] = slowPlan({ storyboard: true });
    expect(lanes.map((lane) => lane.map((step) => step.label))).toEqual([
      ["npm run typecheck", "npm run test:storyboard"],
      ["npm test"],
      ["npm run lint", "npm run lint:css", "npm run lint:unused", "npm run format:check", "npm run placeholders"],
      ["(backup) npm ci --no-audit --no-fund", "(backup) npm test", "(backup) npm run typecheck"],
    ]);
    expect(lanes[3].map((step) => step.cwd)).toEqual(["backup", "backup", "backup"]);
  });

  it("leaves out the storyboard when asked", () => {
    const [[types]] = slowPlan({ storyboard: false });
    expect(types.map((step) => step.id)).toEqual(["typecheck"]);
  });
});

describe("formatDuration", () => {
  it("gives seconds under a minute, and minutes and seconds over", () => {
    expect(formatDuration(4_400)).toBe("4s");
    expect(formatDuration(65_000)).toBe("1m05s");
  });
});

describe("formatTable", () => {
  it("lines up each command's exit code, time and log, with a dash for one that didn't run", () => {
    const step = (label: string) => ({ id: label, label, command: "npm", args: [], minutes: 1 });
    expect(
      formatTable([
        { step: step("npm test"), code: 1, ms: 65_000, log: "tmp/gate/test.log" },
        { step: step("npx stylelint"), code: null, ms: 0, note: "no changed CSS" },
      ]),
    ).toBe(
      [
        "Command        Exit  Time   Log",
        "npm test       1     1m05s  tmp/gate/test.log",
        "npx stylelint  -     -      no changed CSS",
      ].join("\n"),
    );
  });
});

describe("tail", () => {
  it("gives a file's last lines", () => {
    const file = join(mkdtempSync(join(tmpdir(), "gate-")), "a.log");
    writeFileSync(file, "one\ntwo\nthree\n");
    expect(tail(file, 2)).toBe("two\nthree");
  });
});

describe("groupState", () => {
  it("is failed if one has, running while any is or some wait their turn, passed once all have, and waiting before any starts", () => {
    expect(groupState(["waiting", "waiting"])).toBe("waiting");
    expect(groupState(["running", "waiting"])).toBe("running");
    // Between two commands of a lane: one done, the next not started.
    expect(groupState(["passed", "waiting"])).toBe("running");
    expect(groupState(["passed", "skipped"])).toBe("passed");
    expect(groupState(["passed", "failed", "running"])).toBe("failed");
    expect(groupState(["failed", "skipped"])).toBe("failed");
  });
});

describe("statusWriter", () => {
  const steps = ["prettier", "typecheck", "storyboard", "test", "lint"].map((id) => node(id, ""));

  it("keeps a file of how each command stands, and each group: the quick checks together, the tests and the storyboard apart", () => {
    const dir = mkdtempSync(join(tmpdir(), "gate-"));
    const file = join(dir, "status.json");
    const said = () => JSON.parse(readFileSync(file, "utf8"));
    const status = statusWriter(steps, file);
    expect(said()).toMatchObject({
      pid: process.pid,
      ended: false,
      groups: { checks: "waiting", storyboard: "waiting", test: "waiting" },
      steps: { prettier: "waiting", typecheck: "waiting", storyboard: "waiting", test: "waiting", lint: "waiting" },
    });
    expect(new Date(said().startedAt).getTime()).toBeLessThanOrEqual(new Date(said().updatedAt).getTime());
    status.set(steps[0], "passed");
    status.set(steps[3], "running");
    expect(said()).toMatchObject({
      groups: { checks: "running", storyboard: "waiting", test: "running" },
      steps: { prettier: "passed", test: "running" },
    });
    status.set(steps[1], "passed");
    status.set(steps[4], "passed");
    status.set(steps[3], "failed");
    status.set(steps[2], "running");
    expect(said().groups).toEqual({ checks: "passed", storyboard: "running", test: "failed" });
    status.set(steps[2], "passed");
    status.end();
    expect(said()).toMatchObject({ ended: true, groups: { checks: "passed", storyboard: "passed", test: "failed" } });
    // Each write is moved into place, and leaves nothing beside the file.
    expect(readdirSync(dir)).toEqual(["status.json"]);
  });

  it("has only the groups the gate is running", () => {
    const file = join(mkdtempSync(join(tmpdir(), "gate-")), "status.json");
    statusWriter(steps.slice(0, 2), file);
    expect(JSON.parse(readFileSync(file, "utf8")).groups).toEqual({ checks: "waiting" });
  });
});

describe("runStep", () => {
  const logDir = () => mkdtempSync(join(tmpdir(), "gate-"));

  it("says when a command starts running, and whether it passed, failed or was skipped", async () => {
    const states: string[] = [];
    const changed = (step: { id: string }, state: string) => states.push(`${step.id} ${state}`);
    await runStep(node("ok", ""), logDir(), undefined, changed);
    await runStep(node("fails", "process.exit(3)"), logDir(), undefined, changed);
    await runStep({ ...node("stylelint", ""), skip: "no changed CSS" }, logDir(), undefined, changed);
    expect(states).toEqual(["ok running", "ok passed", "fails running", "fails failed", "stylelint skipped"]);
  });

  it("runs a command with its output in its log, and reports it starting and finishing", async () => {
    const dir = logDir();
    const lines: string[] = [];
    const result = await runStep(node("hello", "console.log('hi'); console.error('oh')"), dir, (line) =>
      lines.push(line),
    );
    expect(result.code).toBe(0);
    expect(readFileSync(join(dir, "hello.log"), "utf8")).toBe("hi\noh\n");
    expect(lines[0]).toMatch(/^▶ hello \(.*hello\.log, limit 1m\)$/);
    expect(lines[1]).toMatch(/^✓ hello: 0, \d+s$/);
  });

  it("gives a failed command's exit code", async () => {
    const lines: string[] = [];
    const result = await runStep(node("fails", "process.exit(3)"), logDir(), (line) => lines.push(line));
    expect(result.code).toBe(3);
    expect(lines[1]).toMatch(/^✗ fails: 3/);
  });

  it("stops a command at its limit, exiting 124 as timeout does", async () => {
    const result = await runStep(node("hangs", "setInterval(() => {}, 1000)", { minutes: 0.005 }), logDir());
    expect(result).toMatchObject({ code: 124, note: "stopped at its limit of 0.005m" });
  });

  it("gives 128 and the signal's number for a command a signal stopped", async () => {
    const result = await runStep(node("killed", "process.kill(process.pid, 'SIGKILL')"), logDir());
    expect(result.code).toBe(128 + 9);
  });

  it("gives 127 for a command that isn't there", async () => {
    const step = { id: "missing", label: "missing", command: "no-such-command-anywhere", args: [], minutes: 1 };
    const result = await runStep(step, logDir());
    expect(result.code).toBe(127);
    expect(result.note).toContain("ENOENT");
  });

  it("doesn't run a skipped step", async () => {
    const step = { ...node("skipped", "process.exit(1)"), skip: "no changed CSS" };
    expect(await runStep(step, logDir())).toMatchObject({ code: null, note: "no changed CSS" });
  });
});

describe("runPlan", () => {
  it("runs each lane's steps in order, the lanes at once, and stops a lane at a failed required step", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gate-"));
    const results = await runPlan(
      [
        [
          [node("types", "process.exit(2)", { required: true }), node("storyboard", "")],
          [node("lint", "process.exit(1)"), node("format", "")],
        ],
        [[node("after", "")]],
      ],
      dir,
    );
    expect(results.map(({ step, code, note }) => [step.id, code, note])).toEqual([
      ["types", 2, undefined],
      ["storyboard", null, "skipped: types failed"],
      ["lint", 1, undefined],
      ["format", 0, undefined],
      ["after", 0, undefined],
    ]);
    expect(passed(results)).toBe(false);
    expect(passed(results.slice(3))).toBe(true);
  });

  it("says how each step stands as it goes, one left out after a failed required step as skipped", async () => {
    const states: string[] = [];
    await runPlan(
      [[[node("types", "process.exit(2)", { required: true }), node("storyboard", "")]]],
      mkdtempSync(join(tmpdir(), "gate-")),
      undefined,
      (step, state) => states.push(`${step.id} ${state}`),
    );
    expect(states).toEqual(["types running", "types failed", "storyboard skipped"]);
  });
});
