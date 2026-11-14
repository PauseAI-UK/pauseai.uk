// Logging staff in, for the flows of the staff pages: each flow's own staff
// address, its account, and the fixture build's dev login. The staff-login
// section logs in with the emailed link itself.
import type { Page } from "@playwright/test";
import { DEV_LOGIN_PATH, NEXT_PARAM } from "@/lib/staff-session";
import { runSql } from "@/scripts/fresh-database.mjs";
import { BASE, test } from "./fixtures";

/** This flow's own staff address: flows run alongside each other, and share the outbox. Short, as real ones are. */
export const staffEmail = () => `staff-${test.info().testId.replace(/\W/g, "").slice(-8)}@pauseai.uk`;

/**
 * Gives `email` a staff account in a flow's database, with `permissions`,
 * as an admin would on /staff/accounts. Logging in without one makes one
 * with no permissions.
 */
export function addStaffAccount(database: string, email: string, permissions: string[] = []) {
  const list = `{${permissions.join(",")}}`;
  runSql(
    database,
    `INSERT INTO staff_accounts (email, permissions, added_by) VALUES ('${email}', '${list}', 'admin@pauseai.uk')
     ON CONFLICT (email) DO UPDATE SET permissions = '${list}'`,
  );
}

/**
 * Logs in on `base` as `email` with the fixture build's dev login
 * (app/(staff)/staff/api/dev-login): a session at once, which the callback
 * of a login link would have given. Given `to`, a staff page, the page lands
 * there, as a login asked for from it does; without, it stays where it was,
 * for the flow to open the page it's going to. So only the flows about the
 * staff home open it, and a change to the home reruns only them.
 */
export async function logInAsStaff(page: Page, base: string, email = "staff@pauseai.uk", to?: string): Promise<void> {
  const form: Record<string, string> = to ? { email, [NEXT_PARAM]: to } : { email };
  const res = await page.request.post(`${base}${DEV_LOGIN_PATH}`, { form, maxRedirects: 0 });
  if (res.status() !== 303) throw new Error(`The dev login on ${base} refused ${email}: ${res.status()}`);
  if (!to) return;
  const landing = new URL(res.headers().location, base);
  if (`${landing.pathname}${landing.search}` !== to) throw new Error(`The dev login on ${base} won't land on ${to}`);
  await page.goto(`${base}${to}`);
}

/** Gives this flow's staff member an account, then logs them in, landing on `to` if given (logInAsStaff). */
export async function logIn(page: Page, database: string, permissions: string[] = [], to?: string) {
  addStaffAccount(database, staffEmail(), permissions);
  return logInAsStaff(page, BASE, staffEmail(), to);
}
