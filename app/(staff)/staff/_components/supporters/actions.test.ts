import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { createSession } from "@/lib/accounts/auth.server";
import { saveStaffAccount } from "@/lib/accounts/staff-accounts.server";
import { query } from "@/lib/server/db.server";
import { addFormEntry } from "@/lib/supporters/form-entries.server";
import { recordStaffOptOut } from "@/lib/supporters/opt-outs.server";
import type { SignupPlan } from "@/lib/supporters/signup-csv";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import { importSignupUpload, previewSignupUpload, recordOptOutNow } from "./actions";

vi.mock("next/headers", () => import("@/tests/next-headers"));
// The real one, which a test can make find the opt-out recorded already, as one recorded since the page was opened.
vi.mock("@/lib/supporters/opt-outs.server", async (original) => {
  const real = await original<typeof import("@/lib/supporters/opt-outs.server")>();
  return { ...real, recordStaffOptOut: vi.fn(real.recordStaffOptOut) };
});
// revalidatePath needs a Next request; here it only needs to have been asked.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const input = {
  kind: "paper" as const,
  town: "",
  csv: "Name,Email\nJo,jo@example.com",
  filename: "f.csv",
  eventId: null,
  eventColumn: null,
  signedOn: "2026-10-10",
  note: "Flyering",
};

describeWithDatabase("the supporter pages' Server Actions", () => {
  useTestDatabase();

  beforeEach(async () => {
    requestCookies.clear();
    revalidatePath.mockClear();
    // A session makes jo an account, with no permissions; they come per test.
    requestCookies.set("staff_session", await createSession("jo@pauseai.uk"));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("change nothing without a session", async () => {
    requestCookies.clear();
    const attempts = [
      () => recordOptOutNow(form({ supporterId: "1", choice: "email|bulk|a@example.org", how: "Said so" })),
      () => previewSignupUpload(input),
      () => importSignupUpload(input, "x"),
    ];
    for (const attempt of attempts) expect(await expectRedirect(attempt)).toBe("/staff/login");
    expect(await query("SELECT count(*)::int AS n FROM signup_uploads")).toEqual([{ n: 0 }]);
  });

  it("recordOptOutNow records what staff chose of the supporter's, with how, and nothing else", async () => {
    const entry = await addFormEntry("march-2026-11", {
      name: "Jane Smith",
      email: "jane.smith@example.com",
      phone: null,
      city: null,
      postcode: null,
      consent: true,
      utmSource: null,
    });
    const [{ id }] = await query<{ id: number }>(
      "SELECT supporter_id::int AS id FROM supporter_links WHERE form_entry_id = $1",
      [entry],
    );
    const record = (fields: Record<string, string>) => recordOptOutNow(form({ supporterId: String(id), ...fields }));
    const choice = "email|newsletter|jane.smith@example.com";
    expect(await expectRedirect(() => record({ choice, how: "At the stall" }))).toBe("/staff");
    await saveStaffAccount("jo@pauseai.uk", ["supporters"], "a");
    const done = { ok: true, already: false };
    const already = { ok: true, already: true };
    // Recorded since the page was opened: nothing to take off the calendar.
    vi.mocked(recordStaffOptOut).mockResolvedValueOnce(false);
    expect(await record({ choice: "email|bulk|jane.smith@example.com", how: "At the stall" })).toEqual(already);
    expect(vi.mocked(recordStaffOptOut)).toHaveBeenCalledOnce();
    // Every bulk email takes them off our Luma calendar too, on the live site; then, for what follows, it never was.
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    vi.stubEnv("LUMA_API_KEY", "k");
    const removed: unknown[] = [];
    server.use(
      http.post("https://public-api.luma.com/v1/calendars/contacts/remove", async ({ request }) => {
        removed.push(await request.json());
        return HttpResponse.json({});
      }),
    );
    expect(await record({ choice: "email|bulk|jane.smith@example.com", how: "At the stall" })).toEqual(done);
    expect(removed).toEqual([{ email: "jane.smith@example.com" }]);
    vi.unstubAllEnvs();
    await query("DELETE FROM civicrm_updates");
    await query("DELETE FROM opt_outs");
    await query("DELETE FROM audit_log WHERE action = 'record opt-out'");
    revalidatePath.mockClear();
    // How they said so is typed: blank, it's refused, saying so.
    expect(await record({ choice, how: " " })).toEqual({ ok: false, reason: "blank" });
    expect(await record({ choice })).toEqual({ ok: false, reason: "blank" });
    // Whom, and a choice, are the form's own.
    await expect(recordOptOutNow(form({ choice, how: "At the stall" }))).rejects.toThrow(
      `"supporterId" isn't a row's ID`,
    );
    await expect(record({ how: "At the stall" })).rejects.toThrow(`without its "choice"`);
    expect(revalidatePath).not.toHaveBeenCalled();
    // A supporter gone since the page loaded, which the page then shows.
    expect(await recordOptOutNow(form({ supporterId: "999999", choice, how: "At the stall" }))).toEqual({
      ok: false,
      reason: "gone",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/supporters/999999");
    // A choice that isn't theirs to make is one recorded since the page loaded.
    expect(await record({ choice: "email|newsletter|sam@example.com", how: "At the stall" })).toEqual(already);
    expect(await record({ choice, how: " At the stall " })).toEqual(done);
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/supporters/${id}`);
    // Opted out of it, it's no longer offered.
    expect(await record({ choice, how: "Again" })).toEqual(already);
    expect(await query("SELECT address, list, source, recorded_by, how FROM opt_outs")).toEqual([
      {
        address: "jane.smith@example.com",
        list: "newsletter",
        source: "staff",
        recorded_by: "jo@pauseai.uk",
        how: "At the stall",
      },
    ]);
    expect(await query("SELECT action, details FROM audit_log WHERE action = 'record opt-out'")).toEqual([
      {
        action: "record opt-out",
        details: { address: "jane.smith@example.com", list: "newsletter", way: "email", how: "At the stall" },
      },
    ]);
  });

  it("the upload's need the supporters permission", async () => {
    expect(await expectRedirect(() => previewSignupUpload(input))).toBe("/staff");
    expect(await expectRedirect(() => importSignupUpload(input, "x"))).toBe("/staff");
  });

  it("the upload's preview a file, and import it as the staff member", async () => {
    await saveStaffAccount("jo@pauseai.uk", ["supporters"], "a");
    const { plan } = (await previewSignupUpload(input)) as { plan: SignupPlan };
    expect(plan.rows.map((row) => row.pile)).toEqual(["none"]);
    // Not what the preview showed: what it would do now, and nothing imported.
    expect(await importSignupUpload(input, "another")).toEqual({ ok: true, changed: plan });
    expect(await importSignupUpload(input, plan.signature)).toEqual({ ok: true, uploadId: expect.any(Number) });
    expect(await query("SELECT uploaded_by FROM signup_uploads")).toEqual([{ uploaded_by: "jo@pauseai.uk" }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/supporters");
  });

  it("the upload's refuse a choice that doesn't fit the file, and throw on a file the form can't read", async () => {
    await saveStaffAccount("jo@pauseai.uk", ["supporters"], "a");
    const refusedChoice = { ok: false, reason: "bad-choice" };
    // An event that isn't one of those offered, as one gone since the page loaded.
    const gone = { ...input, eventId: "evt-gone", eventColumn: "Name" };
    expect(await previewSignupUpload(gone)).toEqual(refusedChoice);
    expect(await importSignupUpload(gone, "x")).toEqual(refusedChoice);
    const empty = { ...input, csv: "" };
    await expect(previewSignupUpload(empty)).rejects.toThrow("a file its form can't read");
    await expect(importSignupUpload(empty, "x")).rejects.toThrow("a file its form can't read");
    expect(await query("SELECT count(*)::int AS n FROM signup_uploads")).toEqual([{ n: 0 }]);
  });
});
