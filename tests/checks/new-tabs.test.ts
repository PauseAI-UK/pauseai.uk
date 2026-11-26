import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// A link on a staff page that opens a new tab is an ExternalLink, so it has
// the arrow that says it leaves and the tooltip that says so, and never goes
// to a staff page, which ExternalLink refuses. This fails on a
// target="_blank" written anywhere else in the staff pages.
const ROOT = join(__dirname, "..", "..");
const STAFF = join(ROOT, "app", "(staff)");

// The staff files that open new tabs of their own, and why.
const OWN_NEW_TABS: Record<string, string> = {
  "app/(staff)/staff/_components/ui/ExternalLink.tsx": "ExternalLink itself",
  "app/(staff)/staff/_components/mailings/MailingLetter.tsx":
    "a letter's links as its recipient sees them, without the staff pages' arrow",
  "app/(staff)/staff/_components/broadcasts/TextBubble.tsx":
    "a WhatsApp message's links as its recipient sees them, without the staff pages' arrow",
  "app/(staff)/staff/_components/mailings/MailingFiles.tsx": "an attachment's thumbnail, which opens the file itself",
  "app/(staff)/staff/_components/broadcasts/PlaceMap.tsx": "the whole of a map, which opens the place on Google Maps",
};

/** Every .tsx under dir, tests left out. */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [path] : [];
  });
}

/** Whether `source` opens a new tab itself. */
const opensNewTab = (source: string) => /target=(?:"_blank"|\{"_blank"\})/.test(source);

describe("new tabs on staff pages", () => {
  it("are ExternalLinks, everywhere but the files listed", () => {
    const found = tsxFiles(STAFF)
      .map((path) => relative(ROOT, path))
      .filter((file) => !(file in OWN_NEW_TABS) && opensNewTab(readFileSync(join(ROOT, file), "utf8")));
    expect(found).toEqual([]);
  });

  it("lists only files that still open new tabs of their own", () => {
    const stale = Object.keys(OWN_NEW_TABS).filter((file) => !opensNewTab(readFileSync(join(ROOT, file), "utf8")));
    expect(stale).toEqual([]);
  });

  it("finds a new tab written either way, and not another target", () => {
    expect(opensNewTab('<a href={url} target="_blank">')).toBe(true);
    expect(opensNewTab('<a href={url} target={"_blank"}>')).toBe(true);
    expect(opensNewTab('<a href={url} target="_self">')).toBe(false);
  });
});
