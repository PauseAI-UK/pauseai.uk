import "server-only";
import { config } from "@/lib/server/config";
import { outsideFetch } from "./outside-fetch";

// The only file that talks to Global's CRM, CiviCRM, through its chapter
// contacts API, with our UK chapter's key, CIVICRM_CHAPTER_KEY. Its spec is
// PauseAI/pauseai-civicrm#1175, which is private. It reads `get` alone:
// every UK chapter contact a page at a time, or those with some addresses.
// Nothing here writes to CiviCRM.

const API = "https://crm.pauseai.info/civicrm/ajax/api4/PauseaiChapterContact";

/** How many contacts a page of the pull holds; a shorter page is the last. */
export const PAGE_SIZE = 500;

/** A contact's place on one of the UK lists: on it, off it by their choice, never opted in, or not someone it's for. */
export const LIST_STATUSES = ["subscribed", "unsubscribed", "not_opted_in", "not_on_list"] as const;
export type ListStatus = (typeof LIST_STATUSES)[number];

/** A UK chapter contact, as `get` gives it, its address trimmed and lowercased. */
export type CivicrmContact = {
  contactId: number;
  /** Their Airtable Members record, which is a member's ID, or null. */
  airtableId: string | null;
  email: string;
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
    onHold: flag(row, "on_hold"),
    noBulkEmail: flag(row, "no_bulk_email"),
    doNotEmail: flag(row, "do_not_email"),
    doNotPhone: flag(row, "do_not_phone"),
    doNotSms: flag(row, "do_not_sms"),
    newsletter: status(listed, "newsletter"),
    volunteerUpdates: status(listed, "volunteer_updates"),
  };
}

/** Calls `get` with `params`, by GET in the URL, or by POST in the body, which keeps addresses out of URL logs. */
async function get(key: string, params: object, method: "GET" | "POST"): Promise<CivicrmContact[]> {
  const encoded = new URLSearchParams({ params: JSON.stringify(params) });
  const res = await outsideFetch(method === "GET" ? `${API}/get?${encoded}` : `${API}/get`, {
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
  if (!Array.isArray(values)) throw new CivicrmRequestError("CiviCRM's answer had no list of contacts");
  return values.map((row) => readContact(row as Record<string, unknown>));
}

/** A page of the UK chapter's contacts: up to PAGE_SIZE, in order of contact ID, after `after`. */
export function fetchContactsPage(key: string, after: number): Promise<CivicrmContact[]> {
  return get(key, { limit: PAGE_SIZE, after_contact_id: after }, "GET");
}

/** The UK chapter's contacts with any of `emails`. */
export function lookUpContacts(key: string, emails: string[]): Promise<CivicrmContact[]> {
  return get(key, { email: emails }, "POST");
}
