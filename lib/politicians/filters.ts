// The values the politicians list's filters choose among, shared by the
// server's query (lib/politicians/records.ts) and the filter bar.

/** The nations a politician can be in. */
export const COUNTRIES = ["england", "scotland", "wales", "northern-ireland"] as const;
export type Country = (typeof COUNTRIES)[number];

/** The politicians list's markers: the marks staff set, and our own test politicians. */
export const POLITICIAN_FLAGS = ["important", "connection", "test"] as const;
export type PoliticianFlag = (typeof POLITICIAN_FLAGS)[number];

/** Whether we can write to them: an address we can use, none, or one that's blocked. */
export const EMAIL_STATES = ["yes", "none", "blocked"] as const;
export type EmailState = (typeof EMAIL_STATES)[number];

/** The houses a politician can be in. */
export const HOUSES = ["commons", "lords", "scottish-parliament", "senedd", "ni-assembly", "other"] as const;
export type House = (typeof HOUSES)[number];

export function isHouse(value: string): value is House {
  return (HOUSES as readonly string[]).includes(value);
}

/** Whether they're in office. One who leaves is marked, never deleted. */
export const PERSON_STATUSES = ["in_office", "died", "retired", "left_office"] as const;
export type PersonStatus = (typeof PERSON_STATUSES)[number];

export function isPersonStatus(value: string): value is PersonStatus {
  return (PERSON_STATUSES as readonly string[]).includes(value);
}
