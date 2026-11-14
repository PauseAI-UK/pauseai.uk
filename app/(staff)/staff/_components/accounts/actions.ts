"use server";

// Staff accounts' Server Actions: the accounts page's, and your own page's.
// Each is a public endpoint, so each calls requireStaff() before anything
// else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/accounts/auth.server";
import { disconnectGmail } from "@/lib/accounts/gmail-accounts.server";
import {
  type AccountChange,
  endStaffSessions,
  removeStaffAccount,
  saveStaffAccount,
} from "@/lib/accounts/staff-accounts.server";
import { permissionsFrom } from "@/lib/staff-forms";

/** Where the accounts page goes after a change: back to itself, saying why if the change was refused. */
function accountsPage(change: AccountChange | "removed"): never {
  revalidatePath("/staff/accounts");
  redirect(change === "changed" || change === "unchanged" ? "/staff/accounts" : `/staff/accounts?notice=${change}`);
}

/**
 * The accounts page: gives an address an account with exactly the
 * permissions in the form, adding it if it has none, as the admin. A
 * change refused (the last admin, an address not at pauseai.uk) is said on
 * the page.
 */
export async function saveStaffAccountNow(form: FormData): Promise<void> {
  const { email } = await requireStaff("admin");
  const parsed = permissionsFrom(form);
  if (!parsed) return;
  accountsPage(await saveStaffAccount(parsed.email, parsed.permissions, email));
}

/** The accounts page: removes an account, ending its sessions, and says what that leaves them. */
export async function removeStaffAccountNow(form: FormData): Promise<void> {
  const { email } = await requireStaff("admin");
  const parsed = permissionsFrom(form);
  if (!parsed) return;
  const change = await removeStaffAccount(parsed.email, email);
  accountsPage(change === "changed" ? "removed" : change);
}

/** The accounts page: ends every session of an account, as the admin; their own included, which logs them out. */
export async function endStaffSessionsNow(form: FormData): Promise<void> {
  const { email } = await requireStaff("admin");
  const parsed = permissionsFrom(form);
  if (!parsed) return;
  await endStaffSessions(parsed.email, email);
  accountsPage("changed");
}

/** Disconnects your own Gmail, from your page, going back to it saying so, in place of how connecting went. */
export async function disconnectMyGmail(): Promise<void> {
  const { email } = await requireStaff();
  await disconnectGmail(email, email);
  revalidatePath("/staff/me");
  redirect("/staff/me?gmail=disconnected");
}
