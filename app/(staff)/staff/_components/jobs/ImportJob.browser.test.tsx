import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { NIGHTLY, type AnyImportRun } from "@/lib/import-runs";
import { staffTime } from "@/lib/staff-time";
import { ImportJobPage, ImportOverview } from "./ImportJob";
import {
  exampleFailedRun,
  exampleCivicrmResult,
  exampleHeldImport,
  exampleImportResult,
  exampleLumaResult,
  exampleRun,
} from "./RunList.examples";
import { action, press } from "@/tests/browser/staff";
import { politiciansCopy } from "../politicians/copy";
import { jobsCopy } from "./copy";
import { importRunsCopy } from "@/lib/import-runs-copy";

const ran = exampleRun;

const failed = exampleFailedRun;

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
    await render(<ImportOverview newest={newest} running={[]} />);
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
      importRunsCopy.jobTitles["tidy-logs"],
    ]);
    // Under the name, how the newest run ended, tinted to match.
    const status = (i: number) => cards[i].querySelector("h3")!.parentElement!.nextElementSibling!.firstElementChild!;
    expect(status(0).textContent).toBe(`${jobsCopy.runs.status.incomplete}21 Oct 2026, 11:17`);
    expect([0, 1, 3, 4, 5, 8].map((i) => status(i).className.match(/green|amber|red/)?.[0])).toEqual([
      "amber",
      "green",
      "green",
      "amber",
      "green",
      "red",
    ]);
    expect(status(2).className).not.toMatch(/green|amber|red/);
    expect(status(2).textContent).toBe(jobsCopy.sending.never);
    expect(status(6).textContent).toBe(politiciansCopy.politicianImports.never);
    expect(status(10).textContent).toBe(jobsCopy.tidying.never);
    // Each body's import links its list and says what it holds.
    const link = (i: number) => cards[i].querySelector(":scope > p a")!.getAttribute("href");
    expect(link(4)).toBe("https://data.parliament.uk/membersdataplatform/memberquery.aspx");
    expect(link(5)).toBe("https://data.parliament.scot/#/api-list/");
    expect(link(6)).toBe("https://business.senedd.wales/mgWebService.asmx");
    expect(link(7)).toBe("https://data.niassembly.gov.uk/members.asmx");
    expect(cards[4].querySelector(":scope > p")!.textContent).toContain(politiciansCopy.politicianImports.held);
    expect(link(9)).toBe("https://controlai.org/statement");
    // ControlAI's imports link the ask they mark, the quotes around its name left out of the link.
    const askLinks = (i: number) =>
      [...cards[i].querySelectorAll(":scope > p a")].slice(1).map((a) => [a.getAttribute("href"), a.textContent]);
    expect(askLinks(8)).toEqual([["/staff/asks/controlai-letter", "ControlAI's letter to the Prime Minister"]]);
    expect(askLinks(9)).toEqual([["/staff/asks/controlai-statement", "ControlAI's campaign statement"]]);
    expect(cards[9].querySelector(":scope > p")!.textContent).toContain("“ControlAI's campaign statement”.");
    // CiviCRM's card links CiviCRM; Gmail's leads to where it's connected; the sending's to the campaigns' letters
    // and the mailings, the tidying's to the audit log, the mailings and the errors.
    expect(link(3)).toBe("https://crm.pauseai.info/");
    expect(link(1)).toBe("/staff/me");
    expect([...cards[2].querySelectorAll(":scope > p a")].map((a) => a.getAttribute("href"))).toEqual([
      "/staff/campaigns",
      "/staff/mailings",
      "/staff/broadcasts",
    ]);
    expect(cards[2].querySelector(":scope > p")!.textContent).toBe(
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
    expect([...cards[10].querySelectorAll(":scope > p a")].map((a) => a.getAttribute("href"))).toEqual([
      "/staff/audit-log",
      "/staff/mailings",
      "/staff/errors",
    ]);
    expect(cards[10].querySelector(":scope > p")!.textContent).toBe(
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
    // After its name, what it does, unless it's an import; then, for the Luma import and reading Gmail, what they
    // change outside the site. Every lozenge plain.
    const kinds = jobsCopy.import.kinds;
    expect(cards[0].querySelector("h3")!.textContent).toBe(
      `${importRunsCopy.jobTitles["import-luma"]}${jobsCopy.import.changesLuma}`,
    );
    expect(cards[1].querySelector("h3")!.textContent).toBe(
      `${importRunsCopy.jobTitles["read-gmail"]}${kinds.read}${kinds.send}`,
    );
    expect(cards[3].querySelector("h3")!.textContent).toBe(importRunsCopy.jobTitles["import-civicrm"]);
    expect(
      cards
        .flatMap((card) => [...card.querySelectorAll("h3 > span")])
        .some((tag) => /green|amber|red|blue/.test(tag.className)),
    ).toBe(false);
    expect(cards[2].querySelector("h3")!.textContent).toBe(`${importRunsCopy.jobTitles["send-mailings"]}${kinds.send}`);
    expect(cards[4].querySelector("h3")!.textContent).toBe(importRunsCopy.jobTitles["import-parliament"]);
    expect(cards[10].querySelector("h3")!.textContent).toBe(`${importRunsCopy.jobTitles["tidy-logs"]}${kinds.tidy}`);
  });

  it("shows an applied run, and one that changed nothing, in green, and one discarded plainly", async () => {
    const applied = ran("import-parliament", exampleImportResult, { status: "applied" });
    const discarded = ran("import-parliament", exampleImportResult, { status: "discarded" });
    const unchanged = ran("import-luma", exampleLumaResult, { status: "unchanged" });
    const { rerender } = await render(
      <ImportOverview running={[]} newest={[unchanged, undefined, undefined, undefined, applied]} />,
    );
    const status = (i: number) =>
      document.querySelectorAll("section")[i].querySelector("h3")!.parentElement!.nextElementSibling!.firstElementChild!
        .className;
    expect(status(0)).toMatch(/green/);
    expect(status(4)).toMatch(/green/);
    await rerender(<ImportOverview running={[]} newest={[undefined, undefined, undefined, undefined, discarded]} />);
    expect(status(4)).not.toMatch(/green|amber|red/);
    await rerender(
      <ImportOverview
        newest={[undefined, undefined, undefined, undefined, applied]}
        running={[undefined, undefined, undefined, undefined, press]}
      />,
    );
    expect(status(4)).toMatch(/blue/);
    expect(document.body.textContent).toContain(jobsCopy.runs.status.running);
    expect(document.body.textContent).toContain(staffTime(press.startedAt));
  });
});

describe("ImportJobPage", () => {
  it("says when a run of it is going, a press or one of its schedule's", async () => {
    const props = { job: "import-parliament" as const, runs: [], run: vi.fn(), decide: vi.fn() };
    const { rerender } = await render(<ImportJobPage {...props} running={{ ...press, startedBy: NIGHTLY }} />);
    expect(document.body.textContent).toContain(jobsCopy.import.runningScheduled(staffTime(press.startedAt)));
    await rerender(<ImportJobPage {...props} running={press} />);
    expect(document.body.textContent).toContain(jobsCopy.import.running(press.startedBy, staffTime(press.startedAt)));
    await rerender(<ImportJobPage {...props} />);
    expect(document.body.textContent).not.toContain(press.startedBy);
  });

  it("names the job with its icons and schedule, runs it, and lists every run by day", async () => {
    const run = vi.fn();
    const { fn, sent } = action();
    const runs: AnyImportRun[] = [
      exampleHeldImport,
      ran("import-parliament", exampleImportResult, {
        id: 1,
        at: new Date("2026-10-11T06:21:00Z"),
        status: "unchanged",
      }),
    ];
    const { rerender } = await render(<ImportJobPage job="import-parliament" runs={runs} run={run} decide={fn} />);
    const head = page.getByRole("banner").element();
    expect(page.getByRole("heading", { level: 1 }).element().textContent).toBe(
      importRunsCopy.jobTitles["import-parliament"],
    );
    await expect.element(page.getByRole("img", { name: jobsCopy.import.parliament })).toBeVisible();
    // The schedule's lozenge is plain, and alone, as an import has none for what it does: only a run's ending is in
    // colour.
    const lozenges = [...head.querySelectorAll("h1 ~ span > span")];
    expect(lozenges.map((tag) => tag.textContent)).toEqual([jobsCopy.import.nightly]);
    expect(lozenges.map((tag) => tag.className.match(/green|amber|red|blue/))).toEqual([null]);
    // What it does is under the head, not in it.
    const intro = politiciansCopy.politicianImports.intros["import-parliament"];
    expect(head.textContent).not.toContain(intro.link);
    expect(head.nextElementSibling!.textContent).toContain(intro.link);
    // No strip under the head: the newest run, in the history, carries the colour.
    expect(head.nextElementSibling!.nextElementSibling!.querySelector(":scope > [data-strip]")).toBeNull();
    await page.getByRole("button", { name: politiciansCopy.politicianImports.importNow["import-parliament"] }).click();
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    expect(
      page
        .getByRole("heading", { level: 2 })
        .all()
        .map((h) => h.element().textContent),
    ).toEqual(["13 Oct 2026", "11 Oct 2026"]);
    await page.getByRole("button", { name: politiciansCopy.politicianImports.apply }).click();
    await vi.waitFor(() => expect(sent).toEqual([{ id: "4", job: "import-parliament", decision: "apply" }]));

    await rerender(<ImportJobPage job="import-controlai-statement" runs={[]} run={run} decide={fn} />);
    await expect.element(page.getByText(jobsCopy.controlAiStatement.never)).toBeVisible();
    await expect.element(page.getByRole("img", { name: jobsCopy.import.controlai })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: jobsCopy.controlAiStatement.intro.link }))
      .toHaveAttribute("target", "_blank");
  });
});
