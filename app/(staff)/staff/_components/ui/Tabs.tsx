import StaffLink from "./StaffLink";
import styles from "./Tabs.module.css";

/** A tab: its words, and with `badge`, a count after them in an orange pill, for a tab set apart. */
export type Tab = { key: string; label: string; href: string; badge?: number };

/**
 * A row of links, one of which is chosen: views of one list, such as its
 * houses. The chosen one is underlined and marked as the page. It scrolls
 * sideways on a phone rather than wrapping.
 */
export default function Tabs({ label, tabs, current }: { label: string; tabs: Tab[]; current: string }) {
  return (
    <nav aria-label={label} className={styles.tabs}>
      {tabs.map((tab) => (
        <StaffLink key={tab.key} href={tab.href} aria-current={tab.key === current ? "page" : undefined}>
          {tab.label}
          {tab.badge !== undefined && <span className={styles.badge}>{tab.badge}</span>}
        </StaffLink>
      ))}
    </nav>
  );
}

/** A tab of `ButtonTabs`: its words, and the id its panel is labelled by. */
export type ButtonTab = { key: string; label: string; id: string };

/**
 * Tabs that switch what's under them on the page itself, rather than go to
 * another page: buttons, as a screen reader hears tabs, looking as Tabs do.
 * The panel under them is labelled by the chosen one's `id`
 * (`aria-labelledby`), so it stays where it is as they switch.
 */
export function ButtonTabs({
  label,
  tabs,
  current,
  onChoose,
}: {
  label: string;
  tabs: ButtonTab[];
  current: string;
  onChoose: (key: string) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          id={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.key === current}
          onClick={() => onChoose(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
