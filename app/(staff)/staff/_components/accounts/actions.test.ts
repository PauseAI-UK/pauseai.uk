import { beforeEach, expect, it, vi } from "vitest";
import { createSession } from "@/lib/accounts/auth";
import { gmailAccounts } from "@/lib/accounts/gmail-accounts";
import { saveStaffAccount } from "@/lib/accounts/staff-accounts";
import { query } from "@/lib/server/db";
import { connectTestGmail, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import { disconnectMyGmail, endStaffSessionsNow, removeStaffAccountNow, saveStaffAccountNow } from "./actions";

vi.mock("next/headers", () => import("@/tests/next-headers"));
// revalidatePath needs a Next request; here it only needs to have been asked.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describeWithDatabase("staff accounts' Server Actions", () => {
  useTestDatabase();

  beforeEach(async () => {
    requestCookies.clear();
    revalidatePath.mockClear();
    requestCookies.set("staff_session", await createSession("jo@pauseai.uk"));
    // The session made jo an account, with no permissions; they come per test.
  });

  it("change nothing without a session", async () => {
    requestCookies.clear();
    const attempts = [
      () => removeStaffAccountNow(form({ email: "x@pauseai.uk" })),
      () => saveStaffAccountNow(form({ email: "jo@pauseai.uk", "permission:admin": "on" })),
      () => endStaffSessionsNow(form({ email: "jo@pauseai.uk" })),
    ];
    for (const attempt of attempts) expect(await expectRedirect(attempt)).toBe("/staff/login");
    expect(await query("SELECT email, permissions FROM staff_accounts")).toEqual([
      { email: "jo@pauseai.uk", permissions: [] },
    ]);
  });

  it("saveStaffAccountNow adds or changes an account and removeStaffAccountNow removes one, as an admin, going back to the page", async () => {
    const save = () =>
      saveStaffAccountNow(form({ email: "Samuel.Whitlock@pauseai.uk", "permission:supporters": "on" }));
    expect(await expectRedirect(save)).toBe("/staff");
    await saveStaffAccount("jo@pauseai.uk", ["admin"], "a");
    expect(await expectRedirect(save)).toBe("/staff/accounts");
    expect(await query("SELECT email, permissions, added_by FROM staff_accounts ORDER BY email")).toEqual([
      { email: "jo@pauseai.uk", permissions: ["admin"], added_by: "login" },
      { email: "samuel.whitlock@pauseai.uk", permissions: ["supporters"], added_by: "jo@pauseai.uk" },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/accounts");
    // The last admin can't lose admin, and the page says so.
    expect(await expectRedirect(() => saveStaffAccountNow(form({ email: "jo@pauseai.uk" })))).toBe(
      "/staff/accounts?notice=last-admin",
    );
    // Removed, the page says what that leaves them; one that isn't there, nothing; the last admin, why not.
    expect(await expectRedirect(() => removeStaffAccountNow(form({ email: "samuel.whitlock@pauseai.uk" })))).toBe(
      "/staff/accounts?notice=removed",
    );
    expect(await expectRedirect(() => removeStaffAccountNow(form({ email: "samuel.whitlock@pauseai.uk" })))).toBe(
      "/staff/accounts",
    );
    expect(await expectRedirect(() => removeStaffAccountNow(form({ email: "jo@pauseai.uk" })))).toBe(
      "/staff/accounts?notice=last-admin",
    );
    expect(await query("SELECT count(*)::int AS n FROM staff_accounts")).toEqual([{ n: 1 }]);
    // An address not at pauseai.uk is refused, and the page says so.
    expect(await expectRedirect(() => saveStaffAccountNow(form({ email: "sam@example.com" })))).toBe(
      "/staff/accounts?notice=not-pauseai",
    );
    // A bad form does nothing.
    await saveStaffAccountNow(form({ email: "nobody" }));
    await removeStaffAccountNow(form({ email: "nobody" }));
    expect(await query("SELECT count(*)::int AS n FROM staff_accounts")).toEqual([{ n: 1 }]);
  });

  it("endStaffSessionsNow ends an account's sessions, as an admin, going back to the page", async () => {
    await createSession("samuel.whitlock@pauseai.uk");
    const end = () => endStaffSessionsNow(form({ email: "samuel.whitlock@pauseai.uk" }));
    expect(await expectRedirect(end)).toBe("/staff");
    expect(
      await query("SELECT count(*)::int AS n FROM staff_sessions WHERE email = 'samuel.whitlock@pauseai.uk'"),
    ).toEqual([{ n: 1 }]);
    await saveStaffAccount("jo@pauseai.uk", ["admin"], "a");
    expect(await expectRedirect(end)).toBe("/staff/accounts");
    expect(
      await query("SELECT count(*)::int AS n FROM staff_sessions WHERE email = 'samuel.whitlock@pauseai.uk'"),
    ).toEqual([{ n: 0 }]);
    // A bad form does nothing.
    await endStaffSessionsNow(form({ email: "nobody" }));
    expect(await query("SELECT actor, action FROM audit_log WHERE action = 'end staff sessions'")).toEqual([
      { actor: "jo@pauseai.uk", action: "end staff sessions" },
    ]);
  });

  it("disconnects your own Gmail", async () => {
    await connectTestGmail("jo@pauseai.uk");
    expect(await expectRedirect(disconnectMyGmail)).toBe("/staff/me?gmail=disconnected");
    expect(await gmailAccounts()).toEqual([]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/me");
  });
});
