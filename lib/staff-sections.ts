import type { Permission } from "./staff-permissions";

// The staff interface's pages, in sections, for the navigation. A page with
// a permission shows only to those who have it, and requires it
// (requireStaff(permission)), as do the pages under it: a supporter's page
// is under Supporters, a letter's under Campaigns. A section shows the pages
// you can open, and hides when there are none.
// tests/checks/staff-auth.test.ts checks every page asks for what its place
// here says.

export type StaffPageId =
  | "supporters"
  | "broadcasts"
  | "signupUpload"
  | "campaigns"
  | "events"
  | "supporterEmails"
  | "politicians"
  | "asks"
  | "mailings"
  | "emails"
  | "mpEmails"
  | "import"
  | "accounts"
  | "changes"
  | "sentEmails"
  | "errors";
export type StaffSectionId = "supporters" | "events" | "politicians" | "admin";

/**
 * A page in the navigation: which, where, and the permission it needs. The
 * paths `under` it too, besides its own: pages that belong with it but live
 * elsewhere. `draft`, for a page to try out that can't do its job yet, which says so in the navigation.
 */
export type StaffPageLink = { id: StaffPageId; href: string; permission?: Permission; under?: string[]; draft?: true };

export type StaffSection = { id: StaffSectionId; pages: StaffPageLink[] };

const STAFF_SECTIONS: readonly StaffSection[] = [
  {
    id: "supporters",
    pages: [
      // A supporter's letters are a page of the supporter's.
      { id: "supporters", href: "/staff/supporters", permission: "supporters", under: ["/staff/letters/supporter"] },
      // A letter's page stays at /staff/letters/[id], and shows in Campaigns.
      { id: "campaigns", href: "/staff/campaigns", permission: "supporters", under: ["/staff/letters"] },
      { id: "broadcasts", href: "/staff/broadcasts", permission: "supporters", draft: true },
      { id: "supporterEmails", href: "/staff/supporters/blocked-emails", permission: "supporters" },
      { id: "signupUpload", href: "/staff/supporters/import", permission: "supporters" },
    ],
  },
  {
    id: "politicians",
    pages: [
      { id: "politicians", href: "/staff/politicians" },
      { id: "asks", href: "/staff/asks" },
      { id: "mailings", href: "/staff/mailings" },
      { id: "emails", href: "/staff/emails", under: ["/staff/one-off"] },
      { id: "mpEmails", href: "/staff/politicians/blocked-emails" },
    ],
  },
  {
    id: "events",
    // Our events and who owns each: no one's personal details, so open to all staff.
    pages: [{ id: "events", href: "/staff/events" }],
  },
  {
    id: "admin",
    pages: [
      { id: "import", href: "/staff/scheduled-jobs" },
      { id: "sentEmails", href: "/staff/sent-emails", permission: "admin" },
      { id: "changes", href: "/staff/audit-log", permission: "admin" },
      { id: "errors", href: "/staff/errors", permission: "admin" },
      { id: "accounts", href: "/staff/accounts", permission: "admin" },
    ],
  },
];

/** The sections a staff member with `permissions` sees, each with only the pages they can open. */
export function sectionsFor(permissions: readonly Permission[]): StaffSection[] {
  return STAFF_SECTIONS.map((section) => ({
    ...section,
    pages: section.pages.filter((page) => !page.permission || permissions.includes(page.permission)),
  })).filter((section) => section.pages.length > 0);
}

/** The IDs of the pages a staff member with `permissions` can open. */
export function pagesFor(permissions: readonly Permission[]): StaffPageId[] {
  return sectionsFor(permissions).flatMap((section) => section.pages.map((page) => page.id));
}

/**
 * The page in the navigation a path is, or is under: the one with the
 * longest whole-segment prefix of it, its href or one it has `under` it. So
 * /staff/supporters/7 is under Supporters, /staff/supporters/blocked-emails
 * is its own page, and /staff/letters/supporter/7 is under Supporters too.
 */
export function staffPageOf(path: string): StaffPageLink | undefined {
  const within = (prefix: string) => (path === prefix || path.startsWith(`${prefix}/`) ? prefix.length : 0);
  return STAFF_SECTIONS.flatMap((section) => section.pages)
    .map((page) => ({ page, length: Math.max(...[page.href, ...(page.under ?? [])].map(within)) }))
    .filter(({ length }) => length > 0)
    .sort((a, b) => b.length - a.length)[0]?.page;
}

/** Where a page in the navigation is. */
export function staffPageHref(id: StaffPageId): string {
  return STAFF_SECTIONS.flatMap((section) => section.pages).find((page) => page.id === id)!.href;
}

/** How long a page shows as new after someone first saw it. */
export const NEW_FOR_DAYS = 3;
