import { beforeEach, expect, it, vi } from "vitest";
import { query } from "@/lib/server/db";
import { createSession } from "@/lib/server/staff-auth";
import type { SignupPlan } from "@/lib/signup-upload";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import { importSignupUpload, previewSignupUpload } from "./signup-upload-actions";

vi.mock("next/headers", () => import("@/tests/next-headers"));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const input = {
  csv: "Name,Email\nJo,jo@example.com",
  filename: "f.csv",
  eventId: null,
  eventColumn: null,
  signedOn: "2026-10-10",
  note: "Flyering",
};

async function staff(email: string, permissions: string) {
  await query("INSERT INTO staff_accounts (email, permissions, added_by) VALUES ($1, $2, 'admin@pauseai.uk')", [
    email,
    permissions,
  ]);
  requestCookies.set("staff_session", await createSession(email));
}

describeWithDatabase("the upload's Server Actions", () => {
  useTestDatabase();

  beforeEach(() => {
    requestCookies.clear();
    revalidatePath.mockClear();
  });

  it("need the supporters permission", async () => {
    await staff("sam@pauseai.uk", "{}");
    expect(await expectRedirect(() => previewSignupUpload(input))).toBe("/staff");
    expect(await expectRedirect(() => importSignupUpload(input, "x"))).toBe("/staff");
  });

  it("preview a file, and import it as the staff member", async () => {
    await staff("jo@pauseai.uk", "{supporters}");
    const plan = (await previewSignupUpload(input)) as SignupPlan;
    expect(plan.rows.map((row) => row.pile)).toEqual(["none"]);
    expect(await importSignupUpload(input, plan.signature)).toEqual({ uploadId: expect.any(Number) });
    expect(await query("SELECT uploaded_by FROM signup_uploads")).toEqual([{ uploaded_by: "jo@pauseai.uk" }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/supporters");
  });
});
