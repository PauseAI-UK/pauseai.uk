import { beforeEach, expect, it, vi } from "vitest";
import { createSession } from "@/lib/accounts/auth.server";
import { query } from "@/lib/server/db.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import {
  addFindNow,
  addPieceNow,
  editFindNow,
  editPieceNow,
  removePieceNow,
  restorePieceNow,
  turnDownFindNow,
} from "./actions";

vi.mock("next/headers", () => import("@/tests/next-headers"));
// revalidatePath needs a Next request; here it only needs to have been asked.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

/** A piece's form as staff fill it in, with `changes`. */
const piece = (changes: Record<string, string> = {}) =>
  form({ title: "Protesters march", outlet: "The Example Gazette", medium: "Article", date: "", note: "", ...changes });

/** A find waiting for staff, and a piece on /press; their ids. */
async function findAndPiece(): Promise<{ find: string; piece: string }> {
  const [{ id: outlet }] = await query<{ id: number }>(
    "INSERT INTO press_outlets (name) VALUES ('The Example Gazette') RETURNING id::int",
  );
  const [{ id: shown }] = await query<{ id: number }>(
    `INSERT INTO press_coverage (outlet_id, title, medium, url, created_by)
     VALUES ($1, 'On /press', 'Article', 'https://www.example.com/on-press', 'test') RETURNING id::int`,
    [outlet],
  );
  const [{ id: waiting }] = await query<{ id: number }>(
    `INSERT INTO press_finds (google_link, title, outlet_name, state, url)
     VALUES ('https://news.google.com/rss/articles/a', 'A find', 'Example Weekly', 'waiting', 'https://www.example.com/find')
     RETURNING id::int`,
  );
  return { find: String(waiting), piece: String(shown) };
}

const refreshed = () => expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual(["/staff/press", "/press"]);

describeWithDatabase("the staff Press page's Server Actions", () => {
  useTestDatabase();

  beforeEach(async () => {
    requestCookies.clear();
    revalidatePath.mockClear();
    requestCookies.set("staff_session", await createSession("jo@pauseai.uk"));
  });

  it("change nothing without a session", async () => {
    const { find } = await findAndPiece();
    requestCookies.clear();
    expect(await expectRedirect(() => addFindNow(form({ id: find })))).toBe("/staff/login");
    expect(await query("SELECT state FROM press_finds")).toEqual([{ state: "waiting" }]);
  });

  it("edit a find, then add it to /press, refreshing both pages; a find decided since is gone", async () => {
    const { find } = await findAndPiece();
    expect(await editFindNow(piece({ id: find, medium: "Video", date: "2026-10-15", note: " Quotes us. " }))).toEqual({
      ok: true,
    });
    refreshed();
    expect(await query("SELECT title, medium, published::text AS date, note FROM press_finds")).toEqual([
      { title: "Protesters march", medium: "Video", date: "2026-10-15", note: "Quotes us." },
    ]);
    revalidatePath.mockClear();
    expect(await addFindNow(form({ id: find }))).toEqual({ ok: true });
    refreshed();
    expect(await addFindNow(form({ id: find }))).toEqual({ ok: false, reason: "gone" });
    expect(await editFindNow(piece({ id: find }))).toEqual({ ok: false, reason: "gone" });
  });

  it("remove a find, once", async () => {
    const { find } = await findAndPiece();
    expect(await turnDownFindNow(form({ id: find }))).toEqual({ ok: true });
    expect(await query("SELECT state FROM press_finds")).toEqual([{ state: "not ours" }]);
    expect(await turnDownFindNow(form({ id: find }))).toEqual({ ok: false, reason: "gone" });
  });

  it("edit a piece on /press, taking a date that isn't one as none; remove it, and put it back", async () => {
    const { piece: id } = await findAndPiece();
    expect(await editPieceNow(piece({ id, title: "A better headline", date: "soon" }))).toEqual({ ok: true });
    expect(await query("SELECT title, published FROM press_coverage")).toEqual([
      { title: "A better headline", published: null },
    ]);
    expect(await removePieceNow(form({ id }))).toEqual({ ok: true });
    expect(await removePieceNow(form({ id }))).toEqual({ ok: false, reason: "gone" });
    expect(await editPieceNow(piece({ id }))).toEqual({ ok: false, reason: "gone" });
    expect(await restorePieceNow(form({ id }))).toEqual({ ok: true });
    expect(await restorePieceNow(form({ id }))).toEqual({ ok: false, reason: "gone" });
  });

  it("refuse a piece with no headline or outlet, and throw on a kind the form doesn't offer", async () => {
    const { piece: id } = await findAndPiece();
    expect(await editPieceNow(piece({ id, title: "  " }))).toEqual({ ok: false, reason: "blank" });
    expect(await editPieceNow(piece({ id, outlet: "" }))).toEqual({ ok: false, reason: "noOutlet" });
    // A form without the fields at all, as from a script.
    expect(await editPieceNow(form({ id, medium: "Article" }))).toEqual({ ok: false, reason: "blank" });
    expect(await editPieceNow(form({ id, medium: "Article", title: "A headline" }))).toEqual({
      ok: false,
      reason: "noOutlet",
    });
    expect(await editFindNow(piece({ id, outlet: " " }))).toEqual({ ok: false, reason: "noOutlet" });
    // Nor any date or note: the piece has none.
    expect(
      await editPieceNow(form({ id, medium: "Article", title: "A headline", outlet: "The Example Gazette" })),
    ).toEqual({
      ok: true,
    });
    expect(await query("SELECT published, note FROM press_coverage")).toEqual([{ published: null, note: null }]);
    await expect(editPieceNow(piece({ id, medium: "Podcast" }))).rejects.toThrow(/kind it doesn't offer/);
  });

  it("add a piece staff found themselves, refusing one that isn't a web page's, or is in the coverage already", async () => {
    await findAndPiece();
    const url = "https://www.exampleradio.co.uk/joseph";
    expect(await addPieceNow(piece({ url, outlet: "Example Radio", date: "2026-10-15" }))).toEqual({ ok: true });
    refreshed();
    expect(await query("SELECT title FROM press_coverage WHERE url = $1", [url])).toEqual([
      { title: "Protesters march" },
    ]);
    expect(await addPieceNow(piece({ url }))).toEqual({ ok: false, reason: "known" });
    expect(await addPieceNow(piece({ url: "ftp://www.example.com/a" }))).toEqual({ ok: false, reason: "notUrl" });
    expect(await addPieceNow(piece({ url: "https://[" }))).toEqual({ ok: false, reason: "notUrl" });
    expect(await addPieceNow(piece())).toEqual({ ok: false, reason: "notUrl" });
    expect(await addPieceNow(piece({ url, title: "" }))).toEqual({ ok: false, reason: "blank" });
  });
});
