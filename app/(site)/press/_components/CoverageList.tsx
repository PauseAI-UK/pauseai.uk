"use client";

import { useSyncExternalStore } from "react";
import { outletAnchor } from "@/lib/content/press-logos";
import { firstOfEachOutlet, formatCoverageDate, type CoverageItem } from "@/lib/press/coverage";
import pickedStyles from "@/components/ui/Picked.module.css";
import styles from "./PressKit.module.css";

/** Calls `changed` whenever the address's fragment changes. */
function subscribe(changed: () => void): () => void {
  window.addEventListener("hashchange", changed);
  return () => window.removeEventListener("hashchange", changed);
}

/** The outlet the address picks, as its anchor ("bbc"), or none. */
const picked = () => decodeURIComponent(window.location.hash.slice(1));

/**
 * The coverage, newest first. Each outlet's newest piece carries the
 * outlet's anchor, which its homepage logo links to (/press#bbc). The
 * outlet an address picks so has every one of its pieces picked out
 * (ui/Picked), and the browser scrolls to its newest.
 */
export default function CoverageList({ coverage }: { coverage: CoverageItem[] }) {
  const outlet = useSyncExternalStore(subscribe, picked, () => "");
  const anchored = firstOfEachOutlet(coverage);
  return (
    <ul className={styles.coverageList}>
      {coverage.map((item) => {
        const anchor = outletAnchor(item.outlet);
        const row = {
          id: anchored.has(item.id) ? anchor : undefined,
          className:
            outlet !== "" && anchor === outlet ? `${styles.coverageItem} ${pickedStyles.picked}` : styles.coverageItem,
        };
        return item.links ? (
          <li key={item.id} {...row}>
            <div className={`${styles.coverageLink} ${styles.coverageLinkStatic}`}>
              <span className={styles.coverageDate}>{formatCoverageDate(item.date)}</span>
              <span className={styles.coverageOutlet}>{item.outlet}</span>
              <span className={styles.coveragePlatforms}>
                {item.links.map((link, i) => (
                  <span key={link.url}>
                    {i > 0 && ", "}
                    <a href={link.url} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  </span>
                ))}
              </span>
              <span className={styles.coverageTitle}>{item.title}</span>
            </div>
          </li>
        ) : (
          <li key={item.id} {...row}>
            <a className={styles.coverageLink} href={item.url} target="_blank" rel="noreferrer">
              <span className={styles.coverageDate}>{formatCoverageDate(item.date)}</span>
              <span className={styles.coverageOutlet}>{item.outlet}</span>
              <span className={styles.coverageMedium}>{item.medium}</span>
              <span className={styles.coverageTitle}>{item.title}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
