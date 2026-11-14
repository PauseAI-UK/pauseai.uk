import { afterEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { NOTIFICATIONS, notifications, toNotifications } from "@/tests/notifications";
import { saveStaffAccount } from "@/lib/accounts/staff-accounts.server";
import { query } from "@/lib/server/db.server";
import { notifyStaff, staffLink } from "./notifications.server";

afterEach(() => vi.unstubAllEnvs());

it("links to the site where the build knows its address, and gives the path where it can't", () => {
  vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
  expect(staffLink("/staff/letters", undefined)).toBe("https://pauseai.uk/staff/letters");
  vi.stubEnv("SITE_ORIGIN", "");
  vi.stubEnv("DEPLOY_CONTEXT", "local");
  expect(staffLink("/staff/letters", undefined)).toBe("/staff/letters");
});

describeWithDatabase("notifyStaff", () => {
  useTestDatabase();

  it("emails the notification inbox, logged as a staff alert, and nothing where it isn't set", async () => {
    const sent = notifications();
    expect(await notifyStaff("Subject", "Body")).toBe(true);
    expect(sent).toEqual([expect.objectContaining({ To: toNotifications(), Subject: "Subject", TextBody: "Body" })]);
    expect(await query("SELECT purpose, address, letter_id FROM email_sends")).toEqual([
      { purpose: "staff-alert", address: NOTIFICATIONS, letter_id: null },
    ]);
    vi.stubEnv("NOTIFICATION_INBOX", "");
    expect(await notifyStaff("Subject", "Body")).toBe(false);
    expect(sent).toHaveLength(1);
  });

  it("copies a staff member it's about, by the name their Gmail sends as", async () => {
    const sent = notifications();
    await saveStaffAccount("jo@pauseai.uk", [], "test");
    await query("UPDATE staff_accounts SET gmail_name = 'Jo Bloggs'");
    await notifyStaff("Subject", "Body", null, "staff-alert", "jo@pauseai.uk");
    expect(sent).toEqual([expect.objectContaining({ To: toNotifications(), Cc: `"Jo Bloggs" <jo@pauseai.uk>` })]);
  });
});
