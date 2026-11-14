import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSession } from "@/lib/accounts/auth";
import { getPolitician } from "@/lib/politicians/records";
import { query } from "@/lib/server/db";
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

  it("setAskStatus marks a politician as signed today, with a note, or not, as the logged-in staff member", async () => {
    const id = await addTestPolitician();
    await setAskStatus(form({ politicianId: String(id), ask: PM, status: "signed", note: "At the march" }));
    expect((await getPolitician(id))!.statuses[PM]).toMatchObject({
      status: "signed",
      date: new Date().toISOString().slice(0, 10),
      note: "At the march",
      updatedBy: "jo@pauseai.uk",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/politicians");

    // ControlAI's letter is the import's alone.
    await setAskStatus(form({ politicianId: String(id), ask: "controlai-letter", status: "signed" }));
    expect(await statusCount()).toBe(1);

    await setAskStatus(form({ politicianId: String(id), ask: PM, status: "", note: "Kept" }));
    expect(await statusCount()).toBe(0);
    expect(await query("SELECT details->>'note' AS note FROM audit_log ORDER BY id DESC LIMIT 1")).toEqual([
      { note: "Kept" },
    ]);
  });

  it("setMarkNow turns a marker on and off, and ignores a bad form", async () => {
    const id = await addTestPolitician();
    await setMarkNow(form({ politicianId: String(id), mark: "importantTarget", on: "true" }));
    await setMarkNow(form({ politicianId: String(id), mark: "is_test", on: "true" }));
    await setMarkNow(form({ politicianId: "x", mark: "importantTarget", on: "true" }));
    await setMarkNow(form({ politicianId: String(id) }));
    expect(await query("SELECT important_target AS on FROM notable_people")).toEqual([{ on: true }]);
    await setMarkNow(form({ politicianId: String(id), mark: "importantTarget", on: "false" }));
    expect(await query("SELECT important_target AS on FROM notable_people")).toEqual([{ on: false }]);
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/politicians/${id}`);
  });

  it("editPoliticianNow saves a salutation and a Lord's email, says why not, and ignores a bad form", async () => {
    const lord = await addTestPolitician({ house: "lords", email: null });
    expect(await editPoliticianNow(form({ politicianId: "x", salutation: "Lord X" }))).toBeUndefined();
    expect(await editPoliticianNow(form({ politicianId: String(lord) }))).toEqual({
      saved: false,
      why: "salutation",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(
      await editPoliticianNow(form({ politicianId: String(lord), salutation: "Lord X", email: "x@example.org" })),
    ).toEqual({ saved: true });
    expect(await editPoliticianNow(form({ politicianId: String(lord), salutation: "Lord Y" }))).toEqual({
      saved: true,
    });
    expect(await query("SELECT salutation, email FROM notable_people")).toEqual([
      { salutation: "Lord Y", email: "x@example.org" },
    ]);
  });

  it("addAliasNow and removeAliasNow add and remove a politician's address as the staff member, refreshing the staff pages", async () => {
    const id = await addTestPolitician();
    expect(await addAliasNow(form({ politicianId: String(id), address: "polly@example.com" }))).toEqual({
      added: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/staff", "layout");
    revalidatePath.mockClear();
    expect(await addAliasNow(form({ politicianId: String(id), address: "polly@example.com" }))).toEqual({
      added: false,
      why: "exists",
    });
    expect(await addAliasNow(form({ politicianId: String(id) }))).toEqual({ added: false, why: "invalid" });
    expect(await addAliasNow(form({ politicianId: "x", address: "a@example.com" }))).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
    await removeAliasNow(form({ politicianId: "x", address: "polly@example.com" }));
    await removeAliasNow(form({ politicianId: String(id) }));
    expect(revalidatePath).not.toHaveBeenCalled();
    await removeAliasNow(form({ politicianId: String(id), address: "polly@example.com" }));
    expect(revalidatePath).toHaveBeenCalledWith("/staff", "layout");
    expect(await query("SELECT 1 FROM politician_addresses")).toEqual([]);
    expect(await query("SELECT actor FROM audit_log WHERE action LIKE '% politician address'")).toEqual([
      { actor: "jo@pauseai.uk" },
      { actor: "jo@pauseai.uk" },
    ]);
  });
});
