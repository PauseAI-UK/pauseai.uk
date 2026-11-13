import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { campaigns } from "@/lib/content/email-your-mp";
import { importPath } from "@/lib/import-runs";
import { staffCopy } from "@/lib/content/staff-interface";
import { changesSearch } from "@/lib/staff-search";
import ChangesTable from "./ChangesTable";
import { exampleChanges } from "./ChangesTable.examples";
import { downloads } from "@/tests/browser/staff";

const [pm] = campaigns;

describe("ChangesTable", () => {
  const log = (changes: typeof exampleChanges) => ({ changes, total: changes.length, pages: 1, pageSize: 100 });

  it("sorts by date, who and what, keeping the filters, and pages and downloads what they find", async () => {
    const search = changesSearch({ actor: ["sync"], sort: "actor", dir: "asc", page: "2", saved: "4" });
    await render(
      <ChangesTable
        search={search}
        log={{ ...log(exampleChanges), pages: 3 }}
        page={2}
        airtableTable="https://airtable.com/app/tbl"
      />,
    );
    const copy = staffCopy.changes;
    const heading = (name: string) =>
      [...document.querySelectorAll("th a")].find((a) => a.textContent!.includes(name))!.getAttribute("href");
    expect(heading(copy.day)).toBe("/staff/audit-log?actor=sync&sort=day&dir=desc&saved=4");
    expect(heading(copy.actor)).toBe("/staff/audit-log?actor=sync&sort=actor&dir=desc&saved=4");
    expect(heading(copy.action)).toBe("/staff/audit-log?actor=sync&sort=action&dir=asc&saved=4");
    expect([...document.querySelectorAll("th a")]).toHaveLength(3);
    await expect
      .element(page.getByRole("link", { name: staffCopy.paging.next }))
      .toHaveAttribute("href", "/staff/audit-log?actor=sync&sort=actor&dir=asc&saved=4&page=3");
    expect(await downloads()).toContain("/staff/audit-log/download?format=csv&actor=sync&sort=actor&dir=asc");
  });

  it("links an import of sign-ups to its page, with what it imported and held back", async () => {
    const edit = exampleChanges.find((one) => one.action === "edit politician")!;
    const imported = {
      ...edit,
      action: "import sign-ups",
      details: { uploadId: 3, imported: 5, heldBack: 2 },
    } as const;
    await render(
      <ChangesTable
        search={changesSearch({})}
        log={log([imported as unknown as (typeof exampleChanges)[number]])}
        page={1}
        airtableTable="https://airtable.com/app/tbl"
      />,
    );
    const cell = page.getByRole("row").nth(1).getByRole("cell").nth(4);
    const copy = staffCopy.changes;
    expect(cell.element().textContent).toBe(
      `${staffCopy.signupUpload.uploads.title} · 5 ${copy.counts.imported(5)} · 2 ${copy.counts.heldBack(2)}`,
    );
    await expect.element(cell.getByRole("link")).toHaveAttribute("href", "/staff/supporters/import/previous/3");
  });

  it("links a decision on a held import to its job's page", async () => {
    const edit = exampleChanges.find((one) => one.action === "edit politician")!;
    const applied = {
      ...edit,
      action: "apply held politician import",
      details: { id: 4, job: "import-senedd" },
    } as const;
    await render(
      <ChangesTable
        search={changesSearch({})}
        log={log([applied as unknown as (typeof exampleChanges)[number]])}
        page={1}
        airtableTable="https://airtable.com/app/tbl"
      />,
    );
    const cell = page.getByRole("row").nth(1).getByRole("cell").nth(4);
    await expect.element(cell.getByRole("link")).toHaveAttribute("href", "/staff/scheduled-jobs/senedd");
  });

  it("says whose address was added or removed", async () => {
    const entries = exampleChanges.filter((one) => /politician address/.test(one.action));
    await render(
      <ChangesTable
        search={changesSearch({})}
        log={log(entries)}
        page={1}
        airtableTable="https://airtable.com/app/tbl"
      />,
    );
    const details = (n: number) => page.getByRole("row").nth(n).getByRole("cell").nth(4);
    expect(details(1).element().textContent).toBe("Polly Placeholder · polly@example.com");
    expect(details(2).element().textContent).toBe(`${staffCopy.changes.gone("7")} · polly@example.com`);
  });

  it("leaves a change of nothing out of an entry's fields", async () => {
    const edit = exampleChanges.find((one) => one.action === "edit politician")!;
    const empty = { ...edit, details: { ...edit.details, changed: {} } };
    await render(
      <ChangesTable
        search={changesSearch({})}
        log={log([empty])}
        page={1}
        airtableTable="https://airtable.com/app/tbl"
      />,
    );
    const details = page.getByRole("row").nth(1).getByRole("cell").nth(4).element().textContent!;
    expect(details).not.toContain("·  ·");
    expect(details).not.toMatch(/·\s*·/);
  });

  it("lists who changed what, the day in a column of its own, and every field each logged, in words, linked where there's a page", async () => {
    await render(
      <ChangesTable
        search={changesSearch({})}
        log={log(exampleChanges)}
        page={1}
        airtableTable="https://airtable.com/app/tbl"
      />,
    );
    const copy = staffCopy.changes;
    const fields = staffCopy.fields;
    const labels = copy.labels;
    await expect.element(page.getByText(copy.total(exampleChanges.length))).toBeVisible();
    expect(await downloads()).toEqual([
      "/staff/audit-log/download?format=csv",
      "/staff/audit-log/download?format=json",
    ]);
    const rows = page
      .getByRole("row")
      .all()
      .filter((row) => row.element().querySelector("td"));
    expect(rows[0].element().children[0].textContent).toBe("12 Oct 2026");
    expect(rows.at(-1)!.element().children[0].textContent).toBe("11 Oct 2026");
    expect(rows[0].element().children[1].textContent).toBe("09:59");
    expect(rows[0].element().children[2].textContent).toBe("jo@pauseai.uk");
    const details = rows.map((row) => row.element().children[4].textContent);
    const signed = staffCopy.politician.statusSet(staffCopy.statuses.signed);
    const cleared = staffCopy.politician.statusCleared;
    const odd = staffCopy.politician.statusSet("odd");
    const count = (n: number, key: string) => `${n} ${copy.counts[key](n)}`;
    expect(details).toEqual([
      `Polly Placeholder · ${signed.before}${pm.title}${signed.after}, 1 Oct 2026 · ${labels.note} By email`,
      `${copy.gone("99")} · ${cleared.before}controlai-letter${cleared.after}`,
      `Polly Placeholder · ${labels.airtableId} recPolly · ${fields.party} Labour → Independent · ${fields.email} ${copy.empty} → polly@example.org`,
      `Polly Placeholder · ${labels.airtableId} recPolly · ${fields.house} ${staffCopy.houses.commons} · ${fields.salutation} Ms Placeholder · ${fields.constituency} Ipswich · ${fields.party} Labour`,
      "Old MP",
      `polly@example.org · ${labels.kind} ${staffCopy.emails.kinds.hard}`,
      `polly@example.org · ${labels.note} Fixed in Airtable`,
      "Jane Example",
      copy.gone("4"),
      `${copy.gone("5")} · ${labels.reference} ICO-12 · ${count(1, "lumaUsers")} · ${count(2, "formEntries")} · ${count(2, "letters")} · ${count(0, "members")}`,
      `samuel.whitlock@pauseai.uk · ${labels.to} ${copy.noPermissions}`,
      `samuel.whitlock@pauseai.uk · ${copy.noPermissions} → ${staffCopy.accounts.names.supporters}, ${staffCopy.accounts.names.admin}`,
      `samuel.whitlock@pauseai.uk · ${labels.permissions} ${staffCopy.accounts.names.supporters}, retired`,
      `${count(3, "added")} · ${count(40, "removed")} · ${count(2, "changed")}`,
      copy.run("12"),
      `${labels.reason} a test · Ids [1,2] · ${fields.house} atlantis · ${labels.status} ${staffCopy.statuses.signed}`,
      `odd@example.org · ${labels.kind} weird`,
      `Polly Placeholder · ${odd.before}${pm.title}${odd.after}`,
      `2 widgets · ${labels.status} maybe · ${labels.campaign} ${pm.title}`,
      `Old MP · ${fields.house} ${staffCopy.houses.commons} → ${staffCopy.houses.lords} · ${fields.party} Labour → ${copy.empty}`,
      copy.run("13"),
      copy.run("14"),
      copy.run("15"),
      "Polly Placeholder",
      "Jane Example",
      copy.gone("6"),
      ...Array(4).fill(copy.savedFilter("events", "3")),
      "Polly Placeholder · polly@example.com",
      `${copy.gone("7")} · polly@example.com`,
    ]);
    const href = (i: number) => rows[i].element().children[4].querySelector("a")?.getAttribute("href");
    expect([0, 1, 4, 7, 8, 14, 23, 24, 25].map(href)).toEqual([
      "/staff/politicians/7",
      undefined,
      undefined,
      "/staff/supporters/3",
      "/staff/supporters/4",
      importPath("sync-politicians"),
      "/staff/politicians/7",
      "/staff/supporters/3",
      undefined,
    ]);
    // The Airtable ID leads to the record, in a new tab.
    const record = rows[2].getByRole("link", { name: "recPolly" });
    await expect.element(record).toHaveAttribute("href", "https://airtable.com/app/tbl/recPolly");
    await expect.element(record).toHaveAttribute("target", "_blank");
  });

  it("opens each entry's details as logged from a button at the right", async () => {
    await render(
      <ChangesTable
        search={changesSearch({})}
        log={log(exampleChanges.slice(4, 5))}
        page={1}
        airtableTable="https://airtable.com/app/tbl"
      />,
    );
    const json = page.getByText('"name": "Old MP"', { exact: false });
    await expect.element(json).not.toBeVisible();
    await page.getByRole("button", { name: staffCopy.changes.json }).click();
    await expect.element(json).toBeVisible();
    expect(json.element().textContent).toBe(JSON.stringify(exampleChanges[4].details, null, 2));
  });
});

describe("the lists' paging", () => {
  it("leads the audit log through its pages, from the first when none is given", async () => {
    await render(
      <ChangesTable
        search={changesSearch({})}
        log={{ changes: exampleChanges, total: 250, pages: 3, pageSize: 100 }}
        page={2}
        airtableTable="https://airtable.com/app/tbl"
      />,
    );
    await expect
      .element(page.getByRole("link", { name: staffCopy.paging.next }))
      .toHaveAttribute("href", "/staff/audit-log?page=3");
  });
});
