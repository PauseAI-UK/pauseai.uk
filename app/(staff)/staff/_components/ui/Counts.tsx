import { filtersPath } from "@/lib/list-params";
import StaffLink from "./StaffLink";
import styles from "./Counts.module.css";

/**
 * One count: its number; its label; where it leads; and its tone, the
 * number on that colour when it isn't 0: red bad, amber sad, green good,
 * blue for staff to do, grey normal. `current` marks the one a list under
 * it is filtered to; `title`, what pressing it does, when that isn't plain.
 */
export type Count = {
  key: string;
  n: number;
  label: string;
  href?: string;
  tone?: "red" | "amber" | "green" | "blue" | "grey";
  current?: boolean;
  title?: string;
};

/** Counts that each open `path` with their own tab already chosen. */
export function countsOpening<T extends Count>(path: string, counts: T[]): T[] {
  return counts.map((count) => ({ ...count, href: filtersPath(path, { tab: count.key }) }));
}

/**
 * Counts over a list on `path`, each showing those it counts: the one the
 * list is filtered to (`tab`) marked, and pressed again showing everyone, as
 * its `title` (`showEveryone`) says.
 */
export function countsFiltering<T extends Count>(path: string, counts: T[], tab: string, showEveryone: string): T[] {
  return counts.map((count) => {
    const current = count.key === tab;
    return {
      ...count,
      href: filtersPath(path, { tab: current ? "" : count.key }),
      current,
      title: current ? showEveryone : undefined,
    };
  });
}

/**
 * Numbers side by side in one white box, each over its label, a 0 grey (a
 * supporter's events and letters, how a mailing went). Each leads where its
 * `href` says. `small` in a list's row.
 */
export default function Counts({ counts, small = false }: { counts: Count[]; small?: boolean }) {
  const cells = counts.map((count) => {
    // The whole box in its colour, when it counts any.
    const tone = (count.n && count.tone) || undefined;
    const inner = (
      <>
        <strong data-zero={!count.n || undefined}>{count.n.toLocaleString("en-GB")}</strong> {count.label}
      </>
    );
    return count.href ? (
      <StaffLink
        key={count.key}
        href={count.href}
        className={styles.count}
        data-tone={tone}
        aria-current={count.current ? "true" : undefined}
        title={count.title}
      >
        {inner}
      </StaffLink>
    ) : (
      <span key={count.key} className={styles.count} data-tone={tone}>
        {inner}
      </span>
    );
  });
  return <div className={small ? `${styles.counts} ${styles.small}` : styles.counts}>{cells}</div>;
}
