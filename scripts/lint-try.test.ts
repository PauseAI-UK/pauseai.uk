import { describe, expect, it } from "vitest";
import { isTest, parseTry, report, tally } from "./lint-try.mjs";

describe("parseTry", () => {
  it("takes each rule as an error, with its options as JSON, and the files after --", () => {
    expect(parseTry(["no-console", 'eqeqeq=["always"]', 'no-plusplus={"allowForLoopAfterthoughts":true}'])).toEqual({
      rules: {
        "no-console": "error",
        eqeqeq: ["error", "always"],
        "no-plusplus": ["error", { allowForLoopAfterthoughts: true }],
      },
      files: ["."],
    });
    expect(parseTry(["no-console", "--", "lib", "app"]).files).toEqual(["lib", "app"]);
    expect(parseTry(["no-console", "--"]).files).toEqual(["."]);
  });

  it("needs a rule", () => {
    expect(() => parseTry([])).toThrow(/Name a rule/);
  });
});

describe("tally and report", () => {
  it("counts each rule's lines in site code and in tests, and lists them", () => {
    const results = [
      {
        filePath: "/repo/lib/a.ts",
        messages: [
          { ruleId: "no-console", line: 3, message: "Unexpected console." },
          { ruleId: "other", line: 4, message: "Not tried." },
        ],
      },
      {
        filePath: "/repo/lib/a.test.ts",
        messages: [{ ruleId: "no-console", line: 9, message: "Unexpected console." }],
      },
    ] as Parameters<typeof tally>[0];
    const tallies = tally(results, ["no-console", "eqeqeq"], "/repo");
    expect(report(tallies)).toBe(
      [
        "no-console: 1 in site code, 1 in tests",
        "  lib/a.ts:3 Unexpected console.",
        "  lib/a.test.ts:9 Unexpected console.",
        "",
        "eqeqeq: 0 in site code, 0 in tests",
      ].join("\n"),
    );
  });

  it("counts the tests' own code as tests", () => {
    expect(["tests/storyboard/a.ts", "lib/b.test.tsx", "lib/c.ts"].map(isTest)).toEqual([true, true, false]);
  });
});
