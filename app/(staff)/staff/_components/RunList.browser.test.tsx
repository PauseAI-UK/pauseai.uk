import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { jobTitles, staffCopy } from "@/lib/content/staff-interface";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import {
  type AnyImportRun,
  type ControlAiImport,
  NEWER_RUN,
  type ControlAiStatementImport,
  type PoliticianImport,
} from "@/lib/import-runs";
import RunList from "./RunList";
import RunTable from "./RunTable";
import {
  exampleControlAiResult,
  exampleControlAiStatementResult,
  exampleFailedRun,
  exampleHeldImport,
  exampleImportResult,
  exampleLumaResult,
  exampleDisconnectedGmail,
  exampleGmailResult,
  exampleLettersInboxRead,
  exampleCivicrmResult,
  exampleRun,
  exampleSendingResult,
  exampleTidyingResult,
} from "./RunList.examples";
import { action, press } from "@/tests/browser/staff";
import { politiciansCopy } from "./politicians/copy";

const ran = exampleRun;

const failed = exampleFailedRun;

const AT = "15 Oct 2026, 02:00";

/** A colour token's hex as the browser computes it. */
const toRgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.trim().slice(i, i + 2), 16)).join(", ")})`;

describe("RunList", () => {
  const heldImport = exampleHeldImport;
  // An earlier import someone applied: one MP who left.
  const applied: PoliticianImport = ran(
    "import-parliament",
    {
      changes: {
        ...exampleImportResult.changes,
        left: [{ ...heldImport.result.changes.left[0], name: "Rob Removed" }],
      },
    },
    { id: 2, at: new Date("2026-10-11T06:21:00Z"), status: "applied", decidedBy: "jo@pauseai.uk" },
  );
  const controlAi = exampleControlAiResult;

  it("lists each import's changes, and lets a held one be applied or discarded", async () => {
    const { fn, sent } = action();
    const words = politiciansCopy.politicianImports;
    await render(<RunList runs={[heldImport, applied]} none="None" decide={fn} />);
    await expect.element(page.getByText(staffCopy.runs.status.held)).toBeVisible();
    await expect
      .element(page.getByText(words.result({ added: 2, changed: 1, left: 1 }), { exact: false }))
      .toBeVisible();
    // What a person should look at first: the names changed, then the seats no postcode finds.
    await expect.element(page.getByText("Dora Dummy → Dora Smith")).toBeVisible();
    await expect.element(page.getByText("Manchester Centre: Mo Example")).toBeVisible();
    await expect.element(page.getByText("Ipswich: Sam Newcomer", { exact: true })).toBeVisible();
    await expect
      .element(page.getByText(`${staffVocabulary.houses.lords}: Lord Example (${politiciansCopy.politicians.noEmail})`))
      .toBeVisible();
    await expect.element(page.getByText("Old Seat: Rita Retired")).toBeVisible();
    await expect.element(page.getByText("Polly Placeholder: party")).toBeVisible();
    await expect.element(page.getByText("Polly Placeholder: Polly → Ms Placeholder")).toBeVisible();
    // The earlier one, applied, has no buttons.
    await expect.element(page.getByText(staffCopy.runs.decidedBy("jo@pauseai.uk"), { exact: false })).toBeVisible();
    expect(page.getByRole("button", { name: words.apply }).all()).toHaveLength(1);
    await page.getByRole("button", { name: words.discard }).click();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ id: "4", job: "import-parliament", decision: "discard" });
  });

  it("starts an import with many changes folded to its status line, with the buttons still there", async () => {
    const big: PoliticianImport = ran(
      "import-parliament",
      {
        changes: {
          ...exampleImportResult.changes,
          added: [1, 2, 3, 4, 5, 6].map((n) => ({
            ...heldImport.result.changes.added[0],
            name: `MP ${n}`,
            constituency: `Seat ${n}`,
          })),
        },
      },
      { id: 9, status: "held" },
    );
    // The newest run starts unfolded, however long; the same run further down starts folded.
    await render(<RunList runs={[applied, big]} none="None" decide={() => {}} />);
    const folds = page.getByRole("group").all();
    expect(folds.map((fold) => (fold.element() as HTMLDetailsElement).open)).toEqual([true, false]);
    await expect.element(page.getByText("Seat 1: MP 1", { exact: true })).not.toBeVisible();
    await expect.element(page.getByRole("button", { name: politiciansCopy.politicianImports.apply })).toBeVisible();
    await page
      .getByText(politiciansCopy.politicianImports.result({ added: 6, changed: 0, left: 0 }), { exact: false })
      .click();
    await expect.element(page.getByText("Seat 1: MP 1", { exact: true })).toBeVisible();
  });

  it("lays out a job that runs often as a table a day: rows, a row for quiet runs, and older rows folded", async () => {
    const columns = staffCopy.luma.columns;
    const minutes = (n: number) => new Date(`2026-11-03T12:${String(59 - n).padStart(2, "0")}:00Z`);
    // The newest stopped short, so has more to do.
    const row = (id: number) =>
      ran(
        "import-luma",
        { ...exampleLumaResult, events: 100 + id, ...(id === 0 && { stoppedBy: "time" as const }) },
        { id, at: minutes(id) },
      );
    const quiet = (id: number) => ran("import-luma", exampleLumaResult, { id, at: minutes(id), status: "unchanged" });
    const { rerender } = await render(<RunList runs={Array.from({ length: 16 }, (_, i) => row(i))} none="None" />);
    // The newest is a tinted row of the day's table (amber: it has more to do), with nothing to fold; the rest are rows under one header.
    expect(document.querySelectorAll("section")).toHaveLength(1);
    expect(document.querySelector("section")!.closest("tr")!.className).toMatch(/amber/);
    expect(document.querySelector("section details")).toBeNull();
    const headings = () => [...document.querySelectorAll("th")].map((th) => th.textContent);
    expect(headings().filter((h) => h === columns.events)).toHaveLength(1);
    await expect.element(page.getByRole("cell", { name: "101", exact: true })).toBeVisible();
    const fold = page.getByText(`${staffCopy.runs.range("12:44", "12:46")}: ${staffCopy.runs.stretch(3)}`);
    await expect.element(fold).toBeVisible();
    await expect.element(page.getByText("115", { exact: true })).not.toBeVisible();
    await fold.click();
    await expect.element(page.getByText("115", { exact: true })).toBeVisible();
    // The opened stretch is a table of the same columns, with no header of its own.
    expect(document.querySelectorAll("table")).toHaveLength(2);
    expect(headings()).toHaveLength(7);
    await rerender(<RunList runs={[quiet(0), quiet(1), quiet(2)]} none="None" />);
    const range = page.getByRole("cell", { name: staffCopy.runs.range("12:57", "12:58") });
    await expect.element(range).toBeVisible();
    await expect.element(page.getByRole("cell", { name: staffCopy.runs.quiet(2) })).toBeVisible();
    expect(getComputedStyle(range.element()).color).toBe(
      toRgb(getComputedStyle(document.body).getPropertyValue("--muted")),
    );
  });

  it("puts a problem in the table as a tinted row of its counts with its words under them, a failure as one row", async () => {
    const luma = exampleLumaResult;
    const at = (n: number) => new Date(`2026-11-03T12:${String(50 - n * 5).padStart(2, "0")}:00Z`);
    await render(
      <RunList
        runs={[
          ran("import-luma", luma, { id: 1, at: at(0) }),
          ran("import-luma", { ...luma, stoppedBy: "rate-limit" }, { id: 2, at: at(1) }),
          failed("import-luma", "Luma answered 500", { id: 3, at: at(2) }),
          ran("import-luma", luma, { id: 4, at: at(3) }),
        ]}
        none="None"
      />,
    );
    const rows = page.getByRole("row").all();
    // The header, the newest's counts and its words, the problem's, the failure, the routine run.
    expect(rows).toHaveLength(7);
    const token = (name: string) => toRgb(getComputedStyle(document.body).getPropertyValue(name));
    const tint = (row: Element) => getComputedStyle(row.querySelector("td")!).backgroundColor;
    expect(rows.slice(1, 7).map((row) => tint(row.element()))).toEqual([
      token("--status-green-bg"),
      token("--status-green-bg"),
      token("--status-amber-bg"),
      token("--status-amber-bg"),
      token("--status-red-bg"),
      token("--table-stripe"),
    ]);
    await expect.element(rows[3].getByRole("cell", { name: "12:45" })).toBeVisible();
    // Its words leave out the time and the schedule, which the row says.
    expect(rows[4].element().textContent).toBe(
      `${staffCopy.runs.status.incomplete} · ${staffCopy.luma.result(luma)} ${staffCopy.luma.stoppedBy["rate-limit"]}`,
    );
    expect(rows[5].element().textContent).toBe(
      `12:40${staffCopy.runs.status.failed} · ${staffCopy.runs.error("Luma answered 500")}`,
    );
    expect(rows[4].element().querySelector("section")).not.toBeNull();
    expect(getComputedStyle(rows[4].element().querySelector("section")!).borderLeftWidth).toBe("0px");
  });

  it("tables an hourly job without counts under Time and what it found, saying who pressed it, and heads a day whose first rows are folded", async () => {
    const at = (day: number, hour: number) => new Date(`2026-11-0${day}T${String(hour).padStart(2, "0")}:00:00Z`);
    const { rerender } = await render(
      <RunList
        runs={[
          ran("import-civicrm", exampleCivicrmResult, { id: 1, at: at(3, 12) }),
          ran("import-civicrm", exampleCivicrmResult, { id: 2, at: at(3, 11), startedBy: "jo@pauseai.uk" }),
          ran("import-civicrm", exampleCivicrmResult, { id: 3, at: at(3, 10), status: "unchanged" }),
        ]}
        none="None"
      />,
    );
    expect([...document.querySelectorAll("th")].map((th) => th.textContent)).toEqual([
      staffCopy.runs.time,
      staffCopy.runs.found,
    ]);
    const pressed = page.getByRole("row").all()[2];
    expect(pressed.element().textContent).toBe(
      `11:00${staffCopy.runs.status.ok} · ${staffCopy.runs.by("jo@pauseai.uk")} · ${staffCopy.civicrm.result(exampleCivicrmResult)}`,
    );
    expect(pressed.element().className).toBe("");

    // Rows are counted across days, so a day can start with a folded stretch: the header goes on its first table shown.
    const luma = (id: number, at: Date) =>
      ran("import-luma", exampleLumaResult, { id, at, status: id === 99 ? "unchanged" : "ok" });
    await rerender(
      <RunList
        runs={[
          ...Array.from({ length: 14 }, (_, i) => luma(i, at(3, 23 - i))),
          luma(20, at(2, 23)),
          luma(99, at(2, 22)),
          luma(21, at(2, 21)),
        ]}
        none="None"
      />,
    );
    const tables = [...document.querySelectorAll("table")];
    expect(tables.map((t) => t.querySelectorAll("th").length)).toEqual([7, 0, 0, 7, 0]);
    expect(document.querySelectorAll("details")).toHaveLength(3);
  });

  it("keeps a failure plain further down on a job that runs rarely", async () => {
    await render(
      <RunList
        runs={[
          ran("import-parliament", exampleImportResult, { id: 1 }),
          failed("import-parliament", "boom", { id: 2 }),
        ]}
        none="None"
      />,
    );
    const [, second] = page.getByRole("status").all();
    expect(second.element().closest("section")!.parentElement!.className).toBe("");
    expect(getComputedStyle(second.element().closest("section")!).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  });

  it("shows Luma's and Gmail's routine runs as rows, a Gmail read's counts over every account", async () => {
    const luma = ran("import-luma", { ...exampleLumaResult, hostsChanged: undefined, guestsChanged: 77 }, { id: 1 });
    const rows = (...runs: AnyImportRun[]) => [{ shape: "rows" as const, runs }];
    const { rerender } = await render(<RunTable header entries={rows(luma)} />);
    await expect.element(page.getByRole("cell", { name: "77", exact: true })).toBeVisible();
    await rerender(
      <RunTable header entries={rows(ran("import-luma", { ...exampleLumaResult, hostsChanged: 55 }, { id: 2 }))} />,
    );
    await expect.element(page.getByRole("cell", { name: "55", exact: true })).toBeVisible();
    const account = (email: string, extra = {}) => ({
      account: email,
      replies: 0,
      autoReplies: 0,
      bounces: 0,
      ...extra,
    });
    const accounts = [
      account("silent@pauseai.uk"),
      account("joseph@pauseai.uk", { replies: 1 }),
      account("policy@pauseai.uk", { oneOffs: 2 }),
      account("write.to@pauseai.uk", { relayed: 3, spam: 0, uncertain: 0 }),
    ];
    await rerender(<RunTable header entries={rows(ran("read-gmail", { accounts }, { id: 3 }))} />);
    const cells = () => [...document.querySelectorAll("tbody td")].map((td) => td.textContent);
    expect(document.body.textContent).not.toContain("silent@pauseai.uk");
    // Replies, automatic replies, bounces, one-offs, relayed, spam: over the accounts, a count missing as 0.
    expect(cells().slice(1)).toEqual(["1", "0", "0", "2", "3", "0"]);
    // A table of counts keeps a width, scrolling on a phone; one column of words needs none.
    const table = () => page.getByRole("table").element() as HTMLElement;
    expect(getComputedStyle(table()).minWidth).not.toBe("0px");
    await rerender(
      <RunTable header entries={[{ shape: "run", runs: [ran("import-civicrm", exampleCivicrmResult, { id: 4 })] }]} />,
    );
    expect(getComputedStyle(table()).minWidth).toBe("0px");
  });

  it("unfolds only the newest runs, and while a press runs, not the newest one if it's long", async () => {
    const sync = (id: number, added: number[], at = new Date("2026-10-21T11:00:00Z")): PoliticianImport =>
      ran(
        "import-parliament",
        {
          changes: {
            ...exampleImportResult.changes,
            added: added.map((n) => ({ ...heldImport.result.changes.added[0], name: `MP ${n}` })),
          },
        },
        { id, at },
      );
    const opens = () =>
      page
        .getByRole("group")
        .all()
        .map((fold) => (fold.element() as HTMLDetailsElement).open);
    const short = [1, 2, 3, 4, 5, 6].map((id) => sync(id, [id]));
    const { rerender } = await render(<RunList runs={short} none="None" />);
    expect(opens()).toEqual([true, true, true, true, true, false]);
    const long = sync(7, [1, 2, 3, 4, 5, 6]);
    await rerender(<RunList runs={[long, ...short]} none="None" running={press} />);
    expect(opens().slice(0, 2)).toEqual([false, true]);
  });

  it("shows a failed or unchanged import as one line, and a held one without buttons where nothing can be decided", async () => {
    const unchanged: PoliticianImport = ran("import-parliament", exampleImportResult, { id: 5, status: "unchanged" });
    // One held earlier, replaced by the newer run.
    const replaced = ran("import-parliament", exampleImportResult, {
      id: 3,
      status: "discarded",
      decidedBy: NEWER_RUN,
    });
    await render(
      <RunList
        runs={[
          failed("import-parliament", "Parliament answered with status 422", { id: 6 }),
          unchanged,
          heldImport,
          replaced,
        ]}
        none="None"
      />,
    );
    await expect.element(page.getByText(staffCopy.runs.replaced, { exact: false })).toBeVisible();
    await expect.element(page.getByText(/status 422/)).toBeVisible();
    await expect.element(page.getByText(staffCopy.runs.status.unchanged)).toBeVisible();
    await expect.element(page.getByText(staffCopy.runs.status.held)).toBeVisible();
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
    expect(page.getByRole("button").all()).toHaveLength(0);
  });

  it("says what an import did, the constituencies with no MP, and why one failed", async () => {
    const runs: PoliticianImport[] = [
      ran("import-parliament", { ...exampleImportResult, vacant: ["Runcorn and Helsby"] }, { id: 2 }),
      failed("import-parliament", "Parliament returned 500", { id: 1 }),
    ];
    await render(<RunList runs={runs} none="None" />);
    const words = politiciansCopy.politicianImports;
    await expect.element(page.getByText(words.vacant(1), { exact: false })).toBeVisible();
    await expect.element(page.getByText(`${words.noMp} (1)`)).toBeVisible();
    await expect.element(page.getByText("Runcorn and Helsby")).toBeVisible();
    await expect.element(page.getByText(/Parliament returned 500/)).toBeVisible();
  });

  it("says what relinking the one-off emails did after an import, and the quotes it read and has still to read", async () => {
    const relinked = { read: 0, unread: 0, linked: 3, unlinked: 1, offices: 2 };
    const words = politiciansCopy.politicianImports;
    const run = (r: typeof relinked) => ran("import-senedd", { changes: exampleImportResult.changes, relinked: r });
    const { rerender } = await render(<RunList none="None" runs={[run(relinked)]} />);
    await expect.element(page.getByText(words.relinked(relinked), { exact: false })).toBeVisible();
    expect(words.relinked(relinked)).not.toContain("still to check");
    await rerender(<RunList none="None" runs={[run({ ...relinked, read: 40, unread: 700 })]} />);
    await expect.element(page.getByText(/700 older emails still to check/)).toBeVisible();
    expect(words.relinked({ ...relinked, unread: 5 })).toContain("5 older emails still to check");
  });

  it("says what a read of ControlAI's statement did", async () => {
    const runs: ControlAiStatementImport[] = [
      ran("import-controlai-statement", exampleControlAiStatementResult, { id: 2 }),
      failed("import-controlai-statement", "Only 0 supporters", { id: 1 }),
    ];
    await render(<RunList runs={runs} none="None" />);
    await expect
      .element(page.getByText(staffCopy.controlAiStatement.result(exampleControlAiStatementResult), { exact: false }))
      .toBeVisible();
    await expect.element(page.getByText(/Only 0 supporters/)).toBeVisible();
  });

  it("says what each ControlAI read did, and why one failed", async () => {
    const runs: ControlAiImport[] = [
      ran("import-controlai", controlAi, { id: 2 }),
      failed("import-controlai", "No PDF linked", { id: 1 }),
    ];
    await render(<RunList runs={runs} none="None" />);
    await expect.element(page.getByText(/86 names/)).toBeVisible();
    await expect.element(page.getByRole("table")).not.toBeInTheDocument();
    expect(page.getByText(staffCopy.runs.status.failed).element().closest("section")).toHaveTextContent(
      `${staffCopy.runs.status.failed} ${AT} · ${staffCopy.import.nightly} · ${staffCopy.runs.error("No PDF linked")}`,
    );
  });

  it("lists the names a ControlAI read couldn't place", async () => {
    await render(
      <RunList
        none="None"
        runs={[
          ran("import-controlai", {
            ...controlAi,
            problems: [
              { name: "Baroness Nobody", kind: "nobody", candidates: [] },
              { name: "Lord Sample", kind: "several", candidates: ["Lord Sample", "Lord Sample of Elsewhere"] },
            ],
          }),
        ]}
      />,
    );
    await expect.element(page.getByRole("cell", { name: "Baroness Nobody" })).toBeVisible();
    await expect.element(page.getByText(staffCopy.controlAi.kinds.nobody)).toBeVisible();
    await expect.element(page.getByText("Lord Sample, Lord Sample of Elsewhere")).toBeVisible();
  });

  it("says what a run did, who ran it, or why it failed", async () => {
    const runs: AnyImportRun[] = [
      ran("import-parliament", exampleImportResult, { id: 3, startedBy: "jo@pauseai.uk" }),
      failed("import-parliament", "Parliament answered 503", { id: 1, startedBy: null }),
    ];
    await render(<RunList runs={runs} none="None" />);
    const did = politiciansCopy.politicianImports.result({ added: 0, changed: 0, left: 0 });
    for (const words of [did, staffCopy.runs.error("Parliament answered 503")]) {
      await expect.element(page.getByText(words, { exact: false })).toBeVisible();
    }
    expect(page.getByText(staffCopy.runs.by("jo@pauseai.uk"), { exact: false }).all()).toHaveLength(1);
  });

  it("shows an hour's sending and a night's tidying as their counts, or why they failed", async () => {
    await render(
      <RunList
        runs={[
          ran("send-mailings", exampleSendingResult, { id: 4 }),
          ran("tidy-logs", exampleTidyingResult, { id: 3 }),
          failed("send-mailings", "Postmark answered 500", { id: 2 }),
          failed("tidy-logs", "Database down", { id: 1 }),
        ]}
        none="None"
      />,
    );
    await expect
      .element(page.getByText(staffCopy.sending.result(exampleSendingResult), { exact: false }))
      .toBeVisible();
    await expect
      .element(page.getByText(staffCopy.tidying.result(exampleTidyingResult), { exact: false }))
      .toBeVisible();
    await expect.element(page.getByText(staffCopy.runs.error("Postmark answered 500"), { exact: false })).toBeVisible();
    await expect.element(page.getByText(staffCopy.runs.error("Database down"), { exact: false })).toBeVisible();
  });

  it("shows a CiviCRM import's counts, or its error", async () => {
    await render(
      <RunList
        runs={[
          ran("import-civicrm", exampleCivicrmResult, { id: 1 }),
          failed("import-civicrm", "CiviCRM answered 503", { id: 2 }),
        ]}
        none="None"
      />,
    );
    const [first, second] = page.getByRole("status").all();
    await expect
      .element(first)
      .toHaveTextContent(`${staffCopy.runs.status.ok} · ${staffCopy.civicrm.result(exampleCivicrmResult)}`);
    await expect
      .element(second)
      .toHaveTextContent(`${staffCopy.runs.status.failed} · ${staffCopy.runs.error("CiviCRM answered 503")}`);
  });

  it("shows a Gmail read's totals, then each account, with one searched afresh and one that couldn't be read", async () => {
    const accounts = [{ ...exampleGmailResult.accounts[0], restarted: true }, exampleGmailResult.accounts[1]];
    const couldntRead = { what: staffCopy.problems.job.couldntRead(accounts[1].account), error: accounts[1].error! };
    await render(
      <RunList
        runs={[
          ran("read-gmail", { accounts }, { id: 2, problems: [couldntRead] }),
          failed("read-gmail", "Database down", { id: 1 }),
        ]}
        none="None"
      />,
    );
    await expect.element(page.getByText(staffCopy.gmailReading.result(accounts), { exact: false })).toBeVisible();
    // The one that couldn't read an account had problems; the other failed outright.
    expect(page.getByText(staffCopy.runs.status.problems, { exact: true }).all()).toHaveLength(1);
    expect(page.getByText(staffCopy.runs.status.failed, { exact: true }).all()).toHaveLength(1);
    await expect.element(page.getByText(staffCopy.runs.error("Database down"), { exact: false })).toBeVisible();
    await expect
      .element(page.getByText(`${staffCopy.gmailReading.account(accounts[0])} ${staffCopy.gmailReading.restarted}`))
      .toBeVisible();
    await expect
      .element(page.getByText(staffCopy.gmailReading.failed("Error: Gmail answered 500 for /history")))
      .toBeVisible();
  });

  it("says a Gmail read that disconnected an account had problems, and why, in place of its error", async () => {
    const accounts = [exampleGmailResult.accounts[0], exampleDisconnectedGmail];
    const told = { what: staffCopy.problems.job.couldntRead(exampleDisconnectedGmail.account), told: true as const };
    await render(<RunList runs={[ran("read-gmail", { accounts }, { id: 1, problems: [told] })]} none="None" />);
    await expect.element(page.getByText(staffCopy.runs.status.problems, { exact: true })).toBeVisible();
    await expect.element(page.getByText(staffCopy.gmailReading.result(accounts), { exact: false })).toBeVisible();
    await expect.element(page.getByText(staffCopy.gmailReading.disconnected, { exact: false })).toBeVisible();
    await expect.element(page.getByText(exampleDisconnectedGmail.error!, { exact: false })).not.toBeInTheDocument();
  });

  it("says what a Gmail read's search for added addresses found, and how many wait", async () => {
    const accounts = [exampleGmailResult.accounts[0]];
    const searched = { searched: 1, kept: 3, waiting: 0 };
    const { rerender } = await render(
      <RunList runs={[ran("read-gmail", { accounts, searched }, { id: 1 })]} none="None" />,
    );
    const total = staffCopy.gmailReading.result(accounts).replace(/\.?$/, ".");
    await expect
      .element(page.getByText(`${total} ${staffCopy.gmailReading.searched(searched)}`, { exact: false }))
      .toBeVisible();
    expect(staffCopy.gmailReading.searched(searched)).not.toContain("still to search");
    const waiting = { searched: 0, kept: 0, waiting: 2 };
    await rerender(<RunList runs={[ran("read-gmail", { accounts, searched: waiting }, { id: 1 })]} none="None" />);
    await expect.element(page.getByText(/2 still to search/)).toBeVisible();
    expect(staffCopy.gmailReading.searched({ ...waiting, stopped: { by: "time" } })).not.toBe(
      staffCopy.gmailReading.searched(waiting),
    );
  });

  it("says a Gmail read stopped as another was reading, and no totals", async () => {
    const stopped = { accounts: [], stoppedBy: "running" as const };
    await render(<RunList runs={[ran("read-gmail", stopped, { status: "unchanged" })]} none="None" />);
    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent(`${staffCopy.runs.status.unchanged} · ${staffCopy.luma.stoppedBy.running}`);
    expect(page.getByText(staffCopy.gmailReading.result([]), { exact: false }).query()).toBeNull();
  });

  it("says a Gmail read had problems that found mail in the letters inbox it couldn't account for, listing each with a link", async () => {
    const told = { what: staffCopy.problems.job.notUnderstood, error: "2", told: true as const };
    await render(
      <RunList
        runs={[ran("read-gmail", { accounts: [exampleLettersInboxRead] }, { id: 1, problems: [told] })]}
        none="None"
      />,
    );
    await expect.element(page.getByText(staffCopy.runs.status.problems, { exact: true })).toBeVisible();
    await expect
      .element(page.getByText(staffCopy.lettersInbox.result({ relayed: 4, spam: 2, uncertain: 1 }), { exact: false }))
      .toBeVisible();
    const links = page.getByRole("link", { name: staffCopy.lettersInbox.openInGmail });
    expect(links.all()).toHaveLength(2);
    await expect
      .element(links.first())
      .toHaveAttribute(
        "href",
        "https://mail.google.com/mail/?authuser=fixture-letters%40pauseai.uk#all/18c0ffee00000001",
      );
    await expect
      .element(
        page.getByText(`someone@example.com, “Hello”: ${staffCopy.lettersInbox.reasons.stranger}.`, { exact: false }),
      )
      .toBeVisible();
  });

  it("says how many hosts a Luma run changed and how many pages of contacts it read", async () => {
    await render(
      <RunList
        runs={[
          ran("import-luma", { ...exampleLumaResult, hostsChanged: 3, contactPages: 10, eventsTagged: 2 }, { id: 1 }),
        ]}
        none="None"
      />,
    );
    const [run] = page.getByRole("status").all();
    expect(run.element().textContent).toContain(
      `${staffCopy.luma.result(exampleLumaResult)} ${staffCopy.luma.hostsChanged(3)} ${staffCopy.luma.contactPages(10)} ${staffCopy.luma.eventsTagged(2)}`,
    );
    expect(run.element().textContent).toMatch(new RegExp(`^${staffCopy.runs.status.ok} `));
  });

  it("says how many postcodes and towns a Luma run looked up, and when postcodes.io failed", async () => {
    const places = { postcodes: 3, towns: 2, failed: false };
    const postcodesDown = { what: staffCopy.luma.placesFailed, error: "fetch failed (connect ECONNREFUSED)" };
    await render(
      <RunList
        runs={[
          ran("import-luma", { ...exampleLumaResult, places }, { id: 1 }),
          ran(
            "import-luma",
            { ...exampleLumaResult, places: { ...places, failed: true } },
            { id: 2, problems: [postcodesDown] },
          ),
        ]}
        none="None"
      />,
    );
    const [found, failed] = page.getByRole("status").all();
    expect(found.element().textContent).toContain(
      `${staffCopy.luma.result(exampleLumaResult)} ${staffCopy.luma.places(places)}`,
    );
    expect(found.element().textContent).not.toContain(staffCopy.luma.placesFailed);
    // What went wrong is under the line, with the error's own words muted after it.
    expect(failed.element().textContent).toMatch(new RegExp(`^${staffCopy.runs.status.problems} `));
    await expect.element(page.getByText(`${postcodesDown.what} ${postcodesDown.error}`)).toBeVisible();
  });

  it("shows a Luma import's counts, or its error", async () => {
    const luma = exampleLumaResult;
    await render(
      <RunList
        runs={[ran("import-luma", luma, { id: 1 }), failed("import-luma", "Luma answered 500", { id: 2 })]}
        none="None"
      />,
    );
    const [first, second] = page.getByRole("status").all();
    await expect.element(first).toHaveTextContent(`${staffCopy.runs.status.ok} · ${staffCopy.luma.result(luma)}`);
    expect(first.element().textContent).not.toContain(staffCopy.luma.stoppedBy.time);
    expect(first.element().textContent).not.toContain(staffCopy.runs.status.incomplete);
    await expect
      .element(second)
      .toHaveTextContent(`${staffCopy.runs.status.failed} · ${staffCopy.runs.error("Luma answered 500")}`);
    // The newest run is tinted by how it ended; a failure further down stays tinted on a job that runs this often.
    expect(first.element().closest("tr")!.className).toMatch(/green/);
    expect(second.element().closest("tr")!.className).toMatch(/red/);
  });

  it("says why a Luma import stopped early, as incomplete in place of done, tinted amber as the newest run", async () => {
    await render(
      <RunList runs={[ran("import-luma", { ...exampleLumaResult, stoppedBy: "rate-limit" })]} none="None" />,
    );
    const [only] = page.getByRole("status").all();
    await expect
      .element(only)
      .toHaveTextContent(
        `${staffCopy.runs.status.incomplete} · ${staffCopy.luma.result(exampleLumaResult)} ${staffCopy.luma.stoppedBy["rate-limit"]}`,
      );
    expect(only.element().closest("tr")!.className).toMatch(/amber/);
  });

  it("heads each day's runs with its date, and says when there are none", async () => {
    const runs: AnyImportRun[] = [
      ran("import-parliament", exampleImportResult, { id: 7, at: new Date("2026-11-03T01:00:00Z") }),
      ran("import-parliament", exampleImportResult, { id: 10, at: new Date("2026-11-03T00:17:00Z") }),
      ran("import-parliament", exampleImportResult, { id: 8, at: new Date("2026-11-02T02:00:00Z") }),
    ];
    const { rerender } = await render(<RunList runs={runs} none="None" />);
    expect(
      page
        .getByRole("heading", { level: 2 })
        .all()
        .map((h) => h.element().textContent),
    ).toEqual(["3 Nov 2026", "2 Nov 2026"]);
    // The page is one job's, so no run is labelled with it.
    await expect
      .element(page.getByText(`${jobTitles["import-parliament"]} ·`, { exact: false }))
      .not.toBeInTheDocument();
    await rerender(<RunList runs={[]} none="Nothing here" />);
    const before = ran(
      "import-luma",
      { ...exampleLumaResult, stoppedBy: "time" },
      { id: 1, at: new Date("2026-10-21T11:00:00Z") },
    );
    const during = ran("import-luma", exampleLumaResult, { id: 2, at: new Date("2026-10-21T11:48:00Z") });
    await rerender(<RunList runs={[before, during]} none="Nothing here" running={press} />);
    expect(document.querySelector("section")!.parentElement!.className).not.toMatch(/amber/);
  });
});
