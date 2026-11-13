import "server-only";
import { config } from "@/lib/server/config";
import { outsideFetch } from "./outside-fetch";

// The only file that talks to Global's CRM, CiviCRM, through its chapter
// contacts API, with our UK chapter's key, CIVICRM_CHAPTER_KEY. Its spec is
// https://github.com/PauseAI/pauseai-civicrm/blob/main/docs/chapter-contacts-api.md,
// in a private repo. Three actions: `get`,
// every UK chapter contact a page at a time, or those with some addresses;
// `checkSuppression`, whether PauseAI may email each of some addresses at
// all, or call or text each of some numbers; and `updateSubscriptions`, our opt-outs, and lifts of "No bulk
// emails", sent back.

const API = "https://crm.pauseai.info/civicrm/ajax/api4/PauseaiChapterContact";

/** How many contacts a page of the pull holds; a shorter page is the last. */
export const PAGE_SIZE = 500;

/** A contact's place on one of the UK lists: on it, off it by their choice, never opted in, or not someone it's for. */
export const LIST_STATUSES = ["subscribed", "unsubscribed", "not_opted_in", "not_on_list"] as const;
export type ListStatus = (typeof LIST_STATUSES)[number];

/** What a contact said on a join form they wanted to do, the last one recorded; `none` when they picked nothing, or weren't asked. */
export const INTENTS = ["act_now", "volunteer", "lead", "none", "keep_informed"] as const;
export type Intent = (typeof INTENTS)[number];

/** A UK chapter contact, as `get` gives it, its address trimmed and lowercased; each member detail null when CiviCRM has none. */
export type CivicrmContact = {
  contactId: number;
  /** Their Airtable Members record, which is a member's ID, or null. */
  airtableId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  postalCode: string | null;
  /** The day they joined, YYYY-MM-DD. */
  joinedDate: string | null;
  intent: Intent | null;
  /** Their primary number. */
  phone: string | null;
  onHold: boolean;
  noBulkEmail: boolean;
  doNotEmail: boolean;
  doNotPhone: boolean;
  doNotSms: boolean;
  newsletter: ListStatus;
  volunteerUpdates: ListStatus;
};

class CivicrmRequestError extends Error {}

/** CIVICRM_CHAPTER_KEY, or throws: without it, nothing can be read from CiviCRM. */
export function civicrmKey(): string {
  const key = config.civicrmChapterKey;
  if (!key) throw new Error("CIVICRM_CHAPTER_KEY isn't set, so nothing can be read from CiviCRM");
  return key;
}

/** A field that must be true or false. */
function flag(row: Record<string, unknown>, field: string): boolean {
  const value = row[field];
  if (typeof value !== "boolean")
    throw new CivicrmRequestError(`CiviCRM gave a contact a ${field} that isn't true or false`);
  return value;
}

/** A field that's text or null; blank text is null. */
function detail(row: Record<string, unknown>, field: string): string | null {
  const value = row[field] ?? null;
  if (value !== null && typeof value !== "string") {
    throw new CivicrmRequestError(`CiviCRM gave a contact a ${field} that isn't text`);
  }
  return value?.trim() || null;
}

/** The day they joined, which must be YYYY-MM-DD, or null. */
function joinedDate(row: Record<string, unknown>): string | null {
  const value = detail(row, "joined_date");
  if (value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new CivicrmRequestError(`CiviCRM gave a contact a joined_date that isn't a day: ${value}`);
  }
  return value;
}

/** What they wanted to do, which must be one we know, or null. */
function intent(row: Record<string, unknown>): Intent | null {
  const value = detail(row, "intent");
  if (value !== null && !(INTENTS as readonly string[]).includes(value)) {
    throw new CivicrmRequestError(`CiviCRM gave a contact an intent we don't know: ${value}`);
  }
  return value as Intent | null;
}

/** A list's status, which must be one we know. */
function status(lists: Record<string, unknown>, list: string): ListStatus {
  const value = lists[list];
  if (!(LIST_STATUSES as readonly unknown[]).includes(value)) {
    throw new CivicrmRequestError(`CiviCRM gave a contact a ${list} status we don't know: ${String(value)}`);
  }
  return value as ListStatus;
}

/** A contact from a row of `get`; anything we don't expect throws, rather than store a guess. */
export function readContact(row: Record<string, unknown>): CivicrmContact {
  const { contact_id: contactId, airtable_id: airtableId, email, lists } = row;
  if (!Number.isSafeInteger(contactId) || (contactId as number) <= 0) {
    throw new CivicrmRequestError("CiviCRM gave a contact with no contact ID");
  }
  if (typeof email !== "string" || !email.trim()) {
    throw new CivicrmRequestError(`CiviCRM gave contact ${String(contactId)} no email`);
  }
  if (airtableId !== null && typeof airtableId !== "string") {
    throw new CivicrmRequestError(`CiviCRM gave contact ${String(contactId)} an Airtable ID that isn't text`);
  }
  if (typeof lists !== "object" || lists === null) {
    throw new CivicrmRequestError(`CiviCRM gave contact ${String(contactId)} no lists`);
  }
  const listed = lists as Record<string, unknown>;
  return {
    contactId: contactId as number,
    airtableId: airtableId || null,
    email: email.trim().toLowerCase(),
    firstName: detail(row, "first_name"),
    lastName: detail(row, "last_name"),
    city: detail(row, "city"),
    postalCode: detail(row, "postal_code"),
    joinedDate: joinedDate(row),
    intent: intent(row),
    phone: detail(row, "phone"),
    onHold: flag(row, "on_hold"),
    noBulkEmail: flag(row, "no_bulk_email"),
    doNotEmail: flag(row, "do_not_email"),
    doNotPhone: flag(row, "do_not_phone"),
    doNotSms: flag(row, "do_not_sms"),
    newsletter: status(listed, "newsletter"),
    volunteerUpdates: status(listed, "volunteer_updates"),
  };
}

/**
 * Calls `action` with `params`, by GET in the URL, or by POST in the body,
 * which keeps addresses out of URL logs, and gives its rows.
 */
async function call(
  key: string,
  action: string,
  params: object,
  method: "GET" | "POST",
): Promise<Record<string, unknown>[]> {
  const encoded = new URLSearchParams({ params: JSON.stringify(params) });
  const res = await outsideFetch(method === "GET" ? `${API}/${action}?${encoded}` : `${API}/${action}`, {
    method,
    headers: {
      "X-Civi-Auth": `Bearer ${key}`,
      "X-Requested-With": "XMLHttpRequest",
      ...(method === "POST" && { "Content-Type": "application/x-www-form-urlencoded" }),
    },
    ...(method === "POST" && { body: encoded.toString() }),
    cache: "no-store",
  });
  if (!res.ok) throw new CivicrmRequestError(`CiviCRM request failed with status ${res.status}: ${await res.text()}`);
  const data: unknown = await res.json();
  const values = (data as { values?: unknown })?.values;
  if (!Array.isArray(values)) throw new CivicrmRequestError(`CiviCRM's answer to ${action} had no list of values`);
  return values as Record<string, unknown>[];
}

/** A page of the UK chapter's contacts: up to PAGE_SIZE, in order of contact ID, after `after`. */
export async function fetchContactsPage(key: string, after: number): Promise<CivicrmContact[]> {
  return (await call(key, "get", { limit: PAGE_SIZE, after_contact_id: after }, "GET")).map(readContact);
}

/** The most addresses `checkSuppression` takes a call, and events `updateSubscriptions` does. */
export const SUPPRESSION_BATCH = 500;
export const UPDATE_BATCH = 100;

/**
 * Whether PauseAI may email an address: `all` stops every email, `bulk` bulk
 * email, `none` neither. `unchecked` is CiviCRM not having looked: until
 * Global lets the check answer for everyone, it does for an address that
 * isn't a UK contact's, which then follows our own records, as the spec has
 * it.
 */
export const BLOCKS = ["none", "bulk", "all", "unchecked"] as const;
export type Block = (typeof BLOCKS)[number];

/** Whether PauseAI may call or text a number: "Do not phone" stops calls, "Do not SMS" texts, WhatsApp too. */
export type NumberBlock = { doNotPhone: boolean; doNotSms: boolean };

/** What `checkSuppression` says of each address and number it was asked about. */
export type Suppressions = { emails: Map<string, Block>; phones: Map<string, NumberBlock> };

/**
 * Whether PauseAI anywhere blocks email to each of `emails`, by "Do not
 * email" (`all`) or "No bulk emails" (`bulk`), across every contact with the
 * address, in any chapter or none; and calls or texts to each of `phones`,
 * in international format, by "Do not phone" or "Do not SMS": up to
 * SUPPRESSION_BATCH of both a call. Each address and number as it was
 * asked: CiviCRM echoes each as sent, and an address is matched to its echo
 * whatever its case or the space round it, so neither can lose one its
 * answer. A flag CiviCRM leaves null, for a number it doesn't answer for,
 * blocks nothing, as the spec has it follow our own records. Throws if any
 * sent is missing, which the spec says never happens, or an address's block
 * isn't one we know.
 */
export async function checkSuppression(key: string, emails: string[], phones: string[] = []): Promise<Suppressions> {
  const rows = await call(key, "checkSuppression", { email: emails, phone: phones }, "POST");
  const found: Suppressions = { emails: new Map(), phones: new Map() };
  const answered = new Map<string, Block>();
  for (const row of rows) {
    if (typeof row.phone === "string") {
      found.phones.set(row.phone, { doNotPhone: row.do_not_phone === true, doNotSms: row.do_not_sms === true });
      continue;
    }
    if (typeof row.email !== "string") continue;
    if (!(BLOCKS as readonly unknown[]).includes(row.block)) {
      throw new CivicrmRequestError(`CiviCRM gave an address a block we don't know: ${String(row.block)}`);
    }
    answered.set(row.email.trim().toLowerCase(), row.block as Block);
  }
  for (const email of emails) {
    const block = answered.get(email.trim().toLowerCase());
    if (block) found.emails.set(email, block);
  }
  const missing = emails.filter((email) => !found.emails.has(email)).length;
  if (missing) throw new CivicrmRequestError(`CiviCRM didn't say whether ${missing} addresses are blocked`);
  const missingPhones = phones.filter((phone) => !found.phones.has(phone)).length;
  if (missingPhones) throw new CivicrmRequestError(`CiviCRM didn't say whether ${missingPhones} numbers are blocked`);
  return found;
}

/** A change to a UK list or a flag, as `updateSubscriptions` takes it: by address, or a number's flag by number. */
export type SubscriptionEvent = {
  /** Ours, unique: sending it again changes nothing there. */
  eventId: string;
  email?: string;
  /** In international format, for "Do not SMS" or "Do not phone". */
  phone?: string;
  change: "unsubscribe" | "no_bulk_email" | "allow_bulk_email" | "do_not_sms" | "do_not_phone";
  list?: "newsletter" | "volunteer_updates";
  /** From the last pull, for an opt-out. */
  contactId?: number;
  occurredAt: Date;
  /** Where the person did it. */
  source: string;
  /** For a lift: the words beside what they chose. */
  wording?: string;
};

/** What CiviCRM did with an event: applied it (or it was already so), refused an opt-in and why, or found it wrong. */
export type SubscriptionResult =
  { status: "accepted"; reason?: undefined } | { status: "refused" | "invalid"; reason: string };

/**
 * Sends up to UPDATE_BATCH events, applied in order, and gives CiviCRM's
 * result for each by its ID. Throws if CiviCRM fails, so none has a result.
 */
export async function updateSubscriptions(
  key: string,
  events: SubscriptionEvent[],
): Promise<Map<string, SubscriptionResult>> {
  const rows = await call(
    key,
    "updateSubscriptions",
    {
      events: events.map((event) => ({
        event_id: event.eventId,
        ...(event.email && { email: event.email }),
        ...(event.phone && { phone: event.phone }),
        change: event.change,
        ...(event.list && { list: event.list }),
        ...(event.contactId && { contact_id: event.contactId }),
        occurred_at: event.occurredAt.toISOString(),
        source: event.source,
        ...(event.wording && { wording: event.wording }),
      })),
    },
    "POST",
  );
  const results = new Map<string, SubscriptionResult>();
  for (const row of rows) {
    const status = row.status;
    if (typeof row.event_id !== "string") continue;
    if (status === "accepted") results.set(row.event_id, { status });
    else if (status === "refused" || status === "invalid") {
      results.set(row.event_id, { status, reason: String(row.reason ?? row.error ?? "") });
    }
  }
  return results;
}
