import { expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "./db";
import { newPagesFor, newTo } from "./staff-nav-seen";

const add = (email: string) => query("INSERT INTO staff_accounts (email, added_by) VALUES ($1, 'test')", [email]);

describeWithDatabase("the new tag on staff navigation", () => {
  useTestDatabase();

  it("shows nothing as new on a new account's first login, and after", async () => {
    await add("new@pauseai.uk");
    expect(await newPagesFor("new@pauseai.uk", ["supporters"])).toEqual([]);
    expect(await newPagesFor("new@pauseai.uk", ["supporters"])).toEqual([]);
  });

  it("shows a page they've no row for as new, for 3 days from when they first saw it", async () => {
    await add("jo@pauseai.uk");
    await query(
      "INSERT INTO staff_nav_seen (email, page, first_seen_at) SELECT 'jo@pauseai.uk', unnest(ARRAY['supporters', 'politicians']), '2000-01-01'",
    );
    expect(await newPagesFor("jo@pauseai.uk", ["supporters"])).toContain("campaigns");
    expect(await newPagesFor("jo@pauseai.uk", ["supporters"])).toContain("campaigns");
    expect(await newPagesFor("jo@pauseai.uk", ["supporters"])).not.toContain("politicians");
    await query(
      "UPDATE staff_nav_seen SET first_seen_at = now() - interval '3 days 1 minute' WHERE page = 'campaigns'",
    );
    expect(await newPagesFor("jo@pauseai.uk", ["supporters"])).not.toContain("campaigns");
  });

  it("shows the pages a new permission opens as new", async () => {
    await add("jo@pauseai.uk");
    expect(await newPagesFor("jo@pauseai.uk", [])).toEqual([]);
    expect(await newPagesFor("jo@pauseai.uk", ["admin"])).toEqual(
      expect.arrayContaining(["accounts", "changes", "sentEmails"]),
    );
  });

  it("keeps a page's row after losing the permission, not showing it", async () => {
    await add("jo@pauseai.uk");
    await query("INSERT INTO staff_nav_seen (email, page) VALUES ('jo@pauseai.uk', 'accounts')");
    expect(await newPagesFor("jo@pauseai.uk", [])).not.toContain("accounts");
  });

  it("says something on a page is new to whoever first saw it in the last 3 days, and never to one who saw it before", async () => {
    await add("jo@pauseai.uk");
    expect(await newTo("jo@pauseai.uk", "signupImport")).toBe(true);
    expect(await newTo("jo@pauseai.uk", "signupImport")).toBe(true);
    await query(
      "UPDATE staff_nav_seen SET first_seen_at = now() - interval '3 days 1 minute' WHERE page = 'signupImport'",
    );
    expect(await newTo("jo@pauseai.uk", "signupImport")).toBe(false);
    expect(await newPagesFor("jo@pauseai.uk", ["supporters"])).not.toContain("signupImport");
  });
});
