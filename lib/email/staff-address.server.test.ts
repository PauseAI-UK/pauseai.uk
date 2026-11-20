import { describe, expect, it } from "vitest";
import { query } from "@/lib/server/db.server";
import { staffAddressLine, staffFirstName } from "./staff-address.server";
import { saveStaffAccount } from "@/lib/accounts/staff-accounts.server";
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

  describeWithDatabase("staffFirstName", () => {
    useTestDatabase();

    it("is the first word of the name their Gmail sends as, or their address's first part, capitalised", async () => {
      await saveStaffAccount("jo@pauseai.uk", [], "test");
      await query("UPDATE staff_accounts SET gmail_name = ' jo Bloggs' WHERE email = 'jo@pauseai.uk'");
      expect(await staffFirstName("Jo@PauseAI.uk")).toBe("Jo");
      expect(await staffFirstName("francis@pauseai.uk")).toBe("Francis");
    });
  });
});
