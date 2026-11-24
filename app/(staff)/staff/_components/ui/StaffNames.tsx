"use client";

import { createContext, useContext, type ReactNode } from "react";

const Names = createContext<Record<string, string>>({});

/**
 * Every staff member's name, by address, for StaffMember to show in its
 * bubble, given by the signed-in pages' layout. Outside it, as on the login
 * page, there are none.
 */
export function StaffNames({ names, children }: { names: Record<string, string>; children: ReactNode }) {
  return <Names value={names}>{children}</Names>;
}

/** `email`'s name, if the layout gave one. */
export function useStaffName(email: string): string | undefined {
  return useContext(Names)[email.toLowerCase()];
}
