import { describe, expect, it, onTestFinished, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { type StaffAccount } from "@/lib/server/staff-accounts";
import StaffAccountsTable, { AddStaff } from "./StaffAccountsTable";
import { action } from "@/tests/browser/staff";

describe("StaffAccountsTable", () => {
  const accounts = [
    {
      email: "admin@pauseai.uk",
      permissions: ["admin"],
      addedBy: "migration",
      addedAt: new Date("2026-10-16T12:00:00Z"),
      lastLoginAt: new Date("2026-10-22T08:00:00Z"),
      lastSeenAt: new Date("2026-10-22T09:15:00Z"),
      sessions: 2,
      gmailConnectedAt: null,
    },
    {
      email: "jo@pauseai.uk",
      permissions: ["supporters"],
      addedBy: "admin@pauseai.uk",
      addedAt: new Date("2026-10-20T09:00:00Z"),
      lastLoginAt: null,
      lastSeenAt: null,
      sessions: 0,
      gmailConnectedAt: new Date("2026-10-21T09:00:00Z"),
    },
    {
      email: "samuel.whitlock@pauseai.uk",
      permissions: [],
      addedBy: "login",
      addedAt: new Date("2026-10-21T10:30:00Z"),
      lastLoginAt: new Date("2026-10-21T10:30:00Z"),
      lastSeenAt: new Date("2026-10-21T11:00:00Z"),
      sessions: 1,
      gmailConnectedAt: null,
    },
  ] satisfies StaffAccount[];

  const renderTable = async () => {
    const save = action();
    const remove = action();
    const end = action();
    await render(
      <StaffAccountsTable
        save={save.fn}
        remove={remove.fn}
        endSessions={end.fn}
        accounts={accounts}
        you="admin@pauseai.uk"
        sort={{ key: "lastSeen", dir: "desc" }}
      />,
    );
    return { save, remove, end };
  };

  it("sorts by each heading but the permissions, the way the table is sorted now turned round", async () => {
    await renderTable();
    const copy = staffCopy.accounts.columns;
    const heading = (name: string) => page.getByRole("link", { name, exact: true });
    expect(heading(copy.lastSeen).element().closest("th")!.getAttribute("aria-sort")).toBe("descending");
    await expect.element(heading(copy.lastSeen)).toHaveAttribute("href", "/staff/accounts?sort=lastSeen&dir=asc");
    await expect.element(heading(copy.email)).toHaveAttribute("href", "/staff/accounts?sort=email&dir=asc");
    await expect.element(heading(copy.sessions)).toHaveAttribute("href", "/staff/accounts?sort=sessions&dir=desc");
    await expect.element(heading(copy.gmail)).toHaveAttribute("href", "/staff/accounts?sort=gmail&dir=desc");
    await expect.element(heading(copy.permissions)).not.toBeInTheDocument();
  });

  it("says when each was added and by whom, or by its login, when last logged in and seen, its sessions open, and its Gmail", async () => {
    await renderTable();
    const row = (email: string) =>
      page
        .getByRole("row")
        .filter({ hasText: email })
        .getByRole("cell")
        .all()
        .map((cell) => cell.element().textContent);
    const copy = staffCopy.accounts;
    expect(row("jo@pauseai.uk").slice(2, 7)).toEqual([
      `20 Oct 2026, 09:00 ${copy.addedBy("admin@pauseai.uk")}`,
      copy.never,
      copy.never,
      "0",
      `${copy.gmailConnected} 21 Oct 2026, 09:00`,
    ]);
    expect(row("samuel.whitlock@pauseai.uk").slice(2, 7)).toEqual([
      `21 Oct 2026, 10:30 ${copy.addedByLogin}`,
      "21 Oct 2026, 10:30",
      "21 Oct 2026, 11:00",
      `1${copy.endSessions}`,
      copy.gmailNot,
    ]);
  });

  it("ends an account's sessions from its row, only where it has some, saying on your own row that it logs you out", async () => {
    const { end } = await renderTable();
    const form = (email: string) => page.getByRole("form", { name: `${staffCopy.accounts.endSessions}: ${email}` });
    await expect.element(form("jo@pauseai.uk")).not.toBeInTheDocument();
    await expect
      .element(form("admin@pauseai.uk").getByRole("button"))
      .toHaveTextContent(staffCopy.accounts.endMySessions);
    await expect
      .element(form("samuel.whitlock@pauseai.uk").getByRole("button"))
      .toHaveTextContent(staffCopy.accounts.endSessions);
    await form("samuel.whitlock@pauseai.uk").getByRole("button").click();
    await vi.waitFor(() => expect(end.sent).toEqual([{ email: "samuel.whitlock@pauseai.uk" }]));
  });

  it("lists every account, centred in its row, with its permissions by name, Remove at the right, and a key to the permissions", async () => {
    const { remove } = await renderTable();
    const copy = staffCopy.accounts;
    const cell = page.getByRole("cell", { name: "22 Oct 2026, 08:00", exact: true });
    await expect.element(cell).toBeVisible();
    expect(getComputedStyle(cell.element()).verticalAlign).toBe("middle");
    // Each account's permissions by name, then Edit; none, a dash. Its bubble is shut.
    const permissions = (email: string) =>
      page.getByRole("row").filter({ hasText: email }).getByRole("cell").nth(1).element().firstElementChild!.firstChild!
        .textContent;
    expect(permissions("admin@pauseai.uk")).toBe(copy.names.admin);
    expect(permissions("jo@pauseai.uk")).toBe(copy.names.supporters);
    expect(permissions("samuel.whitlock@pauseai.uk")).toBe("–");
    expect([...document.querySelectorAll("input[type=checkbox]")].some((box) => box.checkVisibility())).toBe(false);
    // The last row: everyone else at pauseai.uk, who can log in with no permissions.
    const last = [...document.querySelectorAll("tfoot td")].map((td) => td.textContent);
    expect(last).toEqual([copy.everyone, "–", copy.everyoneNote]);
    // Under its heading, what each permission opens, a row each: its name in bold, then what it opens.
    await expect.element(page.getByRole("heading", { level: 2, name: copy.permissionsKey })).toBeVisible();
    const opens = [...document.querySelectorAll("dl > div")].map((row) => [
      row.querySelector("dt")!.textContent,
      row.querySelector("dd")!.textContent,
    ]);
    expect(opens).toEqual([
      [copy.names.supporters, copy.opens.supporters],
      [copy.names.admin, copy.opens.admin],
    ]);
    expect(Number(getComputedStyle(document.querySelector("dt")!).fontWeight)).toBeGreaterThanOrEqual(600);

    // Remove, pressed twice. With timers faked, the seconds Confirm? waits for can't run out between the presses, however
    // busy the machine.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const jo = page.getByRole("row").filter({ hasText: "jo@pauseai.uk" });
    await jo.getByRole("button", { name: copy.remove }).click();
    expect(remove.sent).toHaveLength(0);
    await jo.getByRole("button", { name: staffCopy.deleteItShort }).click();
    await vi.waitFor(() => expect(remove.sent).toHaveLength(1));
    expect(remove.sent[0]).toEqual({ email: "jo@pauseai.uk" });
  });

  it("edits an account's permissions in a bubble: a box for each, Cancel closes it as it was, Save sends whose and every one ticked", async () => {
    const { save } = await renderTable();
    const copy = staffCopy.accounts;
    const edit = page.getByRole("row").filter({ hasText: "jo@pauseai.uk" }).getByRole("button", { name: copy.edit });
    await edit.click();
    const form = page.getByRole("form", { name: copy.editLabel("jo@pauseai.uk") });
    expect(
      form
        .getByRole("checkbox")
        .all()
        .map((box) => box.element().parentElement!.textContent),
    ).toEqual([copy.names.supporters, copy.names.admin]);
    const supporters = form.getByRole("checkbox", { name: copy.names.supporters });
    const admin = form.getByRole("checkbox", { name: copy.names.admin });
    await expect.element(supporters).toBeChecked();
    await expect.element(admin).not.toBeChecked();
    // Save is off till a box differs from what's saved, and off again once it's back.
    const saveButton = form.getByRole("button", { name: copy.save });
    await expect.element(saveButton).toBeDisabled();
    await admin.click();
    await expect.element(saveButton).toBeEnabled();
    await admin.click();
    await expect.element(saveButton).toBeDisabled();
    // A tick isn't saved till Save; Cancel forgets it.
    await admin.click();
    const open = () =>
      document
        .querySelector(`form[aria-label="${copy.editLabel("jo@pauseai.uk")}"]`)!
        .closest("[popover]")!
        .matches(":popover-open");
    await form.getByRole("button", { name: copy.cancel }).click();
    await expect.poll(open).toBe(false);
    expect(save.sent).toHaveLength(0);
    await edit.click();
    await expect.element(admin).not.toBeChecked();
    await admin.click();
    await supporters.click();
    await form.getByRole("button", { name: copy.save }).click();
    await vi.waitFor(() => expect(save.sent).toHaveLength(1));
    expect(save.sent[0]).toEqual({ email: "jo@pauseai.uk", "permission:admin": "on" });
    await expect.poll(open).toBe(false);
  });
});

describe("AddStaff", () => {
  it("adds someone at once, from its box, refusing an address not at pauseai.uk or in the table already, and keeping it to put right", async () => {
    const save = action();
    await render(<AddStaff accounts={[{ email: "jo@pauseai.uk" } as StaffAccount]} add={save.fn} />);
    await page.getByRole("button", { name: staffCopy.accounts.addStaff }).click();
    const field = page.getByRole("textbox", { name: staffCopy.accounts.addLabel });
    await expect.element(field).toBeVisible();
    await expect.element(field).toHaveAttribute("placeholder", staffCopy.accounts.addTitle);
    const addButton = page.getByRole("button", { name: staffCopy.accounts.add, exact: true });
    // While its box is open, Add staff is pressed, not orange: Add is the one to press.
    const opener = page.getByRole("button", { name: staffCopy.accounts.addStaff }).element();
    expect(getComputedStyle(opener).color).toBe(getComputedStyle(field.element()).color);

    await field.fill("sam@example.com");
    await addButton.click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(staffCopy.accounts.notPauseai);
    await expect.element(field).toHaveAttribute("aria-invalid", "true");
    await expect.element(field).toHaveValue("sam@example.com");
    await field.fill("JO@pauseai.uk");
    await addButton.click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(staffCopy.accounts.alreadyThere);
    expect(save.sent).toHaveLength(0);

    // Enter adds too: an account with no permissions, and the field empty again.
    await userEvent.fill(field, " Lee@PauseAI.uk ");
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => expect(save.sent).toHaveLength(1));
    expect(save.sent[0]).toEqual({ email: "lee@pauseai.uk" });
    await expect.element(field).toHaveValue("");
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
    await expect.element(field).toHaveAttribute("aria-invalid", "false");
  });
});
