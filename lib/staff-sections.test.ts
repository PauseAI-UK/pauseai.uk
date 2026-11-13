import { describe, expect, it } from "vitest";
import { sectionsFor, staffPageHref, staffPageOf } from "./staff-sections";

const pages = (permissions: Parameters<typeof sectionsFor>[0]) =>
  sectionsFor(permissions).map((s) => [s.id, s.pages.map((p) => p.id)]);

describe("sectionsFor", () => {
  it("shows each section with only the pages the permissions open, and hides an empty one", () => {
    expect(pages([])).toEqual([
      ["politicians", ["politicians", "asks", "mailings", "emails", "mpEmails"]],
      ["events", ["events"]],
      ["admin", ["import"]],
    ]);
    expect(pages(["supporters"])).toEqual([
      ["supporters", ["supporters", "campaigns", "broadcasts", "supporterEmails", "signupUpload"]],
      ["politicians", ["politicians", "asks", "mailings", "emails", "mpEmails"]],
      ["events", ["events"]],
      ["admin", ["import"]],
    ]);
    expect(pages(["admin"])).toEqual([
      ["politicians", ["politicians", "asks", "mailings", "emails", "mpEmails"]],
      ["events", ["events"]],
      ["admin", ["import", "sentEmails", "changes", "errors", "accounts"]],
    ]);
  });
});

describe("staffPageOf", () => {
  it("finds the page a path is, or is under, by the longest whole segment", () => {
    expect(staffPageOf("/staff/supporters")?.id).toBe("supporters");
    expect(staffPageOf("/staff/supporters/[id]/erase")?.id).toBe("supporters");
    expect(staffPageOf("/staff/supporters/bounced-emails")?.id).toBe("supporterEmails");
    expect(staffPageOf("/staff/letters/supporter/[id]")?.id).toBe("supporters");
    expect(staffPageOf("/staff/letters/[id]")?.id).toBe("campaigns");
    expect(staffPageOf("/staff/campaigns/[slug]")?.id).toBe("campaigns");
    expect(staffPageOf("/staff/politicians/[id]")).toEqual({ id: "politicians", href: "/staff/politicians" });
    expect(staffPageOf("/staff/one-off/[id]")?.id).toBe("emails");
    expect(staffPageOf("/staff/mailings/[id]")?.id).toBe("mailings");
    expect(staffPageOf("/staff/lettersx")).toBeUndefined();
    expect(staffPageOf("/staff")).toBeUndefined();
  });
});

describe("staffPageHref", () => {
  it("says where a page in the navigation is", () => {
    expect(staffPageHref("supporters")).toBe("/staff/supporters");
    expect(staffPageHref("import")).toBe("/staff/scheduled-jobs");
    expect(staffPageHref("mpEmails")).toBe("/staff/politicians/addresses-to-fix");
  });
});
