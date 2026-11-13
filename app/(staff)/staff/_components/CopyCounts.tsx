"use client";

// How many copies of a broadcast or mailing, or letters of a campaign, are
// in each state, two ways (docs/style-guide.md, "Status colours"): on its
// page, in two groups, those that went and those that didn't, each its
// total over its counts; in a list of them, only those that need a look, and
// the rest folded behind how many are fine. A count of none isn't shown.
// Each count is in the colour of its recipients' tags, and leads to its tab.
import { useState } from "react";
import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import Counts, { type Count } from "./ui/Counts";
import StaffLink from "./ui/StaffLink";
import styles from "./CopyCounts.module.css";

const copy = staffCopy.copyStates;

/** A group of counts, its total before them. */
export type CountGroup = { key: string; label: string; counts: Count[] };

/** The tones that ask for a look: red bad, amber sad, blue for staff to do. */
const NEEDS_A_LOOK = new Set<Count["tone"]>(["red", "amber", "blue"]);

const total = (counts: Count[]) => counts.reduce((sum, count) => sum + count.n, 0);

/** A count as a tag in its colour, a grey count's plain, leading to its tab. */
function CountTag({ count }: { count: Count }) {
  return (
    <StaffLink href={count.href!} className={styles.link}>
      <Tag tone={count.tone === "grey" ? undefined : count.tone}>
        {count.n.toLocaleString("en-GB")} {count.label}
      </Tag>
    </StaffLink>
  );
}

/**
 * Each group as its total over its counts of more than none (Counts), so
 * the words above say what they hold. Side by side, wrapping between groups.
 * A group of none isn't shown.
 */
export function CountGroups({ groups }: { groups: CountGroup[] }) {
  return (
    <div className={styles.groups}>
      {groups
        .filter((group) => total(group.counts))
        .map((group) => (
          <fieldset key={group.key} className={styles.group}>
            <legend className={styles.total}>
              <strong>{total(group.counts).toLocaleString("en-GB")}</strong> {group.label}
            </legend>
            <Counts counts={group.counts.filter((count) => count.n)} />
          </fieldset>
        ))}
    </div>
  );
}

/**
 * The counts that need a look; then how many are fine, which unfolds the
 * rest under them. Only counts of more than none show.
 */
export function NeedsAndFine({ counts }: { counts: Count[] }) {
  const [open, setOpen] = useState(false);
  const shown = counts.filter((count) => count.n);
  const needs = shown.filter((count) => NEEDS_A_LOOK.has(count.tone));
  const fine = shown.filter((count) => !needs.includes(count));
  return (
    <span className={styles.needs}>
      {needs.map((count) => (
        <CountTag key={count.key} count={count} />
      ))}
      {fine.length > 0 && (
        <button type="button" className={styles.fine} aria-expanded={open} onClick={() => setOpen(!open)}>
          {(needs.length ? copy.andFine : copy.allFine)(total(fine))} {open ? "▾" : "▸"}
        </button>
      )}
      {open && (
        <span className={styles.rest}>
          {fine.map((count) => (
            <CountTag key={count.key} count={count} />
          ))}
        </span>
      )}
    </span>
  );
}
