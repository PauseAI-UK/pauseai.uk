import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import StaffSessions from "./StaffSessions";

describe("StaffSessions", () => {
  it("lists each session, marks this browser's, and logs out of all of them with a POST", async () => {
    await render(
      <StaffSessions
        sessions={[
          {
            id: "session-1",
            userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
            startedAt: new Date("2026-10-22T09:00:00Z"),
            expiresAt: new Date("2026-10-23T09:00:00Z"),
            remember: false,
            current: true,
          },
          {
            id: "session-2",
            userAgent: null,
            startedAt: new Date("2026-10-20T08:00:00Z"),
            expiresAt: new Date("2026-11-21T08:00:00Z"),
            remember: true,
            current: false,
          },
        ]}
      />,
    );
    const copy = staffCopy.sessions;
    const rows = page.getByRole("row").all().slice(1);
    expect(rows.map((row) => row.element().textContent)).toEqual([
      `FirefoxLinux22 Oct 2026, 09:0023 Oct 2026, 09:00${copy.kept.no}${copy.thisBrowser}${staffCopy.nav.logout}`,
      `${copy.unknown}${copy.unknown}20 Oct 2026, 08:0021 Nov 2026, 08:00${copy.kept.yes}${staffCopy.nav.logout}`,
    ]);
    const form = page.getByRole("button", { name: copy.logOutEverywhere }).element().closest("form")!;
    expect(form.getAttribute("method")).toBe("post");
    expect(form.getAttribute("action")).toBe("/staff/api/logout");
    expect(new FormData(form).get("everywhere")).toBe("1");
    // Its rows are centred, as they hold buttons.
    expect(getComputedStyle(page.getByRole("cell", { name: copy.kept.yes }).element()).verticalAlign).toBe("middle");
    // Each row's Log out ends that one.
    const ones = page.getByRole("button", { name: staffCopy.nav.logout }).all();
    expect(ones.map((button) => new FormData(button.element().closest("form")!).get("session"))).toEqual([
      "session-1",
      "session-2",
    ]);
  });
});
