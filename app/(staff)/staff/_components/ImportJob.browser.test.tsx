import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { NIGHTLY, type AnyImportRun } from "@/lib/import-runs";
import { staffTime } from "@/lib/staff-time";
import { jobTitles, staffCopy } from "@/lib/content/staff-interface";
import { ImportJobPage, ImportOverview } from "./ImportJob";
import {
  exampleAppliedSync,
  exampleEmailsResult,
  exampleFailedRun,
  exampleHeldSync,
  exampleLumaResult,
  exampleMembersResult,
  exampleRun,
  exampleWebFormResult,
} from "./RunList.examples";
import { action, press } from "@/tests/browser/staff";

const ran = exampleRun;

const failed = exampleFailedRun;

describe("ImportOverview", () => {
  it("is a card per job, each a link to its page, with how its newest run ended, or that it never ran", async () => {
    const newest: (AnyImportRun | undefined)[] = [
      undefined,
      ran("import-luma", { ...exampleLumaResult, stoppedBy: "time" }, { at: new Date("2026-10-21T11:17:00Z") }),
      ran("import-members", exampleMembersResult, { at: new Date("2026-10-21T11:47:00Z") }),
      ran("read-gmail", { accounts: [] }, { at: new Date("2026-10-21T11:20:00Z"), status: "unchanged" }),
      undefined,
      exampleHeldSync,
      ran("sync-emails", exampleEmailsResult, { at: new Date("2026-10-21T06:22:00Z") }),
      ran("check-mps", { problems: [] }, { at: new Date("2026-10-21T01:00:00Z"), status: "ok" }),
      failed("import-controlai", "No PDF linked", { at: new Date("2026-10-21T02:00:00Z") }),
      ran("import-web-form-letters", exampleWebFormResult, { at: new Date("2026-10-20T09:00:00Z") }),
      undefined,
      undefined,
    ];
    await render(
      <ImportOverview newest={newest} running={[]} airtableTable="https://airtable.com/app/tblPoliticians" />,
    );
    await expect.element(page.getByRole("heading", { level: 1, name: staffCopy.import.pageTitle })).toBeVisible();
    // A heading for each schedule, its jobs' cards under it.
    expect(
      page
        .getByRole("heading", { level: 2 })
        .all()
        .map((h) => h.element().textContent),
    ).toEqual([staffCopy.import.frequent, staffCopy.import.hourly, staffCopy.import.nightly, staffCopy.import.oneOff]);
    const cards = [...document.querySelectorAll("section")];
    expect(cards.map((card) => card.querySelector("h3 a")!.getAttribute("href"))).toEqual([
      "/staff/import-data/luma",
      "/staff/import-data/gmail",
      "/staff/import-data/members",
      "/staff/import-data/sending",
      "/staff/import-data/politicians",
      "/staff/import-data/mp-check",
      "/staff/import-data/controlai",
      "/staff/import-data/tidying",
      "/staff/import-data/old-letters",
      "/staff/import-data/emails",
      "/staff/import-data/web-form-letters",
    ]);
    expect(cards.map((card) => card.querySelector("h3 a")!.textContent)).toEqual([
      jobTitles["import-luma"],
      jobTitles["read-gmail"],
      jobTitles["import-members"],
      jobTitles["send-mailings"],
      jobTitles["sync-politicians"],
      jobTitles["check-mps"],
      jobTitles["import-controlai"],
      jobTitles["tidy-logs"],
      jobTitles["import-old-letters"],
      jobTitles["sync-emails"],
      jobTitles["import-web-form-letters"],
    ]);
    // Under the name, how the newest run ended, tinted to match.
    const status = (i: number) => cards[i].querySelector("h3")!.parentElement!.nextElementSibling!.firstElementChild!;
    expect(status(0).textContent).toBe(`${staffCopy.runs.status.incomplete}21 Oct 2026, 11:17`);
    expect([0, 1, 2, 4, 5, 6, 9, 10].map((i) => status(i).className.match(/green|amber|red/)?.[0])).toEqual([
      "amber",
      "green",
      "green",
      "amber",
      "green",
      "red",
      "green",
      "green",
    ]);
    expect(status(3).className).not.toMatch(/green|amber|red/);
    expect(status(3).textContent).toBe(staffCopy.sending.never);
    expect(status(7).textContent).toBe(staffCopy.tidying.never);
    // The Airtable jobs link the table they read; the politicians' sync also says the test MPs stay.
    const link = (i: number) => cards[i].querySelector(":scope > p a")!.getAttribute("href");
    expect(link(4)).toBe("https://airtable.com/app/tblPoliticians");
    expect(cards[4].querySelector(":scope > p")!.textContent).toContain(staffCopy.syncs.testMps);
    expect([9, 10].map(link)).toEqual([
      "https://airtable.com/app/tblp4nH5Jymq48rcm",
      "https://airtable.com/app/tblkzjrRHiZiqMDGR",
    ]);
    expect(cards[5].querySelector(":scope > p")!.textContent).not.toContain(staffCopy.syncs.testMps);
    // The members come from the join form; Gmail's card leads to where it's connected; the sending's to the campaigns'
    // letters and the mailings, the tidying's to the audit log and the mailings.
    expect(link(2)).toBe("https://pauseai.info/join");
    expect(link(1)).toBe("/staff/me");
    expect([...cards[3].querySelectorAll(":scope > p a")].map((a) => a.getAttribute("href"))).toEqual([
      "/staff/campaigns",
      "/staff/mailings",
    ]);
    expect(cards[3].querySelector(":scope > p")!.textContent).toBe(
      [
        staffCopy.sending.intro.before,
        staffCopy.sending.intro.link,
        staffCopy.sending.intro.after,
        staffCopy.sending.introThen.link,
        staffCopy.sending.introThen.after,
      ].join(""),
    );
    expect([...cards[7].querySelectorAll(":scope > p a")].map((a) => a.getAttribute("href"))).toEqual([
      "/staff/audit-log",
      "/staff/mailings",
    ]);
    // After its name, the MP check says it changes nothing, the sending and the Luma import that they act, the tidying that it's housekeeping.
    expect(cards[0].querySelector("h3")!.textContent).toBe(
      `${jobTitles["import-luma"]}${staffCopy.import.takesAction}`,
    );
    expect(cards[5].querySelector("h3")!.textContent).toBe(`${jobTitles["check-mps"]}${staffCopy.import.checkOnly}`);
    expect(cards[3].querySelector("h3")!.textContent).toBe(
      `${jobTitles["send-mailings"]}${staffCopy.import.takesAction}`,
    );
    expect(cards[7].querySelector("h3")!.textContent).toBe(`${jobTitles["tidy-logs"]}${staffCopy.import.siteAdmin}`);
    expect(cards[1].querySelector("h3")!.textContent).toBe(`${jobTitles["read-gmail"]}${staffCopy.import.takesAction}`);
    expect(cards[9].querySelector("h3")!.textContent).toBe(jobTitles["sync-emails"]);
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
        newest={[undefined, unchanged, undefined, undefined, undefined, exampleAppliedSync, undefined, undefined]}
        airtableTable="x"
      />,
    );
    const status = (i: number) =>
      document.querySelectorAll("section")[i].querySelector("h3")!.parentElement!.nextElementSibling!.firstElementChild!
        .className;
    expect(status(0)).toMatch(/green/);
    expect(status(4)).toMatch(/green/);
    await rerender(
      <ImportOverview
        running={[]}
        newest={[undefined, undefined, undefined, undefined, undefined, discarded, undefined, undefined]}
        airtableTable="x"
      />,
    );
    expect(status(4)).not.toMatch(/green|amber|red/);
    await rerender(
      <ImportOverview
        newest={[undefined, undefined, undefined, undefined, undefined, exampleAppliedSync, undefined, undefined]}
        running={[undefined, undefined, undefined, undefined, undefined, press]}
        airtableTable="x"
      />,
    );
    expect(status(4)).toMatch(/blue/);
    expect(document.body.textContent).toContain(staffCopy.runs.status.running);
    expect(document.body.textContent).toContain(staffTime(press.startedAt));
  });
});

describe("ImportJobPage", () => {
  it("says when a run of it is going, a press or one of its schedule's", async () => {
    const props = { job: "sync-emails" as const, runs: [], run: vi.fn(), decide: vi.fn(), airtableTable: "x" };
    const { rerender } = await render(<ImportJobPage {...props} running={{ ...press, startedBy: NIGHTLY }} />);
    expect(document.body.textContent).toContain(staffCopy.import.runningScheduled(staffTime(press.startedAt)));
    await rerender(<ImportJobPage {...props} running={press} />);
    expect(document.body.textContent).toContain(staffCopy.import.running(press.startedBy, staffTime(press.startedAt)));
    await rerender(<ImportJobPage {...props} />);
    expect(document.body.textContent).not.toContain(press.startedBy);
    expect(document.querySelector("progress")).toBeNull();
    await rerender(
      <ImportJobPage
        {...props}
        progress={{
          read: 1,
          left: 2,
          joined: 1,
          replies: 0,
          autoReplies: 0,
          oneOffs: 0,
          refusals: 0,
          byMailing: {},
          titles: {},
        }}
      />,
    );
    expect(document.querySelector("progress")).not.toBeNull();
  });

  it("leads back to the overview, names the job with its icons and schedule, runs it, and lists every run by day", async () => {
    const run = vi.fn();
    const { fn, sent } = action();
    const runs: AnyImportRun[] = [
      exampleHeldSync,
      exampleAppliedSync,
      ran(
        "sync-politicians",
        { changes: { added: [], removed: [], changed: [] } },
        { id: 1, at: new Date("2026-10-11T01:00:00Z"), status: "unchanged" },
      ),
    ];
    const { rerender } = await render(
      <ImportJobPage
        job="sync-politicians"
        runs={runs}
        run={run}
        decide={fn}
        airtableTable="https://airtable.com/table"
      />,
    );
    await expect
      .element(page.getByRole("navigation", { name: staffCopy.import.pageTitle }).getByRole("link"))
      .toHaveAttribute("href", "/staff/import-data");
    expect(page.getByRole("heading", { level: 1 }).element().textContent).toBe(
      `${jobTitles["sync-politicians"]}${staffCopy.import.nightly}`,
    );
    await expect.element(page.getByRole("img", { name: staffCopy.import.airtable })).toBeVisible();
    // The schedule's lozenge is plain: only a run's ending is in colour.
    const lozenges = [...page.getByRole("heading", { level: 1 }).element().querySelectorAll("span")];
    expect(lozenges.map((tag) => tag.className.match(/green|amber|red|blue/))).toEqual([null]);
    // No strip under the title: the newest run, in the history, carries the colour.
    const after = page.getByRole("heading", { level: 1 }).element().parentElement!.nextElementSibling!;
    expect(after.tagName).toBe("P");
    expect(after.className).toBe("");
    await page.getByRole("button", { name: staffCopy.syncs.syncNow }).click();
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    expect(
      page
        .getByRole("heading", { level: 2 })
        .all()
        .map((h) => h.element().textContent),
    ).toEqual(["12 Oct 2026", "11 Oct 2026"]);
    await page.getByRole("button", { name: staffCopy.syncs.apply }).click();
    await vi.waitFor(() => expect(sent).toEqual([{ id: "3", decision: "apply" }]));

    await rerender(<ImportJobPage job="check-mps" runs={[]} run={run} decide={fn} airtableTable="x" />);
    await expect.element(page.getByText(staffCopy.check.never)).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: staffCopy.check.intro.link }))
      .toHaveAttribute("target", "_blank");
  });
});
