import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSession } from "@/lib/accounts/auth.server";
import { getPolitician } from "@/lib/politicians/records.server";
import { query } from "@/lib/server/db.server";
import { addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import { addAliasNow, editPoliticianNow, removeAliasNow, setAskStatus, setMarkNow } from "./actions";

vi.mock("next/headers", () => import("@/tests/next-headers"));
// revalidatePath needs a Next request; here it only needs to have been asked.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const PM = "frontier-ai-letter";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const statusCount = async () => (await query<{ n: number }>("SELECT count(*)::int AS n FROM ask_statuses"))[0].n;

describeWithDatabase("the politician pages' Server Actions", () => {
  useTestDatabase();

  beforeEach(async () => {
    requestCookies.clear();
    revalidatePath.mockClear();
    // A session makes jo an account, with no permissions; they come per test.
    requestCookies.set("staff_session", await createSession("jo@pauseai.uk"));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("change nothing without a session", async () => {
    const id = await addTestPolitician();
    requestCookies.clear();
    const attempts = [
      () => setAskStatus(form({ politicianId: String(id), ask: PM, status: "signed" })),
      () => setMarkNow(form({ politicianId: String(id), mark: "importantTarget", on: "true" })),
      () => editPoliticianNow(form({ politicianId: String(id), salutation: "X" })),
      () => addAliasNow(form({ politicianId: String(id), address: "a@example.com" })),
      () => removeAliasNow(form({ politicianId: String(id), address: "a@example.com" })),
    ];
    for (const attempt of attempts) expect(await expectRedirect(attempt)).toBe("/staff/login");
    expect(await statusCount()).toBe(0);
    expect(await query("SELECT name, important_target FROM notable_people")).toEqual([
      { name: "Polly Placeholder", important_target: false },
    ]);
    expect(await query("SELECT 1 FROM politician_addresses")).toEqual([]);
  });

  it("setAskStatus marks a politician as signed today in London, with a note, or not, as the logged-in staff member", async () => {
    const id = await addTestPolitician();
    // Past midnight in London in summer time, the day before in UTC.
    vi.stubEnv("FIXTURE_NOW", "2026-07-01T23:30:00Z");
    const signed = { politicianId: String(id), ask: PM, status: "signed", note: "At the march" };
    expect(await setAskStatus(form(signed))).toEqual({ ok: true });
    expect((await getPolitician(id))!.statuses[PM]).toMatchObject({
      status: "signed",
      date: "2026-07-02",
      note: "At the march",
      updatedBy: "jo@pauseai.uk",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/politicians");
    revalidatePath.mockClear();

    // A note of only spaces is what staff typed: refused, saying so.
    expect(await setAskStatus(form({ ...signed, status: "declined", note: "  " }))).toEqual({
      ok: false,
      reason: "blank",
    });
    // The rest is the form's own. ControlAI's letter is the import's alone.
    await expect(setAskStatus(form({ ...signed, ask: "controlai-letter" }))).rejects.toThrow("an ask an import fills");
    await expect(setAskStatus(form({ ...signed, politicianId: "x" }))).rejects.toThrow(
      `"politicianId" isn't a row's ID`,
    );
    await expect(setAskStatus(form({ ...signed, status: "maybe" }))).rejects.toThrow("a status no ask allows");
    expect((await getPolitician(id))!.statuses[PM]).toMatchObject({ status: "signed", note: "At the march" });
    expect(revalidatePath).not.toHaveBeenCalled();

    expect(await setAskStatus(form({ ...signed, status: "", note: "Kept" }))).toEqual({ ok: true });
    expect(await statusCount()).toBe(0);
    expect(await query("SELECT details->>'note' AS note FROM audit_log ORDER BY id DESC LIMIT 1")).toEqual([
      { note: "Kept" },
    ]);
  });

  it("setMarkNow turns a marker on and off, and throws on a form without what it fills in itself", async () => {
    const id = await addTestPolitician();
    const important = { politicianId: String(id), mark: "importantTarget", on: "true" };
    expect(await setMarkNow(form(important))).toEqual({ ok: true });
    await expect(setMarkNow(form({ ...important, mark: "is_test" }))).rejects.toThrow("without its marker");
    await expect(setMarkNow(form({ ...important, on: "yes" }))).rejects.toThrow("which way to turn it");
    await expect(setMarkNow(form({ ...important, politicianId: "x" }))).rejects.toThrow(
      `"politicianId" isn't a row's ID`,
    );
    await expect(setMarkNow(form({ politicianId: String(id) }))).rejects.toThrow(`without its "mark"`);
    await expect(setMarkNow(form({ politicianId: String(id), mark: "importantTarget" }))).rejects.toThrow(
      `without its "on"`,
    );
    expect(await query("SELECT important_target AS on FROM notable_people")).toEqual([{ on: true }]);
    expect(await setMarkNow(form({ ...important, on: "false" }))).toEqual({ ok: true });
    expect(await query("SELECT important_target AS on FROM notable_people")).toEqual([{ on: false }]);
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/politicians/${id}`);
  });

  it("editPoliticianNow saves a salutation and an email with its note, or says why not", async () => {
    const lord = await addTestPolitician({ house: "lords", email: null });
    await expect(editPoliticianNow(form({ politicianId: "x", salutation: "Lord X" }))).rejects.toThrow(
      `"politicianId" isn't a row's ID`,
    );
    expect(await editPoliticianNow(form({ politicianId: String(lord) }))).toEqual({
      ok: false,
      reason: "salutation",
    });
    expect(
      await editPoliticianNow(form({ politicianId: String(lord), salutation: "Lord X", email: "x@example.org" })),
    ).toEqual({ ok: false, reason: "note" });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(
      await editPoliticianNow(
        form({ politicianId: String(lord), salutation: "Lord X", email: "x@example.org", note: "On his website" }),
      ),
    ).toEqual({ ok: true });
    expect(
      await editPoliticianNow(form({ politicianId: String(lord), salutation: "Lord Y", note: "His letters say so" })),
    ).toEqual({ ok: true });
    expect(await query("SELECT salutation, email FROM notable_people")).toEqual([
      { salutation: "Lord Y", email: "x@example.org" },
    ]);
    expect(
      await query("SELECT details->>'note' AS note FROM audit_log WHERE action = 'edit politician' ORDER BY id"),
    ).toEqual([{ note: "On his website" }, { note: "His letters say so" }]);
  });

  it("editPoliticianNow and addAliasNow say a politician has gone, and show the staff pages without them", async () => {
    const gone = String((await addTestPolitician()) + 99);
    expect(await editPoliticianNow(form({ politicianId: gone, salutation: "Lord X", note: "He said" }))).toEqual({
      ok: false,
      reason: "gone",
    });
    expect(await addAliasNow(form({ politicianId: gone, address: "polly@example.com", note: "Her Gmail" }))).toEqual({
      ok: false,
      reason: "gone",
    });
    expect(revalidatePath).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith("/staff", "layout");
  });

  it("addAliasNow and removeAliasNow add and remove a politician's address as the staff member, refreshing the staff pages", async () => {
    const id = await addTestPolitician();
    expect(await addAliasNow(form({ politicianId: String(id), address: "polly@example.com" }))).toEqual({
      ok: false,
      reason: "note",
    });
    expect(
      await addAliasNow(form({ politicianId: String(id), address: "polly@example.com", note: "Her Gmail" })),
    ).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/staff", "layout");
    revalidatePath.mockClear();
    expect(
      await addAliasNow(form({ politicianId: String(id), address: "polly@example.com", note: "Her Gmail" })),
    ).toEqual({ ok: false, reason: "exists" });
    expect(await addAliasNow(form({ politicianId: String(id) }))).toEqual({ ok: false, reason: "invalid" });
    // Whose, and which address to remove, are the forms' own.
    await expect(addAliasNow(form({ politicianId: "x", address: "a@example.com" }))).rejects.toThrow(
      `"politicianId" isn't a row's ID`,
    );
    await expect(removeAliasNow(form({ politicianId: "x", address: "polly@example.com" }))).rejects.toThrow(
      `"politicianId" isn't a row's ID`,
    );
    await expect(removeAliasNow(form({ politicianId: String(id) }))).rejects.toThrow(`without its "address"`);
    // One that isn't theirs, as one removed already: done, with nothing to refresh.
    expect(await removeAliasNow(form({ politicianId: String(id), address: "other@example.com" }))).toEqual({
      ok: true,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await removeAliasNow(form({ politicianId: String(id), address: "polly@example.com" }))).toEqual({
      ok: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/staff", "layout");
    expect(await query("SELECT 1 FROM politician_addresses")).toEqual([]);
    expect(await query("SELECT actor FROM audit_log WHERE action LIKE '% politician address'")).toEqual([
      { actor: "jo@pauseai.uk" },
      { actor: "jo@pauseai.uk" },
    ]);
  });
});
