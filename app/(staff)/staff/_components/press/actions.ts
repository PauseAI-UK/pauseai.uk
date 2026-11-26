"use server";

// The staff Press page's Server Actions. Each is a public endpoint, so each
// calls requireStaff() before anything else (tests/checks/staff-auth.test.ts).
// Each that changes what /press shows refreshes it, so the change shows at
// once. A find or piece decided since the page loaded is "gone".
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/accounts/auth.server";
import { refused, type FormResult } from "@/lib/form-result";
import {
  addFind,
  addPiece,
  editFind,
  editPiece,
  removePiece,
  restorePiece,
  turnDownFind,
  type PieceEdit,
} from "@/lib/press/finds.server";
import { MEDIA } from "@/lib/press/coverage";
import { ownId, ownText } from "@/lib/staff-forms";

function refresh(): void {
  revalidatePath("/staff/press");
  revalidatePath("/press");
}

/** Adds a find, waiting or removed, to /press. */
export async function addFindNow(form: FormData): Promise<FormResult<"gone">> {
  const { email } = await requireStaff();
  const done = await addFind(ownId(form), email);
  refresh();
  return done ? { ok: true } : refused("gone");
}

/** Removes a waiting find. */
export async function turnDownFindNow(form: FormData): Promise<FormResult<"gone">> {
  const { email } = await requireStaff();
  const done = await turnDownFind(ownId(form), email);
  refresh();
  return done ? { ok: true } : refused("gone");
}

/** What a piece's form sends, or why it can't be taken: a headline or outlet that's only spaces. */
function pieceFrom(form: FormData): FormResult<"blank" | "noOutlet", { piece: PieceEdit }> {
  // Its kind comes from the form's own choices, so any other is a bug in the form, which throws.
  const medium = MEDIA.find((kind) => kind === ownText(form, "medium"));
  if (!medium) throw new Error(`A press piece's form came with a kind it doesn't offer: ${ownText(form, "medium")}`);
  const title = String(form.get("title") ?? "").trim();
  if (!title) return refused("blank");
  const outlet = String(form.get("outlet") ?? "").trim();
  if (!outlet) return refused("noOutlet");
  const date = String(form.get("date") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  return {
    ok: true,
    piece: { title, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, note: note || null, medium, outlet },
  };
}

/** Sets a piece's headline, date, note, kind and outlet. */
export async function editPieceNow(form: FormData): Promise<FormResult<"gone" | "blank" | "noOutlet">> {
  const { email } = await requireStaff();
  const id = ownId(form);
  const read = pieceFrom(form);
  if (!read.ok) return read;
  const done = await editPiece(id, read.piece, email);
  refresh();
  return done ? { ok: true } : refused("gone");
}

/** Sets what a find goes on /press with: its headline, outlet, kind, date and note. */
export async function editFindNow(form: FormData): Promise<FormResult<"gone" | "blank" | "noOutlet">> {
  const { email } = await requireStaff();
  const id = ownId(form);
  const read = pieceFrom(form);
  if (!read.ok) return read;
  const done = await editFind(id, read.piece, email);
  refresh();
  return done ? { ok: true } : refused("gone");
}

/** Puts a piece staff found themselves on /press. An address that isn't a web page's, or is on /press already, is refused. */
export async function addPieceNow(form: FormData): Promise<FormResult<"blank" | "noOutlet" | "notUrl" | "known">> {
  const { email } = await requireStaff();
  const read = pieceFrom(form);
  if (!read.ok) return read;
  const url = String(form.get("url") ?? "").trim();
  if (!/^https?:\/\//.test(url) || !URL.canParse(url)) return refused("notUrl");
  const added = await addPiece({ ...read.piece, url }, email);
  if (added === "known") return refused("known");
  refresh();
  return { ok: true };
}

/** Takes a piece off /press. */
export async function removePieceNow(form: FormData): Promise<FormResult<"gone">> {
  const { email } = await requireStaff();
  const done = await removePiece(ownId(form), email);
  refresh();
  return done ? { ok: true } : refused("gone");
}

/** Adds a removed piece to /press again. */
export async function restorePieceNow(form: FormData): Promise<FormResult<"gone">> {
  const { email } = await requireStaff();
  const done = await restorePiece(ownId(form), email);
  refresh();
  return done ? { ok: true } : refused("gone");
}
