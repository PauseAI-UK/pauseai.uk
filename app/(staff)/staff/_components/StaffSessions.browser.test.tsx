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
    // A card, with what the sessions are over them.
    const card = page.getByRole("region", { name: staffCopy.me.sessionsTitle });
    await expect.element(card.getByText(copy.intro)).toBeVisible();
    // A row each: its browser and system, or that they're not known; when it began and ends; and only one that's kept says so.
    const rows = card.getByRole("list", { name: staffCopy.me.sessionsTitle }).getByRole("listitem").all();
    expect(rows.map((row) => row.element().textContent)).toEqual([
      `Firefox · Linux${copy.thisBrowser}${copy.started} 22 Oct 2026, 09:00${copy.ends} 23 Oct 2026, 09:00${staffCopy.nav.logout}`,
      `${copy.unknown}${copy.started} 20 Oct 2026, 08:00${copy.ends} 21 Nov 2026, 08:00${copy.kept}${staffCopy.nav.logout}`,
    ]);
    const form = page.getByRole("button", { name: copy.logOutEverywhere }).element().closest("form")!;
    expect(form.getAttribute("method")).toBe("post");
    expect(form.getAttribute("action")).toBe("/staff/api/logout");
    expect(new FormData(form).get("everywhere")).toBe("1");
    // Each row's Log out ends that one.
    const ones = page.getByRole("button", { name: staffCopy.nav.logout }).all();
    expect(ones.map((button) => new FormData(button.element().closest("form")!).get("session"))).toEqual([
      "session-1",
      "session-2",
    ]);
  });
});
