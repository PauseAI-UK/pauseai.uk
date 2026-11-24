// What the database's code tells the log that isn't a problem (note() in
// lib/server/problems.server.ts). A file of its own, as nearly every page
// queries the database: in ./copy.ts, a change to any problem's words would
// be a change to them all.
export const dbCopy = {
  notes: {
    // Nobody sees anything: the next query carries on.
    connectionDropped: "A database connection was dropped while idle",
  },
};
