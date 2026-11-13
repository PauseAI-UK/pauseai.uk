import "server-only";
import { config } from "@/lib/server/config";
import type { PoliticianRecord, SyncedPolitician } from "@/lib/politician-sync";
import { outsideFetch } from "./outside-fetch";

// Only file allowed to talk to api.airtable.com (enforced by the
// no-restricted-syntax rule in eslint.config.mjs) so the filters and field
// whitelists below can't be bypassed by a new call site elsewhere. Read only.
//
// Airtable's "UK Parliamentarians" table is the source of truth for who the
// politicians are and their emails. The site copies them nightly
// (lib/server/politician-sync.ts); their answers to asks are kept only in
// our database.
const BASE_ID = "appBInVvIm6opJ1Ob";
const TABLE_ID = "tblH3ks9wqQHLpYx3";

/** The table in Airtable's own interface, for staff to open. */
export const PARLIAMENTARIANS_TABLE_URL = `https://airtable.com/${BASE_ID}/${TABLE_ID}`;

export class AirtableRequestError extends Error {}

/** AIRTABLE_TOKEN, or throws: without it, nothing can be read from Airtable. */
export function airtableToken(): string {
  const token = config.airtableToken;
  if (!token) throw new Error("AIRTABLE_TOKEN isn't set, so nothing can be read from Airtable");
  return token;
}

// Well past any realistic table (each page holds up to 100 records), so a
// repeated/looping offset can't spin the request forever.
const MAX_PAGES = 100;

type AirtableRecord = { id: string; fields: Record<string, unknown> };

/** Every record in UK Parliamentarians matching `formula`, with only `fields`. */
async function fetchRecords(token: string, formula: string, fields: readonly string[]): Promise<AirtableRecord[]> {
  const params = new URLSearchParams();
  params.set("filterByFormula", formula);
  for (const field of fields) params.append("fields[]", field);
  const found: AirtableRecord[] = [];
  let offset: string | undefined;
  let pages = 0;
  do {
    if (++pages > MAX_PAGES) throw new AirtableRequestError(`Airtable pagination exceeded ${MAX_PAGES} pages`);
    if (offset) params.set("offset", offset);
    const res = await outsideFetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    // Airtable says what's wrong (a field the table doesn't have, a bad
    // formula) in the body, which the log needs to say which.
    if (!res.ok)
      throw new AirtableRequestError(`Airtable request failed with status ${res.status}: ${await res.text()}`);
    const data = await res.json();
    found.push(...(data.records ?? []));
    offset = data.offset;
  } while (offset);
  return found;
}

/** A field as trimmed text, or "" if it's missing or not text. */
function text(record: AirtableRecord, field: string): string {
  const value = record.fields[field];
  return typeof value === "string" ? value.trim() : "";
}

// Every politician but the records ticked Test: the site keeps its own test
// MPs (lib/test-mps.json).
export const POLITICIANS_FORMULA = "NOT({Test})";

/** The only fields read from a politician's record. */
export const POLITICIAN_FIELDS = [
  "Full name or Title",
  "Salutation",
  "Email",
  "Status",
  "Body",
  "Constituency",
  "Party",
  "Country",
  "Notes",
  "Recommended",
  "Important target",
  "Personal connection",
] as const;

const STATUSES: Record<string, SyncedPolitician["status"]> = {
  "": "in_office",
  Died: "died",
  Retired: "retired",
  "No longer in office": "left_office",
};

const HOUSES: Record<string, SyncedPolitician["house"]> = {
  "House of Commons": "commons",
  "House of Lords": "lords",
  "Scottish Parliament": "scottish-parliament",
  "Welsh Parliament": "senedd",
  "Northern Ireland Assembly": "ni-assembly",
};

const COUNTRIES: Record<string, SyncedPolitician["country"]> = {
  England: "england",
  Scotland: "scotland",
  Wales: "wales",
  "Northern Ireland": "northern-ireland",
};

/**
 * One record as a politician. Without a Body, someone with no constituency
 * is a peer; a Status or Country it doesn't know is refused, so the sync
 * fails rather than guess.
 */
function politicianFrom(record: AirtableRecord): SyncedPolitician {
  const body = text(record, "Body");
  const constituency = text(record, "Constituency") || null;
  const status = STATUSES[text(record, "Status")];
  if (!status) throw new AirtableRequestError(`Unknown Status "${text(record, "Status")}" on ${record.id}`);
  const country = text(record, "Country");
  if (country && !COUNTRIES[country]) throw new AirtableRequestError(`Unknown Country "${country}" on ${record.id}`);
  return {
    airtableId: record.id,
    name: text(record, "Full name or Title"),
    salutation: text(record, "Salutation"),
    email: text(record, "Email") || null,
    status,
    house: HOUSES[body] ?? (body || constituency ? "other" : "lords"),
    constituency,
    party: text(record, "Party"),
    country: COUNTRIES[country] ?? null,
    notes: [text(record, "Notes"), ticked(record, "Recommended") ? "Recommended" : ""].filter(Boolean).join("\n"),
    importantTarget: ticked(record, "Important target"),
    personalConnection: ticked(record, "Personal connection"),
  };
}

/** Every politician in UK Parliamentarians but the test records, by name. */
export async function fetchPoliticians(token: string): Promise<PoliticianRecord[]> {
  const records = await fetchRecords(token, POLITICIANS_FORMULA, POLITICIAN_FIELDS);
  return records
    .map((record) => ({ politician: politicianFrom(record) }))
    .sort((a, b) => a.politician.name.localeCompare(b.politician.name));
}

/** A checkbox: Airtable leaves out an unticked one. */
function ticked(record: AirtableRecord, field: string): boolean {
  return record.fields[field] === true;
}
