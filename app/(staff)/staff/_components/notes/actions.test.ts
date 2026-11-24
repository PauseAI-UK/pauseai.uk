import { afterEach, beforeEach, expect, it, vi } from "vitest";
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

const bodies = () => query("SELECT body, written_by FROM notes ORDER BY id");

describeWithDatabase("notes' Server Actions", () => {
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
    await saveStaffAccount("jo@pauseai.uk", ["supporters"], "a");
    expect(await addNoteNow(form({ politicianId: String(id), body: "Met them" }))).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/politicians/${id}`);
    expect(await addNoteNow(form({ supporterId: String(supporterId), body: "Keen" }))).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/supporters/${supporterId}`);
    expect(await editNoteNow(form({ id: "1", body: "Met them twice" }))).toEqual({ ok: true });
    expect(await bodies()).toEqual([
      { body: "Met them twice", written_by: "jo@pauseai.uk" },
      { body: "Keen", written_by: "jo@pauseai.uk" },
    ]);
    revalidatePath.mockClear();
    expect(await deleteNoteNow(form({ id: "2" }))).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/supporters/${supporterId}`);
    expect(await bodies()).toEqual([{ body: "Met them twice", written_by: "jo@pauseai.uk" }]);
  });

  it("refuse a note that says nothing, which is typed", async () => {
    const id = await addTestPolitician();
    await addNoteNow(form({ politicianId: String(id), body: "Met them" }));
    revalidatePath.mockClear();
    expect(await addNoteNow(form({ politicianId: String(id), body: " \n " }))).toEqual({ ok: false, reason: "blank" });
    expect(await editNoteNow(form({ id: "1", body: "" }))).toEqual({ ok: false, reason: "blank" });
    expect(await bodies()).toEqual([{ body: "Met them", written_by: "jo@pauseai.uk" }]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throw on a form without the one it's about or its note, or a supporter's note from someone who can't see supporters", async () => {
    const [{ id: supporterId }] = await query<{ id: number }>(
      "INSERT INTO supporters DEFAULT VALUES RETURNING id::int AS id",
    );
    await expect(addNoteNow(form({ body: "On no one" }))).rejects.toThrow("without the one it's about");
    await expect(addNoteNow(form({ supporterId: String(supporterId), body: "Keen" }))).rejects.toThrow(
      "someone who can't see supporters",
    );
    await expect(editNoteNow(form({ id: "x", body: "Fixed" }))).rejects.toThrow(`"id" isn't a row's ID`);
    await expect(deleteNoteNow(form({ id: "x" }))).rejects.toThrow(`"id" isn't a row's ID`);
    expect(await bodies()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("say whoever a new note is about has gone, showing their page without them", async () => {
    const id = await addTestPolitician();
    expect(await addNoteNow(form({ politicianId: String(id + 1), body: "On no one" }))).toEqual({
      ok: false,
      reason: "gone",
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/politicians/${id + 1}`);
  });

  it("say a note has gone, to edit, and take deleting it as done, showing every page without it", async () => {
    expect(await editNoteNow(form({ id: "9", body: "No such note" }))).toEqual({ ok: false, reason: "gone" });
    expect(revalidatePath).toHaveBeenCalledWith("/staff", "layout");
    revalidatePath.mockClear();
    expect(await deleteNoteNow(form({ id: "9" }))).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/staff", "layout");
  });

  it("refuse to change a note whose day is up, as on a page left open", async () => {
    vi.stubEnv("FIXTURE_NOW", "2026-11-02T09:00:00Z");
    const id = await addTestPolitician();
    await addNoteNow(form({ politicianId: String(id), body: "Met them" }));
    revalidatePath.mockClear();
    vi.stubEnv("FIXTURE_NOW", "2026-11-03T09:00:01Z");
    expect(await editNoteNow(form({ id: "1", body: "Too late" }))).toEqual({ ok: false, reason: "too-late" });
    expect(await deleteNoteNow(form({ id: "1" }))).toEqual({ ok: false, reason: "too-late" });
    expect(await bodies()).toEqual([{ body: "Met them", written_by: "jo@pauseai.uk" }]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
