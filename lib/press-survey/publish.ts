// Where the survey's finds go: a draft pull request, opened by the
// workflow's own token, for a person to check and merge. While one is
// open, each run adds to it rather than opening another, so the open pull
// request's branch is where a run starts from. Git and GitHub's CLI come
// through `run`, so the tests can watch what's asked of them.

export type Run = (command: string, args: string[], input?: string) => string;

export type OpenSurvey = { number: number; headRefName: string; body: string };

export const FILE = "lib/content/press-coverage.ts";
const BRANCH_PREFIX = "press-survey/";

/** The survey's open pull request, if there is one. */
export function openSurvey(run: Run): OpenSurvey | undefined {
  const open = JSON.parse(
    run("gh", ["pr", "list", "--state", "open", "--json", "number,headRefName,body", "--limit", "100"]),
  ) as OpenSurvey[];
  return open.find((pr) => pr.headRefName.startsWith(BRANCH_PREFIX));
}

/** Checks out the open pull request's branch, or a new one for `day`, and gives its name. */
export function checkOut(run: Run, open: OpenSurvey | undefined, day: string): string {
  if (!open) {
    const branch = `${BRANCH_PREFIX}${day}`;
    run("git", ["checkout", "-B", branch, "origin/main"]);
    return branch;
  }
  run("git", ["fetch", "origin", open.headRefName]);
  run("git", ["checkout", "-B", open.headRefName, `origin/${open.headRefName}`]);
  return open.headRefName;
}

const BOT = [
  "-c",
  "user.name=github-actions[bot]",
  "-c",
  "user.email=41898282+github-actions[bot]@users.noreply.github.com",
];

/**
 * Commits the file if it `changed`, pushes, and opens the draft pull
 * request or updates the open one's description. A new pull request with
 * only leads, nothing for the file, gets an empty commit, as a pull
 * request needs one. Gives what it did.
 */
export function publish(
  run: Run,
  {
    open,
    branch,
    changed,
    body,
    day,
  }: { open?: OpenSurvey; branch: string; changed: boolean; body: string; day: string },
): string {
  const title = `Press survey: week of ${day}`;
  if (changed || !open) {
    run("git", ["add", FILE]);
    run("git", [...BOT, "commit", ...(changed ? [] : ["--allow-empty"]), "-m", title]);
    run("git", ["push", "origin", `HEAD:refs/heads/${branch}`]);
  }
  if (open) {
    run("gh", ["pr", "edit", String(open.number), "--body-file", "-"], body);
    return `Updated pull request #${open.number}`;
  }
  const url = run(
    "gh",
    ["pr", "create", "--draft", "--base", "main", "--head", branch, "--title", title, "--body-file", "-"],
    body,
  );
  return `Opened ${url.trim()}`;
}
