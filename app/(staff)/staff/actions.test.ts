import { staffCopy } from "@/lib/content/staff-interface";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { query } from "@/lib/server/db";
import { isBlocked, recordProblem } from "@/lib/server/email";
import { getPolitician } from "@/lib/server/politicians";
import { createSession } from "@/lib/accounts/auth";
import { saveStaffAccount } from "@/lib/accounts/staff-accounts";
import { addTestPolitician, describeWithDatabase, MIGRATION_ASKS, useTestDatabase } from "@/tests/database";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import {
  addAliasNow,
  removeAliasNow,
  addNoteNow,
  deleteNoteNow,
  editNoteNow,
  deleteAskNow,
  saveAskNow,
  decideImport,
  editPoliticianNow,
  setMarkNow,
  setAskStatus,
  runJobNow,
  setErrorDoneNow,
  unblockAddress,
} from "./actions";

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
const runs = () => query('SELECT job, status, started_by AS "startedBy" FROM import_runs ORDER BY id');

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
      () => setAskStatus(form({ politicianId: String(id), ask: PM, status: "signed" })),
      () => runJobNow("check-mps"),
      () => runJobNow("nothing"),
      () => decideImport(form({ id: "1", job: "import-parliament", decision: "apply" })),
      () => setMarkNow(form({ politicianId: "1", mark: "importantTarget", on: "true" })),
      () => editPoliticianNow(form({ politicianId: "1", salutation: "X" })),
      () => unblockAddress(form({ address: "a@example.org", note: "" })),
      () => addNoteNow(form({ politicianId: String(id), body: "Hi" })),
      () => editNoteNow(form({ id: "1", body: "Hi" })),
      () => deleteNoteNow(form({ id: "1" })),
      () => addAliasNow(form({ politicianId: String(id), address: "a@example.com" })),
      () => removeAliasNow(form({ politicianId: String(id), address: "a@example.com" })),
    ];
    for (const attempt of attempts) expect(await expectRedirect(attempt)).toBe("/staff/login");
    expect(await statusCount()).toBe(0);
    expect(await query("SELECT name FROM notable_people")).toEqual([{ name: "Polly Placeholder" }]);
    expect(await query("SELECT count(*)::int AS n FROM import_runs")).toEqual([{ n: 0 }]);
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

  it("a job's button runs it as the staff member, here ControlAI's letter, and keeps a failure rather than crashing the page", async () => {
    const id = await addTestPolitician();
    await runJobNow("import-controlai");
    expect((await getPolitician(id))!.statuses["controlai-letter"]).toMatchObject({ updatedBy: "controlai" });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs");
    // Its own page, the overview, and the home page's actions.
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs/controlai");
    expect(revalidatePath).toHaveBeenCalledWith("/staff");

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get("https://controlai.org/uk-pm-letter", () => new HttpResponse(null, { status: 500 })));
    await runJobNow("import-controlai");
    // The failure, and that nobody could be emailed about it, as NOTIFICATION_INBOX isn't set here.
    expect(error).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(staffCopy.problems.anywhere.noInbox);
    expect(await runs()).toEqual([
      { job: "import-controlai", status: "ok", startedBy: "jo@pauseai.uk" },
      { job: "import-controlai", status: "failed", startedBy: "jo@pauseai.uk" },
    ]);
  });

  it("the Luma import's button copies the Luma calendar as the staff member", async () => {
    vi.stubEnv("LUMA_API_KEY", "k");
    await runJobNow("import-luma");
    expect(await runs()).toEqual([{ job: "import-luma", status: "ok", startedBy: "jo@pauseai.uk" }]);
    expect(await query("SELECT count(*)::int AS n FROM luma_events")).toEqual([{ n: 9 }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs");
  });

  it("the Gmail reading's button reads the connected Gmail as the staff member", async () => {
    await runJobNow("read-gmail");
    expect(await runs()).toEqual([{ job: "read-gmail", status: "unchanged", startedBy: "jo@pauseai.uk" }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs/gmail");
  });

  it("the sending's button sends what's waiting, and the tidying's tidies the logs, each as the staff member", async () => {
    await runJobNow("send-mailings");
    expect(await runs()).toEqual([{ job: "send-mailings", status: "unchanged", startedBy: "jo@pauseai.uk" }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs/sending");
    await runJobNow("tidy-logs");
    expect(await runs()).toEqual([
      { job: "send-mailings", status: "unchanged", startedBy: "jo@pauseai.uk" },
      { job: "tidy-logs", status: "unchanged", startedBy: "jo@pauseai.uk" },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs/tidying");
  });

  it("an import's button imports its body's members", async () => {
    await runJobNow("import-senedd");
    expect(await runs()).toEqual([{ job: "import-senedd", status: "applied", startedBy: "jo@pauseai.uk" }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs");
  });

  it("a job's button keeps a failure rather than crashing the page", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get("https://business.senedd.wales/*", () => new HttpResponse(null, { status: 500 })));
    await runJobNow("import-senedd");
    // The failure, and that nobody could be emailed about it, as NOTIFICATION_INBOX isn't set here.
    expect(error).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(staffCopy.problems.anywhere.noInbox);
    expect(await runs()).toEqual([{ job: "import-senedd", status: "failed", startedBy: "jo@pauseai.uk" }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs");
  });

  it("decideImport applies or discards a held import, and ignores a bad form", async () => {
    await query(
      `INSERT INTO import_runs (job, started_by, status, result) VALUES ('import-senedd', 'nightly', 'held', $1)`,
      [JSON.stringify({ changes: {}, members: [], endings: [] })],
    );
    const [{ id }] = await query<{ id: number }>("SELECT id::int AS id FROM import_runs");
    await decideImport(form({ id: String(id), job: "import-senedd", decision: "maybe" }));
    await decideImport(form({ id: "x", job: "import-senedd", decision: "apply" }));
    await decideImport(form({ id: String(id), job: "sync-politicians", decision: "apply" }));
    await decideImport(form({ id: String(id), decision: "apply" }));
    expect(await query("SELECT status FROM import_runs")).toEqual([{ status: "held" }]);
    await decideImport(form({ id: String(id), job: "import-senedd", decision: "discard" }));
    expect(await query("SELECT status, decided_by FROM import_runs")).toEqual([
      { status: "discarded", decided_by: "jo@pauseai.uk" },
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

  it("runs nothing for a name that isn't a job's", async () => {
    await runJobNow("nothing");
    await runJobNow("toString");
    expect(await query("SELECT count(*)::int AS n FROM import_runs")).toEqual([{ n: 0 }]);
    expect(await query("SELECT 1 FROM job_presses")).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("starts nothing while a press of the job is running, and takes over one older than any can run", async () => {
    const runs = () => query("SELECT 1 FROM import_runs WHERE job = 'tidy-logs'");
    await query("INSERT INTO job_presses (job, started_by) VALUES ('tidy-logs', 'sam@pauseai.uk')");
    await runJobNow("tidy-logs");
    expect(await runs()).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs/tidying");
    await query("UPDATE job_presses SET started_at = now() - interval '17 minutes'");
    await runJobNow("tidy-logs");
    expect(await runs()).toHaveLength(1);
    expect(await query("SELECT 1 FROM job_presses")).toEqual([]);
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

  describe("asks", () => {
    beforeEach(() => query("DELETE FROM asks WHERE slug <> ALL($1)", [MIGRATION_ASKS]));
    const reception = (extra: Record<string, string> = {}) =>
      form({ title: "Winter reception", kind: "event", date: "2026-12-09", ...extra });

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
});
