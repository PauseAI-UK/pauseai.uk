import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { IMPORT_JOBS, jobSchedule, NIGHTLY, type ImportJob } from "@/lib/import-runs";
import type { AnyImportRun } from "@/lib/import-run-types";

const SCHEDULE_ORDER = ["frequent", "quarter-hour", "hourly", "nightly"];
import { staffTime } from "@/lib/staff-time";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { ImportJobPage, ImportOverview } from "./ImportJob";
import { ImportJobPageExample } from "./ImportJob.gallery.client";
import {
  exampleFailedRun,
  exampleCivicrmResult,
  exampleHeldImport,
  exampleImportResult,
  exampleLumaResult,
  exampleRun,
} from "./RunList.examples";
import type { RunJob } from "./JobActions";
import type { Decide } from "./Run";
import { press } from "@/tests/browser/staff";
import { politiciansCopy } from "../politicians/copy";
import { jobsCopy } from "./copy";
import { importRunsCopy } from "@/lib/import-runs-copy";
import { pressCopy } from "@/lib/press/copy";

const ran = exampleRun;

const failed = exampleFailedRun;

/** The time the overview is shown at. */
const NOW = new Date("2026-10-21T11:50:00Z");

describe("ImportOverview", () => {
  it("is a card per job, each a link to its page, with how its newest run ended, or that it never ran", async () => {
    // In the order of IMPORT_JOBS.
    const newest: (AnyImportRun | undefined)[] = [
      ran("import-luma", { ...exampleLumaResult, stoppedBy: "time" }, { at: new Date("2026-10-21T11:17:00Z") }),
      ran("import-civicrm", exampleCivicrmResult, { at: new Date("2026-10-21T11:49:00Z") }),
      ran("read-gmail", { accounts: [] }, { at: new Date("2026-10-21T11:20:00Z"), status: "unchanged" }),
      undefined,
      exampleHeldImport,
      ran("import-scottish-parliament", exampleImportResult, {
        at: new Date("2026-10-21T06:22:00Z"),
        status: "unchanged",
      }),
      undefined,
      undefined,
      failed("import-controlai", "No PDF linked", { at: new Date("2026-10-21T02:00:00Z") }),
      undefined,
      undefined,
    ];
    await render(<ImportOverview newest={newest} running={[]} now={NOW} />);
    await expect.element(page.getByRole("heading", { level: 1, name: jobsCopy.import.pageTitle })).toBeVisible();
    // A heading for each schedule, its jobs' cards under it.
    expect(
      page
        .getByRole("heading", { level: 2 })
        .all()
        .map((h) => h.element().textContent),
    ).toEqual([
      jobsCopy.import.frequent,
      jobsCopy.import["quarter-hour"],
      jobsCopy.import.hourly,
      jobsCopy.import.nightly,
    ]);
    const cards = [...document.querySelectorAll("section")];
    // Each ends with when it next runs, in London as the staff pages' times are: Luma's at 2 minutes past each five,
    // sending's at 3 past each quarter, Parliament's tomorrow morning; and not what it does, which its own page says.
    const words = jobsCopy.import;
    expect(cards[0].lastElementChild!.textContent).toBe(words.runsAgain(staffVocabulary.dueIn.minutes(2), "12:52"));
    expect(cards[2].lastElementChild!.textContent).toBe(words.runsAgain(staffVocabulary.dueIn.minutes(13), "13:03"));
    expect(cards[4].lastElementChild!.textContent).toBe(words.runsAgain(staffVocabulary.dueIn.hours(19), "07:21"));
    expect(cards[1].textContent).toContain(words.runsAgain(staffVocabulary.dueIn.minutes(5), "12:55"));
    expect(document.body.textContent).not.toContain(politiciansCopy.politicianImports.intros["import-parliament"].link);
    expect(cards.map((card) => card.querySelector("h3 a")!.getAttribute("href"))).toEqual([
      "/staff/scheduled-jobs/luma",
      "/staff/scheduled-jobs/gmail",
      "/staff/scheduled-jobs/sending",
      "/staff/scheduled-jobs/civicrm",
      "/staff/scheduled-jobs/parliament",
      "/staff/scheduled-jobs/scottish-parliament",
      "/staff/scheduled-jobs/senedd",
      "/staff/scheduled-jobs/ni-assembly",
      "/staff/scheduled-jobs/controlai",
      "/staff/scheduled-jobs/controlai-statement",
      "/staff/scheduled-jobs/edm",
      "/staff/scheduled-jobs/press",
      "/staff/scheduled-jobs/tidying",
    ]);
    expect(cards.map((card) => card.querySelector("h3 a")!.textContent)).toEqual([
      importRunsCopy.jobTitles["import-luma"],
      importRunsCopy.jobTitles["read-gmail"],
      importRunsCopy.jobTitles["send-mailings"],
      importRunsCopy.jobTitles["import-civicrm"],
      importRunsCopy.jobTitles["import-parliament"],
      importRunsCopy.jobTitles["import-scottish-parliament"],
      importRunsCopy.jobTitles["import-senedd"],
      importRunsCopy.jobTitles["import-ni-assembly"],
      importRunsCopy.jobTitles["import-controlai"],
      importRunsCopy.jobTitles["import-controlai-statement"],
      importRunsCopy.jobTitles["import-edm"],
      importRunsCopy.jobTitles["import-press"],
      importRunsCopy.jobTitles["tidy-logs"],
    ]);
    // Under the name, its newest run on a line: how it ended, after a dot of its colour, when, and what it found.
    const status = (i: number) => cards[i].querySelector("h3")!.parentElement!.nextElementSibling!.firstElementChild!;
    const tone = (i: number) => status(i).querySelector("[data-tone]")?.getAttribute("data-tone");
    expect(status(0).textContent).toMatch(new RegExp(`^${jobsCopy.runs.status.incomplete}21 Oct 2026, 12:17.`));
    expect([0, 1, 3, 4, 5, 8].map(tone)).toEqual(["amber", "green", "green", "amber", "green", "red"]);
    expect(status(8).textContent).toContain(jobsCopy.runs.error("No PDF linked"));
    expect(tone(2)).toBeUndefined();
    expect(status(2).textContent).toBe(jobsCopy.import.never);
    expect(status(6).textContent).toBe(jobsCopy.import.never);
    expect(status(10).textContent).toBe(jobsCopy.import.never);
    expect(status(11).textContent).toBe(jobsCopy.import.never);
    // Its name alone: how often it runs is the heading over it, and when, its foot.
    expect(cards[0].querySelector("h3")!.textContent).toBe(importRunsCopy.jobTitles["import-luma"]);
    expect(cards[1].querySelector("h3")!.textContent).toBe(importRunsCopy.jobTitles["read-gmail"]);
    expect(cards.some((card) => card.querySelector("h3 [class*=tag]"))).toBe(false);
  });

  it("shows an applied run, and one that changed nothing, in green, one discarded plainly, and one going in blue", async () => {
    const applied = ran("import-parliament", exampleImportResult, { status: "applied" });
    const discarded = ran("import-parliament", exampleImportResult, { status: "discarded" });
    const unchanged = ran("import-luma", exampleLumaResult, { status: "unchanged" });
    const { rerender } = await render(
      <ImportOverview running={[]} newest={[unchanged, undefined, undefined, undefined, applied]} now={NOW} />,
    );
    const tone = (i: number) =>
      document.querySelectorAll("section")[i].querySelector("[data-tone], [class*=state]")!.getAttribute("data-tone");
    expect(tone(0)).toBe("green");
    expect(tone(4)).toBe("green");
    await rerender(
      <ImportOverview running={[]} newest={[undefined, undefined, undefined, undefined, discarded]} now={NOW} />,
    );
    expect(tone(4)).toBeNull();
    await rerender(
      <ImportOverview
        now={NOW}
        newest={[undefined, undefined, undefined, undefined, applied]}
        running={[undefined, undefined, undefined, undefined, press]}
      />,
    );
    expect(tone(4)).toBe("blue");
    expect(document.body.textContent).toContain(jobsCopy.runs.status.running);
    expect(document.body.textContent).toContain(staffTime(press.startedAt));
  });
});

describe("ImportJobPage", () => {
  it("says when a run of it is going, a press or one of its schedule's", async () => {
    const props = { job: "import-parliament" as const, runs: [], run: vi.fn(), decide: vi.fn(), now: NOW };
    const { rerender } = await render(<ImportJobPage {...props} running={{ ...press, startedBy: NIGHTLY }} />);
    expect(document.body.textContent).toContain(jobsCopy.import.runningScheduled(staffTime(press.startedAt)));
    await rerender(<ImportJobPage {...props} running={press} />);
    expect(document.body.textContent).toContain(jobsCopy.import.running(press.startedBy, staffTime(press.startedAt)));
    await rerender(<ImportJobPage {...props} />);
    expect(document.body.textContent).not.toContain(press.startedBy);
  });

  it("can't be run again while a run of it is going", async () => {
    const props = { job: "import-parliament" as const, runs: [], run: vi.fn(), decide: vi.fn(), now: NOW };
    const button = page.getByRole("button", { name: politiciansCopy.politicianImports.importNow["import-parliament"] });
    const { rerender } = await render(<ImportJobPage {...props} running={press} />);
    await expect.element(button).toBeDisabled();
    await rerender(<ImportJobPage {...props} />);
    await expect.element(button).toBeEnabled();
  });

  it("says what each job does, linking where it reads from", async () => {
    /** The paragraph under the title of `job`'s page. */
    const about = async (job: ImportJob) => {
      const { container } = await render(
        <ImportJobPage job={job} runs={[]} run={vi.fn()} decide={vi.fn()} now={NOW} />,
      );
      return container.querySelector<HTMLParagraphElement>("[class*=subtitle]")!;
    };
    // In the overview's order, by schedule, as the checks below were written for its cards.
    const order = [...IMPORT_JOBS].sort(
      (x, y) => SCHEDULE_ORDER.indexOf(jobSchedule(x)) - SCHEDULE_ORDER.indexOf(jobSchedule(y)),
    );
    const cards: HTMLParagraphElement[] = [];
    for (const job of order) cards.push(await about(job));
    // Each body's import links its list and says what it holds.
    const link = (i: number) => cards[i].querySelector("a")!.getAttribute("href");
    expect(link(4)).toBe("https://data.parliament.uk/membersdataplatform/memberquery.aspx");
    expect(link(5)).toBe("https://data.parliament.scot/#/api-list/");
    expect(link(6)).toBe("https://business.senedd.wales/mgWebService.asmx");
    expect(link(7)).toBe("https://data.niassembly.gov.uk/members.asmx");
    expect(cards[4].textContent).toContain(politiciansCopy.politicianImports.held);
    expect(link(9)).toBe("https://controlai.org/statement");
    // ControlAI's imports link the ask they mark, the quotes around its name left out of the link.
    const askLinks = (i: number) =>
      [...cards[i].querySelectorAll("a")].slice(1).map((a) => [a.getAttribute("href"), a.textContent]);
    // A staff page in this tab, with no arrow; another site in a new one.
    const tabs = (i: number) => [...cards[i].querySelectorAll("a")].map((a) => [a.getAttribute("href"), a.target]);
    expect(tabs(8)).toEqual([
      ["https://controlai.org/uk-pm-letter", "_blank"],
      ["/staff/asks/controlai-letter", ""],
    ]);
    expect(askLinks(8)).toEqual([["/staff/asks/controlai-letter", "ControlAI's letter to the Prime Minister"]]);
    expect(askLinks(9)).toEqual([["/staff/asks/controlai-statement", "ControlAI's campaign statement"]]);
    expect(cards[9].textContent).toContain("“ControlAI's campaign statement”.");
    // The EDM's links the motion on Parliament's site, then its ask.
    expect(link(10)).toBe("https://edm.parliament.uk/early-day-motion/66900");
    expect(askLinks(10)).toEqual([["/staff/asks/superintelligence-edm", jobsCopy.edm.introThen.link]]);
    // CiviCRM's card links CiviCRM; Gmail's leads to where it's connected; the sending's to the campaigns' letters
    // and the mailings, the tidying's to the audit log, the mailings and the errors.
    expect(link(3)).toBe("https://crm.pauseai.info/");
    expect(link(1)).toBe("/staff/me");
    expect([...cards[2].querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
      "/staff/campaigns",
      "/staff/mailings",
      "/staff/broadcasts",
    ]);
    expect(cards[2].textContent).toBe(
      [
        jobsCopy.sending.intro.before,
        jobsCopy.sending.intro.link,
        jobsCopy.sending.intro.after,
        jobsCopy.sending.introThen.link,
        jobsCopy.sending.introThen.after,
        jobsCopy.sending.introLast.link,
        jobsCopy.sending.introLast.after,
      ].join(""),
    );
    // The press survey's links the Press page, where its finds wait.
    expect([...cards[11].querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["/staff/press"]);
    expect(cards[11].textContent).toBe(
      [pressCopy.job.intro.before, pressCopy.job.intro.link, pressCopy.job.intro.after].join(""),
    );
    expect([...cards[12].querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
      "/staff/audit-log",
      "/staff/mailings",
      "/staff/errors",
    ]);
    expect(cards[12].textContent).toBe(
      [
        jobsCopy.tidying.intro.before,
        jobsCopy.tidying.intro.link,
        jobsCopy.tidying.intro.after,
        jobsCopy.tidying.introThen.link,
        jobsCopy.tidying.introThen.after,
        jobsCopy.tidying.introLast.link,
        jobsCopy.tidying.introLast.after,
      ].join(""),
    );
  });

  it("names the job with its icon, says how it stands and when it runs, runs it, and lists every run by day", async () => {
    const run = vi.fn<RunJob>(async () => ({ ok: true }));
    const decide = vi.fn<Decide>(async () => ({ ok: true }));
    const runs: AnyImportRun[] = [
      exampleHeldImport,
      ran("import-parliament", exampleImportResult, {
        id: 1,
        at: new Date("2026-10-11T06:21:00Z"),
        status: "unchanged",
      }),
    ];
    const { rerender } = await render(
      <ImportJobPage job="import-parliament" runs={runs} run={run} decide={decide} now={NOW} />,
    );
    const band = () => document.querySelector("h1")!.closest("[class*=band]")!;
    // The band's facts, each its label and value.
    const facts = () =>
      [...band().querySelectorAll("dt")].map((dt) => [dt.textContent, dt.nextElementSibling!.textContent]);
    const head = band();
    expect(page.getByRole("heading", { level: 1 }).element().textContent).toBe(
      importRunsCopy.jobTitles["import-parliament"],
    );
    await expect.element(page.getByRole("img", { name: jobsCopy.import.parliament })).toBeVisible();
    expect(head.querySelector("[class*=tag]")).toBeNull();
    // Under the title, what it does; then how it stands, when it last ran, when it runs again, tomorrow morning, and
    // how often.
    expect(head.textContent).toContain(politiciansCopy.politicianImports.intros["import-parliament"].link);
    expect(head.querySelector("dd [data-tone]")!.getAttribute("data-tone")).toBe("amber");
    const said = jobsCopy.import.facts;
    expect(facts()).toEqual([
      [said.now, jobsCopy.runs.status.held],
      [said.lastRun, staffTime(exampleHeldImport.at)],
      [said.nextRun, jobsCopy.import.nextRunAt(staffVocabulary.dueIn.hours(19), "07:21")],
      [said.runs, jobsCopy.import.nightly],
    ]);
    // No strip under the band, with nothing running.
    expect(head.nextElementSibling?.querySelector("[data-strip]") ?? null).toBeNull();
    await page.getByRole("button", { name: politiciansCopy.politicianImports.importNow["import-parliament"] }).click();
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    expect(
      page
        .getByRole("heading", { level: 2 })
        .all()
        .map((h) => h.element().textContent),
    ).toEqual(["13 Oct 2026", "11 Oct 2026"]);
    await page.getByRole("button", { name: politiciansCopy.politicianImports.apply }).click();
    await vi.waitFor(() =>
      expect(decide.mock.calls.map(([form]) => Object.fromEntries(form))).toEqual([
        { id: "4", job: "import-parliament", decision: "apply" },
      ]),
    );

    await rerender(<ImportJobPage job="import-controlai-statement" runs={[]} run={run} decide={decide} now={NOW} />);
    await expect.element(page.getByText(jobsCopy.import.never)).toBeVisible();
    // Never run: nothing to say of how it stands or when it last ran.
    expect(facts()).toEqual([
      [jobsCopy.import.facts.nextRun, jobsCopy.import.nextRunAt(staffVocabulary.dueIn.hours(19), "07:26")],
      [jobsCopy.import.facts.runs, jobsCopy.import.nightly],
    ]);
    await expect.element(page.getByRole("img", { name: jobsCopy.import.controlai })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: jobsCopy.controlAiStatement.intro.link }))
      .toHaveAttribute("target", "_blank");
  });

  it("logs a press of the job's button, in its examples: with runs, with one going, and never run", async () => {
    const { rerender } = await render(<ImportJobPageExample />);
    await page.getByRole("button", { name: politiciansCopy.politicianImports.importNow["import-parliament"] }).click();
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
      .toHaveTextContent("run({})");
    await rerender(<ImportJobPageExample running="jo@pauseai.uk" />);
    await expect.element(page.getByText(/^Running, started by jo@pauseai\.uk/)).toBeVisible();
    await rerender(<ImportJobPageExample never />);
    await expect.element(page.getByText(jobsCopy.import.never)).toBeVisible();
  });
});
