// A politician's markers: the marks staff set, and our own test politicians.
// The politicians list filters by them, and so do the letters' lists and
// every email's, which are of letters to politicians.

/** The markers, as the lists' filters offer them. */
export const POLITICIAN_FLAGS = ["important", "connection", "test"] as const;
export type PoliticianFlag = (typeof POLITICIAN_FLAGS)[number];

/** When a politician has each marker, `n` their notable_people row and `p` their politicians row. */
export const FLAG_CONDITIONS: Record<PoliticianFlag, string> = {
  important: "n.important_target",
  connection: "n.personal_connection",
  test: "p.is_test",
};
