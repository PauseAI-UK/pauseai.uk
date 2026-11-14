import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { query } from "@/lib/server/db.server";
import { isBlocked, recordProblem } from "@/lib/server/email.server";
import { createSession } from "@/lib/accounts/auth.server";
import { saveStaffAccount } from "@/lib/accounts/staff-accounts.server";
import { addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import { addNoteNow, deleteNoteNow, editNoteNow, setErrorDoneNow, unblockAddress } from "./actions";

vi.mock("next/headers", () => import("@/tests/next-headers"));
// revalidatePath needs a Next request; here it only needs to have been asked.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const statusCount = async () => (await query<{ n: number }>("SELECT count(*)::int AS n FROM ask_statuses"))[0].n;

describeWithDatabase("staff Server Actions", () => {
  useTestDatabase();

  beforeEach(async () => {
    requestCookies.clear();
    revalidatePath.mockClear();
    requestCookies.set("staff_session", await createSession("jo@pauseai.uk"));
    // The session made jo an account, with no permissions; they come per test.
  });
  afterEach(() => vi.unstubAllEnvs());

  it("change nothing without a session", async () => {
    const id = await addTestPolitician();
    requestCookies.clear();
    const attempts = [
      () => unblockAddress(form({ address: "a@example.org", note: "" })),
      () => addNoteNow(form({ politicianId: String(id), body: "Hi" })),
      () => editNoteNow(form({ id: "1", body: "Hi" })),
      () => deleteNoteNow(form({ id: "1" })),
    ];
    for (const attempt of attempts) expect(await expectRedirect(attempt)).toBe("/staff/login");
    expect(await statusCount()).toBe(0);
    expect(await query("SELECT name FROM notable_people")).toEqual([{ name: "Polly Placeholder" }]);
    expect(await query("SELECT count(*)::int AS n FROM notes")).toEqual([{ n: 0 }]);
  });

  it("addNoteNow, editNoteNow and deleteNoteNow change notes as the staff member, refreshing the page they're on", async () => {
    const id = await addTestPolitician();
    const [{ id: supporterId }] = await query<{ id: number }>(
      "INSERT INTO supporters DEFAULT VALUES RETURNING id::int AS id",
    );
    const bodies = () => query("SELECT body, written_by FROM notes ORDER BY id");
    await addNoteNow(form({ politicianId: String(id), body: "Met them" }));
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/politicians/${id}`);
    // Without the supporters permission, a supporter's note isn't added; a bad form does nothing.
    await addNoteNow(form({ supporterId: String(supporterId), body: "Keen" }));
    await addNoteNow(form({ body: "On no one" }));
    await saveStaffAccount("jo@pauseai.uk", ["supporters"], "a");
    await addNoteNow(form({ supporterId: String(supporterId), body: "Keen" }));
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/supporters/${supporterId}`);
    expect(await editNoteNow(form({ id: "1", body: "Met them twice" }))).toBe(true);
    expect(await editNoteNow(form({ id: "9", body: "No such note" }))).toBe(false);
    expect(await editNoteNow(form({ id: "1", body: "" }))).toBe(false);
    expect(await bodies()).toEqual([
      { body: "Met them twice", written_by: "jo@pauseai.uk" },
      { body: "Keen", written_by: "jo@pauseai.uk" },
    ]);
    revalidatePath.mockClear();
    expect(await deleteNoteNow(form({ id: "x" }))).toBe(false);
    expect(await deleteNoteNow(form({ id: "9" }))).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await deleteNoteNow(form({ id: "2" }))).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/supporters/${supporterId}`);
    expect(await bodies()).toEqual([{ body: "Met them twice", written_by: "jo@pauseai.uk" }]);
  });

  it("setErrorDoneNow marks an error done as the admin, back to the list, or to do again, staying, refreshing the errors pages", async () => {
    await query(
      "INSERT INTO errors_seen (key, kind, route, name, words, latest_words) VALUES ('k', 'route', '/api', 'Error', 'W', 'W')",
    );
    const done = () => query('SELECT done_by AS "doneBy", done_at IS NOT NULL AS "done" FROM errors_seen');
    // Without admin, nothing changes.
    expect(await expectRedirect(() => setErrorDoneNow(form({ id: "1", done: "yes" })))).toBe("/staff");
    await saveStaffAccount("jo@pauseai.uk", ["admin"], "test");
    // A bad form does nothing.
    await setErrorDoneNow(form({ id: "x", done: "yes" }));
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await expectRedirect(() => setErrorDoneNow(form({ id: "1", done: "yes" })))).toBe("/staff/errors");
    expect(await done()).toEqual([{ doneBy: "jo@pauseai.uk", done: true }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/errors", "layout");
    await setErrorDoneNow(form({ id: "1", done: "" }));
    expect(await done()).toEqual([{ doneBy: null, done: false }]);
  });

  it("unblockAddress unblocks an address, with the note, and refreshes every staff page", async () => {
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "server-token");
    await saveStaffAccount("jo@pauseai.uk", ["supporters"], "test");
    const bounce = { address: "a@example.org", messageId: null, kind: "hard" as const, reason: "", canReset: true };
    await recordProblem(bounce);
    await unblockAddress(form({ address: "nobody", note: "Fixed" }));
    await unblockAddress(form({ address: "A@example.org", note: " " }));
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await isBlocked("a@example.org")).toBe(true);
    await unblockAddress(form({ address: "A@example.org", note: "Fixed" }));
    expect(await isBlocked("a@example.org")).toBe(false);
    expect(await query("SELECT actor, action, details FROM audit_log WHERE action = 'unblock address'")).toEqual([
      { actor: "jo@pauseai.uk", action: "unblock address", details: { address: "a@example.org", note: "Fixed" } },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff", "layout");
  });

  it("unblockAddress unblocks only a politician's address without supporters", async () => {
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "server-token");
    await addTestPolitician({ email: "Polly@example.org" });
    for (const address of ["polly@example.org", "jane@example.com"]) {
      await recordProblem({ address, messageId: null, kind: "hard", reason: "", canReset: true });
      await unblockAddress(form({ address, note: "Fixed" }));
    }
    expect(await isBlocked("polly@example.org")).toBe(false);
    expect(await isBlocked("jane@example.com")).toBe(true);
  });

  it("unblockAddress leaves the address blocked, and logs why, if Postmark can't be reached", async () => {
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "server-token");
    await saveStaffAccount("jo@pauseai.uk", ["supporters"], "test");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(
      http.post("https://api.postmarkapp.com/message-streams/*", () => new HttpResponse(null, { status: 500 })),
    );
    await recordProblem({ address: "a@example.org", messageId: null, kind: "hard", reason: "", canReset: true });
    await unblockAddress(form({ address: "a@example.org", note: "Fixed" }));
    expect(await isBlocked("a@example.org")).toBe(true);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
