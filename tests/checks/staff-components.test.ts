import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Each staff feature's code is in its own folders: its components in
// app/(staff)/staff/_components/<feature>/, its logic in lib/<feature>/
// (docs/code-structure.md, "Feature folders"). At the top of those folders,
// and of lib/server/, are only what every feature stands on, and the public
// site's own helpers (STAYS): a new file goes in its feature's folder, or
// here with why. A file is named by its name up to the first dot, so a component's
// stylesheet, tests and examples go with it.
const ROOT = join(__dirname, "..", "..");
const STAFF_COMPONENTS = "app/(staff)/staff/_components";

const STAYS: Record<string, string[]> = {
  [STAFF_COMPONENTS]: [
    // A link to one of the public site's campaigns (lib/email-your-mp.ts), which supporters', politicians', letters'
    // and the audit log's pages show: in mailings', whose campaigns' pages they are, it would make politicians and
    // mailings use each other.
    "CampaignName",
  ],
  lib: [
    // The staff lists and forms, which every feature's lists and forms are made with, and the politicians'
    // markers, which the politicians', letters' and every email's lists filter by.
    "filter-choices",
    "list-params",
    "politician-flags",
    "saved-filters",
    "staff-forms",
    "staff-list",
    "staff-list-filters",
    "staff-lists",
    "staff-search",
    "staff-sort",
    "staff-vocabulary",
    "time-windows",
    // The audit log, which every feature writes to: what each entry holds, and a field's change.
    "audit-events",
    "field-changes",
    // A list's download as contact cards, which the supporters' and politicians' lists and the downloads make.
    "vcard",
    // The staff pages' frame, which the kit and the sidebar draw: the pages in their sections, their kinds, the sidebar's folding.
    "staff-nav",
    "staff-page-kinds",
    "staff-sections",
    // Small helpers any page may use.
    "browser-errors",
    "dated-groups",
    "found",
    "leave-page",
    "metadata",
    "now",
    "phone",
    "site-url",
    "staff-time",
    "time-range",
    "user-agent",
    // The public site's own.
    "analytics",
    "calendar-days",
    "controlai-letter",
    "email-your-mp",
    "event-image-hosts",
    "going",
    "map-connector",
    "march-registration",
    "navigate",
    "popover-placement",
    "sentiment-map",
    "shuffle",
    "site-events",
    "site-events-url",
    "storyRender",
    "trackers",
    // ControlAI's statement's signatories, which its import (jobs), politicians' official profiles and its binding read.
    "controlai-statement",
    // The import log, which every job keeps its runs in, whichever feature's it is: each job's name, page and
    // schedule, and what its runs found, and its words.
    "import-runs",
    "import-runs-copy",
  ],
  "lib/server": [
    // The database, settings, problems and runs, the import log they're kept in, what a fixture build adds, and the
    // words of the problems this folder's own code reports.
    "config",
    "copy",
    "db",
    "fixtures-only",
    "flow-database",
    "json",
    "import-runs",
    "migrations-check",
    "page-loaders",
    "problems",
    "random-id",
    "run-store",
    "sql",
    // The audit log, which every feature writes to, the sending layer and accounts included; its page reads it
    // in lib/oversight/.
    "audit",
    // Building a MIME message, which the Gmail binding (outside-services/) sends and the sending layer builds.
    "mime",
    // The staff lists' search, downloads and saved filters.
    "saved-filters",
    "search",
    "staff-download",
    "stored-filters",
  ],
};

/** A file's name up to its first dot: "Notes" for Notes.tsx, Notes.module.css and Notes.browser.test.tsx. */
function baseName(file: string): string {
  return file.split(".")[0];
}

/** The names of the files at the top of `folder`, its folders left out. */
function topFiles(folder: string): string[] {
  const names = readdirSync(join(ROOT, folder), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => baseName(entry.name));
  return [...new Set(names)];
}

describe("staff feature folders", () => {
  for (const folder of Object.keys(STAYS)) {
    it(`has at the top of ${folder} only what stays there`, () => {
      const known = new Set(STAYS[folder]);
      expect(topFiles(folder).filter((name) => !known.has(name))).toEqual([]);
    });

    it(`lists only files at the top of ${folder}, each once`, () => {
      const there = new Set(topFiles(folder));
      const listed = STAYS[folder];
      expect(listed.filter((name) => !there.has(name))).toEqual([]);
      expect(listed.filter((name, at) => listed.indexOf(name) !== at)).toEqual([]);
    });
  }

  it("names a file by its name up to the first dot", () => {
    expect(["Notes.tsx", "Notes.module.css", "Notes.browser.test.tsx", "token.d.mts", "README"].map(baseName)).toEqual([
      "Notes",
      "Notes",
      "Notes",
      "token",
      "README",
    ]);
  });
});
