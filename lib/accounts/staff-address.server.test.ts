import { describe, expect, it } from "vitest";
import { query } from "@/lib/server/db.server";
import { staffAddressLine } from "./staff-address.server";
import { saveStaffAccount } from "./staff-accounts.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";

describe("staff-address", () => {
  describeWithDatabase("staffAddressLine", () => {
    useTestDatabase();

    it("names a staff member as their Gmail sends, and leaves bare one with no name, or no account", async () => {
      await saveStaffAccount("jo@pauseai.uk", [], "test");
      await saveStaffAccount("sam@pauseai.uk", [], "test");
      await query("UPDATE staff_accounts SET gmail_name = 'Jo Bloggs' WHERE email = 'jo@pauseai.uk'");
      await query("UPDATE staff_accounts SET gmail_name = '' WHERE email = 'sam@pauseai.uk'");
      expect(await staffAddressLine("Jo@PauseAI.uk")).toBe(`"Jo Bloggs" <Jo@PauseAI.uk>`);
      expect(await staffAddressLine("sam@pauseai.uk")).toBe("sam@pauseai.uk");
      expect(await staffAddressLine("nobody@pauseai.uk")).toBe("nobody@pauseai.uk");
    });
  });
});
