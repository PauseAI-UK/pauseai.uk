import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { query } from "@/lib/server/db.server";
import { createSession } from "@/lib/accounts/auth.server";
import { saveStaffAccount } from "@/lib/accounts/staff-accounts.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { requestCookies } from "@/tests/next-headers";
import { dismissNow, letInNow, setLinkNow } from "./waiting-room-actions";

vi.mock("next/headers", () => import("@/tests/next-headers"));
// revalidatePath needs a Next request; here it only needs to have been asked.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

/** Jane, held in the waiting room; her ID. */
async function janeHeld(): Promise<number> {
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO waiting_room (number, profile_name, asked_at, state, held_why)
     VALUES ('+447700900123', 'Jane', now(), 'held', 'It gives no reason for joining.') RETURNING id::int AS id`,
  );
  return id;
}

describeWithDatabase("the waiting room's Server Actions", () => {
  useTestDatabase();

  beforeEach(async () => {
    requestCookies.clear();
    revalidatePath.mockClear();
    requestCookies.set("staff_session", await createSession("jo@pauseai.uk"));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("change nothing for someone without the Supporters permission", async () => {
    const id = await janeHeld();
    await expect(dismissNow(form({ id: String(id) }))).rejects.toThrow();
    await expect(letInNow(form({ id: String(id) }))).rejects.toThrow();
    await expect(setLinkNow(form({ link: "https://chat.whatsapp.com/TestInvite" }))).rejects.toThrow();
    const [{ state }] = await query<{ state: string }>("SELECT state FROM waiting_room");
    expect(state).toBe("held");
  });

  it("set the link, let someone in and dismiss someone, as the staff member, and refresh the pages", async () => {
    await saveStaffAccount("jo@pauseai.uk", ["supporters"], "test");
    const id = await janeHeld();
    expect(await letInNow(form({ id: String(id) }))).toEqual({ ok: false, reason: "no-link" });
    expect(await setLinkNow(form({ link: "not a link" }))).toEqual({ ok: false, reason: "not-a-link" });
    expect(await setLinkNow(form({}))).toEqual({ ok: false, reason: "not-a-link" });
    expect(await setLinkNow(form({ link: "https://chat.whatsapp.com/TestInvite" }))).toEqual({ ok: true });
    expect(await dismissNow(form({ id: String(id) }))).toEqual({ ok: true });
    const [{ state, by }] = await query<{ state: string; by: string }>(
      "SELECT state, decided_by AS by FROM waiting_room",
    );
    expect({ state, by }).toEqual({ state: "dismissed", by: "jo@pauseai.uk" });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/supporters", "layout");
  });

  it("throw on a form without its own id", async () => {
    await saveStaffAccount("jo@pauseai.uk", ["supporters"], "test");
    await expect(dismissNow(form({}))).rejects.toThrow();
  });
});
