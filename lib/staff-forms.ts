// Reads the staff interface's forms (docs/code-structure.md, "Errors"). A
// field a form fills in itself is thrown on when it isn't what the form
// sends; what staff typed that can't be taken is answered as a refusal.
import { ASK_STATUSES, ASKERS, INVITED, type Asker, type AskKind, type RecordedStatus } from "@/lib/asks/asks";
import { answeredByHand } from "@/lib/email-your-mp";
import { refused, type FormResult } from "@/lib/form-result";
import { SAVED, SAVED_LISTS, type SavedList } from "@/lib/saved-filters";
import { PERMISSIONS, type Permission } from "@/lib/accounts/permissions";
import { fromLondon, SENDING } from "@/lib/staff-time";
import { isInternational } from "@/lib/phone";

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * A positive whole number, such as a row's ID, or none. Kept to this file,
 * so no action can read an ID and carry on without one: an action reads it
 * with ownId.
 */
function idFrom(form: FormData, name = "id"): number | undefined {
  const value = text(form, name);
  return /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : undefined;
}

/**
 * A row's ID, which the form fills in itself: thrown when it isn't one, as
 * that's a bug in the form or a request made up, never what staff typed.
 */
export function ownId(form: FormData, name = "id"): number {
  const id = idFrom(form, name);
  if (!id) throw new Error(`A form's "${name}" isn't a row's ID`);
  return id;
}

/**
 * A field the form fills in itself with something, such as a slug or an
 * address of a row's: thrown when it's blank, as that's a bug in the form
 * or a request made up.
 */
export function ownText(form: FormData, name: string): string {
  const value = text(form, name);
  if (!value) throw new Error(`A form came without its "${name}"`);
  return value;
}

/**
 * When a form says something goes: its day, as YYYY-MM-DD, hour and minute,
 * in London, a minute the sending runs at; undefined if any isn't one.
 */
export function dueAtFrom(form: FormData): Date | undefined {
  const day = form.get("day");
  const hour = Number(form.get("hour"));
  const minute = Number(form.get("minute"));
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !(hour >= 0 && hour < 24)) return undefined;
  if (!(SENDING.minutes as readonly number[]).includes(minute)) return undefined;
  return fromLondon(day, hour, minute);
}

/** The list a saved filter's form says it's for, if it's one that has them. */
function savedListOf(form: FormData): SavedList | undefined {
  return SAVED_LISTS.find((list) => list === text(form, "list"));
}

/**
 * The list a saved filter's form is for, which the form fills in itself:
 * thrown without one, as that's a bug in the form or a request made up.
 */
export function savedListFrom(form: FormData): SavedList {
  const list = savedListOf(form);
  if (!list) throw new Error("A saved filter's form came without its list");
  return list;
}

/**
 * What a staff member needs to change the saved filters of the list a form
 * is for: what the list needs; an account, for none. Asked before anyone's
 * known to be staff, so it throws nothing.
 */
export function savedFilterNeeds(form: FormData): Permission | "account" {
  const list = savedListOf(form);
  return list ? SAVED[list].needs : "account";
}

/** A saved filter's name, as typed: one line, or blank. */
export function savedNameFrom(form: FormData): string {
  return text(form, "name").replace(/\s+/g, " ");
}

export type StatusForm = { politicianId: number; ask: string; status: RecordedStatus | null; note: string };

/**
 * Setting an answer to an ask on a politician's page: only an ask staff
 * record by hand (answeredByHand), and a status some kind of ask allows,
 * INVITED among them, or blank to clear it, with a note of how they know.
 * Whether the ask's kind allows it is the database's to say. Whom, which
 * ask and the status are the form's own, so thrown when they aren't those;
 * the note is typed, and refused when it's blank.
 */
export function statusFrom(form: FormData): FormResult<"blank", StatusForm> {
  const politicianId = ownId(form, "politicianId");
  const ask = ownText(form, "ask");
  const status = text(form, "status");
  const statuses: readonly string[] = [...Object.values(ASK_STATUSES).flat(), INVITED];
  if (!answeredByHand(ask)) throw new Error("An answer's form came for an ask an import fills");
  if (status && !statuses.includes(status)) throw new Error("An answer's form came with a status no ask allows");
  const note = text(form, "note");
  if (!note) return refused("blank");
  return { ok: true, politicianId, ask, status: (status as RecordedStatus) || null, note };
}

/** A link to a Google Doc, or to anything else in Google Drive: what an event's doc box takes, as its pattern attribute says it. */
export const GOOGLE_DOC_PATTERN = "https://(docs|drive)\\.google\\.com/.*";

export type EventForm = { eventId: string; owner: string | null; doc: string | null };

/**
 * An event's edit form on the events page: which event, by Luma's ID; its
 * owner's address, blank for none chosen; and the link to its Google Doc,
 * blank to clear it. The event is the form's own, and its doc box sends
 * nothing its pattern doesn't fit, so thrown without the event, or with a
 * link anywhere else.
 */
export function eventFrom(form: FormData): EventForm {
  const eventId = ownText(form, "eventId");
  const owner = text(form, "owner").toLowerCase();
  const doc = text(form, "doc");
  if (doc && !new RegExp(`^${GOOGLE_DOC_PATTERN}$`).test(doc))
    throw new Error("An event's form came with a link that isn't to Google Docs or Drive");
  return { eventId, owner: owner || null, doc: doc || null };
}

export type UnblockForm = { address: string; note: string };

/**
 * Unblocking an address or a number, in international format: which, the
 * form's own, so thrown when it's neither; and the note for the audit log,
 * which is typed, and refused when it's blank.
 */
export function unblockFrom(form: FormData): FormResult<"blank", UnblockForm> {
  const address = text(form, "address").toLowerCase();
  if (!(address.includes("@") || isInternational(address)))
    throw new Error(`A form's "address" isn't an address or a number`);
  const note = text(form, "note");
  if (!note) return refused("blank");
  return { ok: true, address, note };
}

export type PermissionsForm = { email: string; permissions: Permission[] };

/**
 * One account, as the accounts table sends it for each change: whose, as
 * typed for someone new, so maybe no address at all, which saving it
 * refuses; and each permission's checkbox, named "permission:<name>",
 * ticked or not.
 */
export function permissionsFrom(form: FormData): PermissionsForm {
  const email = text(form, "email").toLowerCase();
  return { email, permissions: PERMISSIONS.filter((permission) => form.get(`permission:${permission}`) !== null) };
}

/**
 * Whose account a row's form is about, which the form fills in itself:
 * thrown when it isn't an address, as that's a bug in the form or a request
 * made up.
 */
export function ownEmail(form: FormData): string {
  const email = text(form, "email").toLowerCase();
  if (!email.includes("@")) throw new Error(`A form's "email" isn't an address`);
  return email;
}

export type EraseForm = { id: number; reference: string };

/**
 * The erase form on a supporter's page: whom, and its box ticked, both the
 * form's own, as its button waits for the tick, so thrown without either;
 * and the request's reference, which is typed, and refused when it's blank.
 */
export function eraseFrom(form: FormData): FormResult<"blank", EraseForm> {
  const id = ownId(form);
  if (text(form, "confirm") === "") throw new Error("An erase form came without its box ticked");
  const reference = text(form, "reference");
  if (!reference) return refused("blank");
  return { ok: true, id, reference };
}

export type AskForm = {
  title: string;
  kind: AskKind;
  date: string | null;
  url: string | null;
  askedBy: Asker[];
};

/**
 * An ask's form: a title and a kind, and maybe a date (yyyy-mm-dd), a link
 * (one of ours, from /, or another site's, https://) and who asks it.
 * All of it is the form's own doing, so anything else is thrown: the kind
 * and the date come from its buttons and its date picker, and its Save is
 * off until there's a title and any link is a whole one.
 */
export function askFrom(form: FormData): AskForm {
  const title = text(form, "title");
  const kind = text(form, "kind");
  const date = text(form, "date");
  const url = text(form, "url");
  const askedBy = form.getAll("askedBy").filter((one): one is Asker => (ASKERS as readonly unknown[]).includes(one));
  if (!Object.hasOwn(ASK_STATUSES, kind)) throw new Error("An ask's form came without its kind");
  if (date && !(/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date))))
    throw new Error("An ask's form came with a date that isn't one");
  if (!title) throw new Error("An ask's form came without its title");
  if (url && !url.startsWith("https://")) throw new Error("An ask's form came with a link that isn't a whole one");
  return { title, kind: kind as AskKind, date: date || null, url: url || null, askedBy: [...new Set(askedBy)] };
}

export type NoteForm = { target: { supporterId: number } | { politicianId: number }; body: string };

/**
 * A new note: on whom, by a supporter's or a politician's ID, the form's
 * own, so thrown without one, or with both; and what it says, which is
 * typed, and refused when it's blank.
 */
export function noteFrom(form: FormData): FormResult<"blank", NoteForm> {
  const supporterId = idFrom(form, "supporterId");
  const politicianId = idFrom(form, "politicianId");
  if (!supporterId === !politicianId) throw new Error("A note's form came without the one it's about");
  const body = text(form, "body");
  if (!body) return refused("blank");
  return { ok: true, target: supporterId ? { supporterId } : { politicianId: Number(politicianId) }, body };
}

export type NoteEditForm = { id: number; body: string };

/**
 * A note's new text: which note, the form's own, so thrown when it isn't
 * one; and what it says now, which is typed, and refused when it's blank.
 */
export function noteEditFrom(form: FormData): FormResult<"blank", NoteEditForm> {
  const id = ownId(form);
  const body = text(form, "body");
  if (!body) return refused("blank");
  return { ok: true, id, body };
}
