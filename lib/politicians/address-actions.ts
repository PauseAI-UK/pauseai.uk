// The audit log's actions on a politician's addresses, apart from the rest of
// the log's (lib/audit-events.ts), which the code imports only as types: the
// politicians' records and the log's retention take these at run time.

/** The actions on a politician's addresses, by `politicianId`: part of their history. */
export const ADDRESS_ACTIONS = ["add politician address", "remove politician address"] as const;
