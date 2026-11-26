import { expect, it } from "vitest";
import { publicText } from "@/lib/problems";
import { pressCopy, pressProblems } from "./copy";

it("sums up a survey's run, saying how many are left to read only when some are", () => {
  const all = pressCopy.job.result({ found: 6, read: 5, waiting: 2, left: 0 });
  expect(all).toMatch(/6.*5.*2/);
  expect(all).not.toContain("left");
  expect(pressCopy.job.result({ found: 6, read: 3, waiting: 1, left: 3 })).toMatch(/6.*3.*1.*3 left/);
});

it("counts the finds waiting in the email's subject, one or more", () => {
  expect(pressCopy.waitingEmail.subject(1)).toContain("1");
  expect(pressCopy.waitingEmail.subject(3)).toContain("3");
  expect(pressCopy.waitingEmail.subject(1).replace("1", "3")).not.toBe(pressCopy.waitingEmail.subject(3));
});

it("lists each find in the email, then the link to the Press page", () => {
  const finds = [
    { outlet: "The Example Gazette", title: "Protesters march", url: "https://www.example.org/a" },
    { outlet: "Example Weekly", title: "Founder warns", url: "https://www.example.org/b" },
  ];
  const lines = pressCopy.waitingEmail.body({ finds, link: "https://pauseai.uk/staff/press" }).split("\n");
  expect(lines.indexOf("https://www.example.org/a")).toBeLessThan(lines.indexOf("https://www.example.org/b"));
  expect(lines.some((line) => line.includes("The Example Gazette") && line.includes("Protesters march"))).toBe(true);
  expect(lines.at(-1)).toBe("https://pauseai.uk/staff/press");
});

it("words the problems the survey reports, with their values", () => {
  expect(pressProblems.searchFailed({ after: publicText("2026-10-08") }).what).toContain("2026-10-08");
  expect(pressProblems.findNotRead({ find: 12 }).what).toContain("12");
  expect(pressProblems.googleBlocked().what).toContain("Google");
  expect(pressProblems.notJudged({ finds: 4 }).what).toContain("4");
});
