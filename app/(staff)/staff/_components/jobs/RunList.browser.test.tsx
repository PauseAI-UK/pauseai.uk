import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import {
  type AnyImportRun,
  type ControlAiImport,
  NEWER_RUN,
  type ControlAiStatementImport,
  type EdmImport,
  type PoliticianImport,
} from "@/lib/import-runs";
import RunList from "./RunList";
import {
  exampleControlAiResult,
  exampleControlAiStatementResult,
  exampleEdmResult,
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
import { importRunsCopy } from "@/lib/import-runs-copy";
import { supporterProblems } from "@/lib/supporters/copy";
import { jobProblems } from "@/lib/jobs/copy";
import { lettersCopy } from "../letters/copy";
import { jobsCopy } from "./copy";
import { politiciansCopy } from "../politicians/copy";
import { staffAccount } from "@/lib/problems";

const ran = exampleRun;

const failed = exampleFailedRun;

/** A colour token's hex as the browser computes it. */
const toRgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.trim().slice(i, i + 2), 16)).join(", ")})`;

/** Each run's row, as its words read: the time, how it ended, then what it found. */
const rowsText = () =>
  [...document.querySelectorAll("section")].map((run) => run.querySelector("[class*=row]")!.textContent);

/** The colour of each run's dot, by how it ended. */
const tones = () => [...document.querySelectorAll("section [data-tone]")].map((dot) => dot.getAttribute("data-tone"));

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
    await expect.element(page.getByText(jobsCopy.runs.status.held)).toBeVisible();
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
    await expect.element(page.getByText(jobsCopy.runs.decidedBy("jo@pauseai.uk"), { exact: false })).toBeVisible();
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

  it("lays out a job that runs often a row a run, quiet runs in a row, and routine runs further down folded", async () => {
    const minutes = (n: number) => new Date(`2026-11-03T12:${String(59 - n).padStart(2, "0")}:00Z`);
    // The newest stopped short, so has more to do.
    const result = (id: number) => ({
      ...exampleLumaResult,
      events: 100 + id,
      ...(id === 0 && { stoppedBy: "time" as const }),
    });
    const row = (id: number) => ran("import-luma", result(id), { id, at: minutes(id) });
    const quiet = (id: number) => ran("import-luma", exampleLumaResult, { id, at: minutes(id), status: "unchanged" });
    const { rerender } = await render(<RunList runs={Array.from({ length: 16 }, (_, i) => row(i))} none="None" />);
    // The newest and the twelve after it a row each, the three further down folded into one.
    const fold = page.getByText(jobsCopy.runs.stretch(3));
    await expect.element(fold).toBeVisible();
    expect(fold.element().closest("summary")!.textContent).toBe(
      `${jobsCopy.runs.range("12:44", "12:46")}${jobsCopy.runs.stretch(3)}`,
    );
    const folded = page.getByText(jobsCopy.luma.result(result(15)), { exact: false });
    await expect.element(page.getByText(jobsCopy.luma.result(result(12)), { exact: false })).toBeVisible();
    await expect.element(folded).not.toBeVisible();
    await fold.click();
    await expect.element(folded).toBeVisible();
    await rerender(<RunList runs={[quiet(0), quiet(1), quiet(2)]} none="None" />);
    // The newest, though it found nothing, is the job's state: a row of its own.
    const range = page.getByText(jobsCopy.runs.range("12:57", "12:58"), { exact: true });
    await expect.element(range).toBeVisible();
    await expect.element(page.getByText(jobsCopy.runs.quiet(2))).toBeVisible();
    expect(getComputedStyle(range.element()).color).toBe(
      toRgb(getComputedStyle(document.body).getPropertyValue("--muted")),
    );
  });

  it("marks each run by how it ended, a dot of its colour, and says why a run stopped short or failed", async () => {
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
    expect(tones()).toEqual(["green", "amber", "red", "green"]);
    expect(rowsText().slice(1, 3)).toEqual([
      `12:45${jobsCopy.runs.status.incomplete}${jobsCopy.luma.result(luma)} ${jobsCopy.luma.stoppedBy["rate-limit"]}`,
      `12:40${jobsCopy.runs.status.failed}${jobsCopy.runs.error("Luma answered 500")}`,
    ]);
    const dot = (i: number) => getComputedStyle(document.querySelectorAll("section [data-tone]")[i]).color;
    const token = (name: string) => toRgb(getComputedStyle(document.body).getPropertyValue(name));
    expect([0, 1, 2].map(dot)).toEqual([token("--status-green"), token("--status-amber"), token("--status-red")]);
  });

  it("says who pressed a run, and folds routine runs counted across days, a day starting with a fold", async () => {
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
    expect(rowsText()[1]).toBe(
      `11:00${jobsCopy.runs.status.ok}${jobsCopy.civicrm.result(exampleCivicrmResult)} · ${jobsCopy.runs.by("jo@pauseai.uk")}`,
    );
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
    // One fold at the end of the first day, and the second day's two either side of its quiet run.
    expect(document.querySelectorAll("details")).toHaveLength(3);
    expect(document.querySelectorAll("h2 + * > :first-child")[1].tagName).toBe("DETAILS");
  });

  it("unfolds only the newest run, and none while a press runs", async () => {
    const sync = (id: number): PoliticianImport =>
      ran(
        "import-parliament",
        { changes: { ...exampleImportResult.changes, added: [{ ...heldImport.result.changes.added[0], name: "MP" }] } },
        { id, at: new Date("2026-10-21T11:00:00Z") },
      );
    const opens = () =>
      page
        .getByRole("group")
        .all()
        .map((fold) => (fold.element() as HTMLDetailsElement).open);
    const runs = [1, 2, 3].map(sync);
    const { rerender } = await render(<RunList runs={runs} none="None" />);
    expect(opens()).toEqual([true, false, false]);
    await rerender(<RunList runs={runs} none="None" running={press} />);
    expect(opens()).toEqual([false, false, false]);
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
    await expect.element(page.getByText(jobsCopy.runs.replaced, { exact: false })).toBeVisible();
    await expect.element(page.getByText(/status 422/)).toBeVisible();
    await expect.element(page.getByText(jobsCopy.runs.status.unchanged)).toBeVisible();
    await expect.element(page.getByText(jobsCopy.runs.status.held)).toBeVisible();
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
      .element(page.getByText(jobsCopy.controlAiStatement.result(exampleControlAiStatementResult), { exact: false }))
      .toBeVisible();
    await expect.element(page.getByText(/Only 0 supporters/)).toBeVisible();
  });

  it("says what a read of the EDM did, and why one failed", async () => {
    const runs: EdmImport[] = [
      ran("import-edm", exampleEdmResult, { id: 2 }),
      failed("import-edm", "No one has signed the EDM", { id: 1 }),
    ];
    await render(<RunList runs={runs} none="None" />);
    await expect.element(page.getByText(jobsCopy.edm.result(exampleEdmResult), { exact: false })).toBeVisible();
    await expect.element(page.getByText(/No one has signed the EDM/)).toBeVisible();
  });

  it("says what each ControlAI read did, and why one failed", async () => {
    const runs: ControlAiImport[] = [
      ran("import-controlai", controlAi, { id: 2 }),
      failed("import-controlai", "No PDF linked", { id: 1 }),
    ];
    await render(<RunList runs={runs} none="None" />);
    await expect.element(page.getByText(/86 names/)).toBeVisible();
    await expect.element(page.getByRole("table")).not.toBeInTheDocument();
    expect(rowsText()[1]).toBe(`03:00${jobsCopy.runs.status.failed}${jobsCopy.runs.error("No PDF linked")}`);
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
    await expect.element(page.getByText(jobsCopy.controlAi.kinds.nobody)).toBeVisible();
    await expect.element(page.getByText("Lord Sample, Lord Sample of Elsewhere")).toBeVisible();
  });

  it("says what a run did, who ran it, or why it failed", async () => {
    const runs: AnyImportRun[] = [
      ran("import-parliament", exampleImportResult, { id: 3, startedBy: "jo@pauseai.uk" }),
      failed("import-parliament", "Parliament answered 503", { id: 1, startedBy: null }),
    ];
    await render(<RunList runs={runs} none="None" />);
    const did = politiciansCopy.politicianImports.result({ added: 0, changed: 0, left: 0 });
    for (const words of [did, jobsCopy.runs.error("Parliament answered 503")]) {
      await expect.element(page.getByText(words, { exact: false })).toBeVisible();
    }
    expect(page.getByText(jobsCopy.runs.by("jo@pauseai.uk"), { exact: false }).all()).toHaveLength(1);
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
    await expect.element(page.getByText(jobsCopy.sending.result(exampleSendingResult), { exact: false })).toBeVisible();
    await expect.element(page.getByText(jobsCopy.tidying.result(exampleTidyingResult), { exact: false })).toBeVisible();
    await expect.element(page.getByText(jobsCopy.runs.error("Postmark answered 500"), { exact: false })).toBeVisible();
    await expect.element(page.getByText(jobsCopy.runs.error("Database down"), { exact: false })).toBeVisible();
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
    expect(rowsText()).toEqual([
      `03:00${jobsCopy.runs.status.ok}${jobsCopy.civicrm.result(exampleCivicrmResult)}`,
      `03:00${jobsCopy.runs.status.failed}${jobsCopy.runs.error("CiviCRM answered 503")}`,
    ]);
  });

  it("shows a Gmail read's totals, then each account, with one searched afresh and one that couldn't be read", async () => {
    const accounts = [{ ...exampleGmailResult.accounts[0], restarted: true }, exampleGmailResult.accounts[1]];
    const couldntRead = {
      ...jobProblems.couldntRead({ account: staffAccount(accounts[1].account) }),
      said: accounts[1].error!,
    };
    await render(
      <RunList
        runs={[
          ran("read-gmail", { accounts }, { id: 2, problems: [couldntRead] }),
          failed("read-gmail", "Database down", { id: 1 }),
        ]}
        none="None"
      />,
    );
    await expect.element(page.getByText(jobsCopy.gmailReading.result(accounts), { exact: false })).toBeVisible();
    // The one that couldn't read an account had problems; the other failed outright.
    expect(page.getByText(jobsCopy.runs.status.problems, { exact: true }).all()).toHaveLength(1);
    expect(page.getByText(jobsCopy.runs.status.failed, { exact: true }).all()).toHaveLength(1);
    await expect.element(page.getByText(jobsCopy.runs.error("Database down"), { exact: false })).toBeVisible();
    await expect
      .element(page.getByText(`${jobsCopy.gmailReading.account(accounts[0])} ${jobsCopy.gmailReading.restarted}`))
      .toBeVisible();
    await expect
      .element(page.getByText(jobsCopy.gmailReading.failed("Error: Gmail answered 500 for /history")))
      .toBeVisible();
  });

  it("says a Gmail read that disconnected an account had problems, and why, in place of its error", async () => {
    const accounts = [exampleGmailResult.accounts[0], exampleDisconnectedGmail];
    const told = {
      ...jobProblems.couldntRead({ account: staffAccount(exampleDisconnectedGmail.account) }),
      told: true as const,
    };
    await render(<RunList runs={[ran("read-gmail", { accounts }, { id: 1, problems: [told] })]} none="None" />);
    await expect.element(page.getByText(jobsCopy.runs.status.problems, { exact: true })).toBeVisible();
    await expect.element(page.getByText(jobsCopy.gmailReading.result(accounts), { exact: false })).toBeVisible();
    await expect.element(page.getByText(jobsCopy.gmailReading.disconnected, { exact: false })).toBeVisible();
    await expect.element(page.getByText(exampleDisconnectedGmail.error!, { exact: false })).not.toBeInTheDocument();
  });

  it("says what a Gmail read's search for added addresses found, and how many wait", async () => {
    const accounts = [exampleGmailResult.accounts[0]];
    const searched = { searched: 1, kept: 3, waiting: 0 };
    const { rerender } = await render(
      <RunList runs={[ran("read-gmail", { accounts, searched }, { id: 1 })]} none="None" />,
    );
    const total = jobsCopy.gmailReading.result(accounts).replace(/\.?$/, ".");
    await expect
      .element(page.getByText(`${total} ${jobsCopy.gmailReading.searched(searched)}`, { exact: false }))
      .toBeVisible();
    expect(jobsCopy.gmailReading.searched(searched)).not.toContain("still to search");
    const waiting = { searched: 0, kept: 0, waiting: 2 };
    await rerender(<RunList runs={[ran("read-gmail", { accounts, searched: waiting }, { id: 1 })]} none="None" />);
    await expect.element(page.getByText(/2 still to search/)).toBeVisible();
    expect(jobsCopy.gmailReading.searched({ ...waiting, stopped: { by: "time" } })).not.toBe(
      jobsCopy.gmailReading.searched(waiting),
    );
  });

  it("says a Gmail read stopped as another was reading, and no totals", async () => {
    const stopped = { accounts: [], stoppedBy: "running" as const };
    await render(<RunList runs={[ran("read-gmail", stopped, { status: "unchanged" })]} none="None" />);
    expect(rowsText()).toEqual([`03:00${jobsCopy.runs.status.unchanged}${jobsCopy.luma.stoppedBy.running}`]);
    expect(page.getByText(jobsCopy.gmailReading.result([]), { exact: false }).query()).toBeNull();
  });

  it("says a Gmail read had problems that found mail in the letters inbox it couldn't account for, listing each with a link", async () => {
    const told = { ...jobProblems.notUnderstood({ count: 2 }), told: true as const };
    await render(
      <RunList
        runs={[ran("read-gmail", { accounts: [exampleLettersInboxRead] }, { id: 1, problems: [told] })]}
        none="None"
      />,
    );
    await expect.element(page.getByText(jobsCopy.runs.status.problems, { exact: true })).toBeVisible();
    await expect
      .element(page.getByText(lettersCopy.lettersInbox.result({ relayed: 4, spam: 2, uncertain: 1 }), { exact: false }))
      .toBeVisible();
    const links = page.getByRole("link", { name: lettersCopy.lettersInbox.openInGmail });
    expect(links.all()).toHaveLength(2);
    await expect
      .element(links.first())
      .toHaveAttribute(
        "href",
        "https://mail.google.com/mail/?authuser=fixture-letters%40pauseai.uk#all/18c0ffee00000001",
      );
    await expect
      .element(
        page.getByText(`someone@example.com, “Hello”: ${lettersCopy.lettersInbox.reasons.stranger}.`, { exact: false }),
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
    const [run] = rowsText();
    expect(run).toContain(
      `${jobsCopy.luma.result(exampleLumaResult)} ${jobsCopy.luma.hostsChanged(3)} ${jobsCopy.luma.contactPages(10)} ${jobsCopy.luma.eventsTagged(2)}`,
    );
    expect(run).toMatch(new RegExp(`^03:00${jobsCopy.runs.status.ok}`));
  });

  it("says how many postcodes and towns a Luma run looked up, and when postcodes.io failed", async () => {
    const places = { postcodes: 3, towns: 2, failed: false };
    // Kept before problems had codes: its sentence, and the error's words as `error`.
    const postcodesDown = { what: supporterProblems.placesFailed().what, error: "fetch failed (connect ECONNREFUSED)" };
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
    const [found, failed] = rowsText();
    expect(found).toContain(`${jobsCopy.luma.result(exampleLumaResult)} ${jobsCopy.luma.places(places)}`);
    expect(found).not.toContain(supporterProblems.placesFailed().what);
    // What went wrong is under the words, in amber, with the error's own words muted after it.
    expect(failed).toMatch(new RegExp(`^03:00${jobsCopy.runs.status.problems}`));
    const problem = page.getByText(`${postcodesDown.what} ${postcodesDown.error}`);
    await expect.element(problem).toBeVisible();
    expect(getComputedStyle(problem.element()).color).toBe(
      toRgb(getComputedStyle(document.body).getPropertyValue("--status-amber")),
    );
  });

  it("shows a Luma import's counts, or its error", async () => {
    const luma = exampleLumaResult;
    await render(
      <RunList
        runs={[ran("import-luma", luma, { id: 1 }), failed("import-luma", "Luma answered 500", { id: 2 })]}
        none="None"
      />,
    );
    expect(rowsText()).toEqual([
      `03:00${jobsCopy.runs.status.ok}${jobsCopy.luma.result(luma)}`,
      `03:00${jobsCopy.runs.status.failed}${jobsCopy.runs.error("Luma answered 500")}`,
    ]);
    expect(tones()).toEqual(["green", "red"]);
  });

  it("says why a Luma import stopped early, as incomplete in place of done, its dot amber", async () => {
    await render(
      <RunList runs={[ran("import-luma", { ...exampleLumaResult, stoppedBy: "rate-limit" })]} none="None" />,
    );
    expect(rowsText()).toEqual([
      `03:00${jobsCopy.runs.status.incomplete}${jobsCopy.luma.result(exampleLumaResult)} ${jobsCopy.luma.stoppedBy["rate-limit"]}`,
    ]);
    expect(tones()).toEqual(["amber"]);
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
      .element(page.getByText(`${importRunsCopy.jobTitles["import-parliament"]} ·`, { exact: false }))
      .not.toBeInTheDocument();
    await rerender(<RunList runs={[]} none="Nothing here" />);
    await expect.element(page.getByText("Nothing here")).toBeVisible();
  });
});
