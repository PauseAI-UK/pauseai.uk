import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSession } from "@/lib/accounts/auth.server";
import { saveStaffAccount } from "@/lib/accounts/staff-accounts.server";
import { query } from "@/lib/server/db.server";
import { runJob } from "@/lib/jobs/jobs.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import { eraseSupporterNow } from "./actions";

vi.mock("next/headers", () => import("@/tests/next-headers"));
// revalidatePath needs a Next request; here it only needs to have been asked.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describeWithDatabase("erasing's Server Action", () => {
  useTestDatabase();

  beforeEach(async () => {
    requestCookies.clear();
    revalidatePath.mockClear();
    // A session makes jo an account, with no permissions; they come per test.
    requestCookies.set("staff_session", await createSession("jo@pauseai.uk"));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("changes nothing without a session", async () => {
    requestCookies.clear();
    expect(await expectRedirect(() => eraseSupporterNow(form({ id: "1", reference: "r", confirm: "on" })))).toBe(
      "/staff/login",
    );
  });

  it("eraseSupporterNow needs the supporters permission, erases, and goes to the list; a bad form or no such supporter does nothing", async () => {
    vi.stubEnv("LUMA_API_KEY", "k");
    const erase = () => eraseSupporterNow(form({ id: "1", reference: "ICO-1", confirm: "on" }));
    expect(await expectRedirect(erase)).toBe("/staff");
    await saveStaffAccount("jo@pauseai.uk", ["supporters"], "a");
    await runJob("import-luma", "jo@pauseai.uk", undefined);
    expect(await expectRedirect(erase)).toBe("/staff/supporters?erased=1");
    expect(await query("SELECT 1 FROM supporters WHERE id = 1")).toEqual([]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff", "layout");
    await erase();
    await eraseSupporterNow(form({ id: "2", reference: "" }));
    expect(await query("SELECT count(*)::int AS n FROM supporters")).toEqual([{ n: 6 }]);
  });
});
