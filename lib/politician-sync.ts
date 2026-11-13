// Politicians as Airtable's UK Parliamentarians has them
// (lib/server/outside-services/airtable.ts), and what a copy from it
// changed (lib/server/politician-sync.ts).

/** A politician as Airtable has them, by their record. */
export type SyncedPolitician = {
  /** Airtable's record ID. */
  airtableId: string;
  name: string;
  salutation: string;
  email: string | null;
  status: "in_office" | "died" | "retired" | "left_office";
  house: "commons" | "lords" | "scottish-parliament" | "senedd" | "ni-assembly" | "other";
  constituency: string | null;
  party: string;
  country: "england" | "scotland" | "wales" | "northern-ireland" | null;
  notes: string;
  importantTarget: boolean;
  personalConnection: boolean;
};

/** One Airtable record: the politician. */
export type PoliticianRecord = { politician: SyncedPolitician };

/** Who a copy changed. Runs kept from when it added and removed politicians list those too. */
export type PoliticianChanges = {
  added: SyncedPolitician[];
  removed: SyncedPolitician[];
  changed: SyncedPolitician[];
};

/** A record whose name changed, in a run kept from when the copy held for those. */
export type Renamed = { airtableId: string; from: string; to: string };

export function changeCount(changes: PoliticianChanges): number {
  return changes.added.length + changes.removed.length + changes.changed.length;
}
