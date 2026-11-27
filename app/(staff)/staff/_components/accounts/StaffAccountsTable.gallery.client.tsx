"use client";

// StaffAccountsTable's examples that log what their forms do (StaffAccountsTable.gallery.tsx).
import { Logged, loggedDone } from "@/app/(tools)/gallery/_components/wiring";
import type { StaffAccount } from "@/lib/accounts/staff-accounts.server";
import StaffAccountsTable, { AddStaff } from "./StaffAccountsTable";

/** Add staff, at the accounts page's top right: its box adds someone, logged; jo@pauseai.uk is there already. */
export function AddStaffExample() {
  return (
    <Logged>
      {(log) => (
        <AddStaff accounts={[{ email: "jo@pauseai.uk" } as StaffAccount]} add={loggedDone(log, "saveStaffAccount")} />
      )}
    </Logged>
  );
}

/** The seeded admin, never logged in; an admin looking, logged in twice; and someone their first login added; each row's forms logged. */
export function StaffAccountsTableExample() {
  return (
    <Logged>
      {(log) => (
        <StaffAccountsTable
          save={loggedDone(log, "saveStaffAccount")}
          remove={loggedDone(log, "removeStaffAccount")}
          endSessions={loggedDone(log, "endStaffSessions")}
          you="jo@pauseai.uk"
          sort={{ key: "email", dir: "asc" }}
          accounts={[
            {
              email: "admin@pauseai.uk",
              name: null,
              permissions: ["admin"],
              addedBy: "migration",
              addedAt: new Date("2026-10-16T12:00:00Z"),
              lastLoginAt: null,
              lastSeenAt: null,
              sessions: 0,
              gmailConnectedAt: null,
            },
            {
              email: "jo@pauseai.uk",
              name: "Jo Bloggs",
              permissions: ["admin"],
              addedBy: "admin@pauseai.uk",
              addedAt: new Date("2026-10-20T09:00:00Z"),
              lastLoginAt: new Date("2026-10-22T08:00:00Z"),
              lastSeenAt: new Date("2026-10-22T09:15:00Z"),
              sessions: 2,
              gmailConnectedAt: new Date("2026-10-21T09:00:00Z"),
            },
            {
              email: "samuel.whitlock@pauseai.uk",
              name: "Samuel Whitlock",
              permissions: [],
              addedBy: "login",
              addedAt: new Date("2026-10-21T10:30:00Z"),
              lastLoginAt: new Date("2026-10-21T10:30:00Z"),
              lastSeenAt: new Date("2026-10-21T11:00:00Z"),
              sessions: 1,
              gmailConnectedAt: null,
            },
          ]}
        />
      )}
    </Logged>
  );
}
