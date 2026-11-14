import { beforeEach, expect, it, vi } from "vitest";
import { query } from "@/lib/server/db.server";
import { createSession } from "@/lib/accounts/auth.server";
import { saveStaffAccount } from "@/lib/accounts/staff-accounts.server";
import { addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import { addNoteNow, deleteNoteNow, editNoteNow } from "./actions";

vi.mock("next/headers", () => import("@/tests/next-headers"));
// revalidatePath needs a Next request; here it only needs to have been asked.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describeWithDatabase("notes' Server Actions", () => {
  useTestDatabase();

  beforeEach(async () => {
    requestCookies.clear();
    revalidatePath.mockClear();
    requestCookies.set("staff_session", await createSession("jo@pauseai.uk"));
    // The session made jo an account, with no permissions; they come per test.
  });

  it("change nothing without a session", async () => {
    const id = await addTestPolitician();
    requestCookies.clear();
    const attempts = [
      () => addNoteNow(form({ politicianId: String(id), body: "Hi" })),
      () => editNoteNow(form({ id: "1", body: "Hi" })),
      () => deleteNoteNow(form({ id: "1" })),
    ];
    for (const attempt of attempts) expect(await expectRedirect(attempt)).toBe("/staff/login");
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
});
