import { describe, expect, it } from "vitest";
import { checkOut, openSurvey, publish, type OpenSurvey, type Run } from "./publish";

function runner(answers: Record<string, string> = {}) {
  const calls: { command: string; input?: string }[] = [];
  const run: Run = (command, args, input) => {
    const line = [command, ...args].join(" ");
    calls.push({ command: line, input });
    return Object.entries(answers).find(([start]) => line.startsWith(start))?.[1] ?? "";
  };
  return { run, calls, lines: () => calls.map((call) => call.command) };
}

const open: OpenSurvey = { number: 7, headRefName: "press-survey/2026-11-09", body: "earlier" };

it("openSurvey finds the survey's open pull request among the others", () => {
  const prs = JSON.stringify([{ number: 3, headRefName: "fix-nav", body: "" }, open]);
  expect(openSurvey(runner({ "gh pr list": prs }).run)).toEqual(open);
  expect(openSurvey(runner({ "gh pr list": "[]" }).run)).toBeUndefined();
});

describe("checkOut", () => {
  it("starts a new branch from main", () => {
    const { run, lines } = runner();
    expect(checkOut(run, undefined, "2026-11-16")).toBe("press-survey/2026-11-16");
    expect(lines()).toEqual(["git checkout -B press-survey/2026-11-16 origin/main"]);
  });

  it("continues the open pull request's branch", () => {
    const { run, lines } = runner();
    expect(checkOut(run, open, "2026-11-16")).toBe(open.headRefName);
    expect(lines()).toEqual([
      "git fetch origin press-survey/2026-11-09",
      "git checkout -B press-survey/2026-11-09 origin/press-survey/2026-11-09",
    ]);
  });
});

describe("publish", () => {
  const commit =
    "git -c user.name=github-actions[bot] -c user.email=41898282+github-actions[bot]@users.noreply.github.com commit";

  it("opens a draft pull request with the file's changes", () => {
    const { run, calls, lines } = runner({ "gh pr create": "https://github.com/o/r/pull/8\n" });
    const done = publish(run, { branch: "press-survey/2026-11-16", changed: true, body: "Body", day: "2026-11-16" });
    expect(done).toBe("Opened https://github.com/o/r/pull/8");
    expect(lines()).toEqual([
      "git add lib/content/press-coverage.ts",
      `${commit} -m Press survey: week of 2026-11-16`,
      "git push origin HEAD:refs/heads/press-survey/2026-11-16",
      "gh pr create --draft --base main --head press-survey/2026-11-16 --title Press survey: week of 2026-11-16 --body-file -",
    ]);
    expect(calls.at(-1)?.input).toBe("Body");
  });

  it("opens one with an empty commit when there are only leads", () => {
    const { run, lines } = runner();
    publish(run, { branch: "press-survey/2026-11-16", changed: false, body: "Body", day: "2026-11-16" });
    expect(lines()[1]).toBe(`${commit} --allow-empty -m Press survey: week of 2026-11-16`);
  });

  it("adds to the open pull request, committing only a change to the file", () => {
    const changed = runner();
    expect(
      publish(changed.run, { open, branch: open.headRefName, changed: true, body: "Body", day: "2026-11-16" }),
    ).toBe("Updated pull request #7");
    expect(changed.lines().slice(-2)).toEqual([
      "git push origin HEAD:refs/heads/press-survey/2026-11-09",
      "gh pr edit 7 --body-file -",
    ]);

    const leadsOnly = runner();
    publish(leadsOnly.run, { open, branch: open.headRefName, changed: false, body: "Body", day: "2026-11-16" });
    expect(leadsOnly.lines()).toEqual(["gh pr edit 7 --body-file -"]);
  });
});
