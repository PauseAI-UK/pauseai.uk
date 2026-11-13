import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { NIGHTLY, type AnyImportRun } from "@/lib/import-runs";
import { staffTime } from "@/lib/staff-time";
import { jobTitles, staffCopy } from "@/lib/content/staff-interface";
import { ImportJobPage, ImportOverview } from "./ImportJob";
import {
  exampleAppliedSync,
  exampleFailedRun,
  exampleCivicrmResult,
  exampleHeldImport,
  exampleImportResult,
  exampleLumaResult,
  exampleRun,
} from "./RunList.examples";
import { action, press } from "@/tests/browser/staff";

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
      exampleAppliedSync,
      failed("import-controlai", "No PDF linked", { at: new Date("2026-10-21T02:00:00Z") }),
      undefined,
      undefined,
    ];
    await render(
      <ImportOverview newest={newest} running={[]} airtableTable="https://airtable.com/app/tblPoliticians" />,
    );
    await expect.element(page.getByRole("heading", { level: 1, name: staffCopy.import.pageTitle })).toBeVisible();
    // A heading for each schedule, its jobs' cards under it, those that run only when pressed last.
    expect(
      page
        .getByRole("heading", { level: 2 })
        .all()
        .map((h) => h.element().textContent),
    ).toEqual([
      staffCopy.import.frequent,
      staffCopy.import["quarter-hour"],
      staffCopy.import.hourly,
      staffCopy.import.nightly,
      staffCopy.import.manual,
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
      "/staff/scheduled-jobs/politicians",
    ]);
    expect(cards.map((card) => card.querySelector("h3 a")!.textContent)).toEqual([
      jobTitles["import-luma"],
      jobTitles["read-gmail"],
      jobTitles["send-mailings"],
      jobTitles["import-civicrm"],
      jobTitles["import-parliament"],
      jobTitles["import-scottish-parliament"],
      jobTitles["import-senedd"],
      jobTitles["import-ni-assembly"],
      jobTitles["import-controlai"],
      jobTitles["import-controlai-statement"],
      jobTitles["tidy-logs"],
      jobTitles["sync-politicians"],
    ]);
    // Under the name, how the newest run ended, tinted to match.
    const status = (i: number) => cards[i].querySelector("h3")!.parentElement!.nextElementSibling!.firstElementChild!;
    expect(status(0).textContent).toBe(`${staffCopy.runs.status.incomplete}21 Oct 2026, 11:17`);
    expect([0, 1, 3, 4, 5, 8, 11].map((i) => status(i).className.match(/green|amber|red/)?.[0])).toEqual([
      "amber",
      "green",
      "green",
      "amber",
      "green",
      "red",
      "green",
    ]);
    expect(status(2).className).not.toMatch(/green|amber|red/);
    expect(status(2).textContent).toBe(staffCopy.sending.never);
    expect(status(6).textContent).toBe(staffCopy.politicianImports.never);
    expect(status(10).textContent).toBe(staffCopy.tidying.never);
    // Each body's import links its list and says what it holds; the copy from Airtable links the table it reads.
    const link = (i: number) => cards[i].querySelector(":scope > p a")!.getAttribute("href");
    expect(link(4)).toContain("data.parliament.uk/membersdataplatform");
    expect(link(6)).toBe("https://business.senedd.wales/mgwebservice.asmx/GetCouncillorsByWard");
    expect(cards[4].querySelector(":scope > p")!.textContent).toContain(staffCopy.politicianImports.held);
    expect(link(9)).toBe("https://controlai.org/statement");
    expect(link(11)).toBe("https://airtable.com/app/tblPoliticians");
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
        staffCopy.sending.intro.before,
        staffCopy.sending.intro.link,
        staffCopy.sending.intro.after,
        staffCopy.sending.introThen.link,
        staffCopy.sending.introThen.after,
        staffCopy.sending.introLast.link,
        staffCopy.sending.introLast.after,
      ].join(""),
    );
    expect([...cards[10].querySelectorAll(":scope > p a")].map((a) => a.getAttribute("href"))).toEqual([
      "/staff/audit-log",
      "/staff/mailings",
      "/staff/errors",
    ]);
    expect(cards[10].querySelector(":scope > p")!.textContent).toBe(
      [
        staffCopy.tidying.intro.before,
        staffCopy.tidying.intro.link,
        staffCopy.tidying.intro.after,
        staffCopy.tidying.introThen.link,
        staffCopy.tidying.introThen.after,
        staffCopy.tidying.introLast.link,
        staffCopy.tidying.introLast.after,
      ].join(""),
    );
    // After its name, what it does, unless it's an import; then, for the Luma import and reading Gmail, what they
    // change outside the site. Every lozenge plain.
    const kinds = staffCopy.import.kinds;
    expect(cards[0].querySelector("h3")!.textContent).toBe(
      `${jobTitles["import-luma"]}${staffCopy.import.changesLuma}`,
    );
    expect(cards[1].querySelector("h3")!.textContent).toBe(`${jobTitles["read-gmail"]}${kinds.read}${kinds.send}`);
    expect(cards[3].querySelector("h3")!.textContent).toBe(jobTitles["import-civicrm"]);
    expect(
      cards
        .flatMap((card) => [...card.querySelectorAll("h3 > span")])
        .some((tag) => /green|amber|red|blue/.test(tag.className)),
    ).toBe(false);
    expect(cards[2].querySelector("h3")!.textContent).toBe(`${jobTitles["send-mailings"]}${kinds.send}`);
    expect(cards[4].querySelector("h3")!.textContent).toBe(jobTitles["import-parliament"]);
    expect(cards[10].querySelector("h3")!.textContent).toBe(`${jobTitles["tidy-logs"]}${kinds.tidy}`);
  });

  it("shows an applied run, and one that changed nothing, in green, and one discarded plainly", async () => {
    const discarded = ran(
      "sync-politicians",
      { changes: { added: [], removed: [], changed: [] } },
      { status: "discarded" },
    );
    const unchanged = ran("import-luma", exampleLumaResult, { status: "unchanged" });
    const { rerender } = await render(
      <ImportOverview
        running={[]}
        newest={[unchanged, undefined, undefined, exampleAppliedSync, undefined, undefined]}
        airtableTable="x"
      />,
    );
    const status = (i: number) =>
      document.querySelectorAll("section")[i].querySelector("h3")!.parentElement!.nextElementSibling!.firstElementChild!
        .className;
    expect(status(0)).toMatch(/green/);
    expect(status(2)).toMatch(/green/);
    await rerender(
      <ImportOverview
        running={[]}
        newest={[undefined, undefined, undefined, discarded, undefined, undefined]}
        airtableTable="x"
      />,
    );
    expect(status(2)).not.toMatch(/green|amber|red/);
    await rerender(
      <ImportOverview
        newest={[undefined, undefined, undefined, exampleAppliedSync, undefined, undefined]}
        running={[undefined, undefined, undefined, press]}
        airtableTable="x"
      />,
    );
    expect(status(2)).toMatch(/blue/);
    expect(document.body.textContent).toContain(staffCopy.runs.status.running);
    expect(document.body.textContent).toContain(staffTime(press.startedAt));
  });
});

describe("ImportJobPage", () => {
  it("says when a run of it is going, a press or one of its schedule's", async () => {
    const props = { job: "import-parliament" as const, runs: [], run: vi.fn(), decide: vi.fn(), airtableTable: "x" };
    const { rerender } = await render(<ImportJobPage {...props} running={{ ...press, startedBy: NIGHTLY }} />);
    expect(document.body.textContent).toContain(staffCopy.import.runningScheduled(staffTime(press.startedAt)));
    await rerender(<ImportJobPage {...props} running={press} />);
    expect(document.body.textContent).toContain(staffCopy.import.running(press.startedBy, staffTime(press.startedAt)));
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
    const { rerender } = await render(
      <ImportJobPage
        job="import-parliament"
        runs={runs}
        run={run}
        decide={fn}
        airtableTable="https://airtable.com/table"
      />,
    );
    const head = page.getByRole("banner").element();
    expect(page.getByRole("heading", { level: 1 }).element().textContent).toBe(jobTitles["import-parliament"]);
    await expect.element(page.getByRole("img", { name: staffCopy.import.parliament })).toBeVisible();
    // The schedule's lozenge is plain, and alone, as an import has none for what it does: only a run's ending is in
    // colour.
    const lozenges = [...head.querySelectorAll("h1 ~ span > span")];
    expect(lozenges.map((tag) => tag.textContent)).toEqual([staffCopy.import.nightly]);
    expect(lozenges.map((tag) => tag.className.match(/green|amber|red|blue/))).toEqual([null]);
    // What it does is under the head, not in it.
    const intro = staffCopy.politicianImports.intros["import-parliament"];
    expect(head.textContent).not.toContain(intro.link);
    expect(head.nextElementSibling!.textContent).toContain(intro.link);
    // No strip under the head: the newest run, in the history, carries the colour.
    expect(head.nextElementSibling!.nextElementSibling!.querySelector(":scope > [data-strip]")).toBeNull();
    await page.getByRole("button", { name: staffCopy.politicianImports.importNow }).click();
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    expect(
      page
        .getByRole("heading", { level: 2 })
        .all()
        .map((h) => h.element().textContent),
    ).toEqual(["13 Oct 2026", "11 Oct 2026"]);
    await page.getByRole("button", { name: staffCopy.politicianImports.apply }).click();
    await vi.waitFor(() => expect(sent).toEqual([{ id: "4", job: "import-parliament", decision: "apply" }]));

    await rerender(<ImportJobPage job="sync-politicians" runs={[]} run={run} decide={fn} airtableTable="x" />);
    await expect.element(page.getByText(staffCopy.syncs.none)).toBeVisible();
    await expect.element(page.getByRole("img", { name: staffCopy.import.airtable })).toBeVisible();
    expect(
      [...page.getByRole("banner").element().querySelectorAll("h1 ~ span > span")].map((tag) => tag.textContent),
    ).toEqual([staffCopy.import.manual]);
    await expect
      .element(page.getByRole("link", { name: staffCopy.syncs.intro.link }))
      .toHaveAttribute("target", "_blank");
  });
});
