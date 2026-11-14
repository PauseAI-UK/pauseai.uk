import { beforeEach, expect, it, vi } from "vitest";
import { createSession } from "@/lib/accounts/auth";
import { query } from "@/lib/server/db";
import { addTestPolitician, describeWithDatabase, MIGRATION_ASKS, useTestDatabase } from "@/tests/database";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import { deleteAskNow, saveAskNow } from "./actions";

vi.mock("next/headers", () => import("@/tests/next-headers"));
// revalidatePath needs a Next request; here it only needs to have been asked.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const asks = () => query<{ slug: string; title: string }>("SELECT slug, title FROM asks ORDER BY slug");

describeWithDatabase("the asks pages' Server Actions", () => {
  useTestDatabase();

  beforeEach(async () => {
    requestCookies.clear();
    revalidatePath.mockClear();
    requestCookies.set("staff_session", await createSession("jo@pauseai.uk"));
    await query("DELETE FROM asks WHERE slug <> ALL($1)", [MIGRATION_ASKS]);
  });
  const reception = (extra: Record<string, string> = {}) =>
    form({ title: "Winter reception", kind: "event", date: "2026-12-09", ...extra });

  it("change nothing without a session", async () => {
    await expectRedirect(() => saveAskNow(reception()));
    const before = await asks();
    requestCookies.clear();
    const attempts = [
      () => saveAskNow(reception({ title: "Spring reception" })),
      () => saveAskNow(reception({ slug: "winter-reception-dec-2026", title: "Reception" })),
      () => deleteAskNow(form({ slug: "winter-reception-dec-2026" })),
    ];
    for (const attempt of attempts) expect(await expectRedirect(attempt)).toBe("/staff/login");
    expect(await asks()).toEqual(before);
  });

  it("adds an ask, going back to where it was opened from, or the asks page, saying it's added", async () => {
    expect(await expectRedirect(() => saveAskNow(reception({ back: "/staff/mailings/4?x=1" })))).toBe(
      "/staff/mailings/4?x=1&notice=added",
    );
    expect(await expectRedirect(() => saveAskNow(reception({ back: "https://evil.example" })))).toBe(
      "/staff/asks?notice=added",
    );
    expect(await expectRedirect(() => saveAskNow(reception()))).toBe("/staff/asks?notice=added");
    expect(revalidatePath).toHaveBeenCalledWith("/staff/asks");
  });

  it("saves an ask by its slug, or goes back to its form saying why not", async () => {
    await expectRedirect(() => saveAskNow(reception()));
    expect(
      await expectRedirect(() => saveAskNow(reception({ slug: "winter-reception-dec-2026", title: "Reception" }))),
    ).toBe("/staff/asks?notice=saved");
    // Answered, so its kind can't change.
    const polly = await addTestPolitician();
    await query(
      `INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, updated_by)
       VALUES ($1, 'winter-reception-dec-2026', 'event', 'going', 'jo@pauseai.uk')`,
      [polly],
    );
    expect(
      await expectRedirect(() => saveAskNow(reception({ slug: "winter-reception-dec-2026", kind: "letter" }))),
    ).toBe("/staff/asks/winter-reception-dec-2026/edit?notice=kind-in-use&back=%2Fstaff%2Fasks");
    expect(await expectRedirect(() => saveAskNow(form({ title: "", kind: "event" })))).toBe(
      "/staff/asks/new?notice=invalid&back=%2Fstaff%2Fasks",
    );
  });

  it("deletes an ask, or goes back to its form saying why not, or to the asks if it's gone", async () => {
    await expectRedirect(() => saveAskNow(reception()));
    expect(await expectRedirect(() => deleteAskNow(form({ slug: "frontier-ai-letter" })))).toBe(
      "/staff/asks/frontier-ai-letter/edit?notice=named&back=%2Fstaff%2Fasks",
    );
    expect(await expectRedirect(() => deleteAskNow(form({ slug: "winter-reception-dec-2026" })))).toBe(
      "/staff/asks?notice=deleted",
    );
    // One already gone, by another tab, has no form to go back to: the asks page says so.
    expect(await expectRedirect(() => deleteAskNow(new FormData()))).toBe("/staff/asks?notice=gone");
    expect(
      await expectRedirect(() =>
        saveAskNow(form({ slug: "winter-reception-dec-2026", title: "Winter", kind: "event" })),
      ),
    ).toBe("/staff/asks?notice=gone");
  });
});
