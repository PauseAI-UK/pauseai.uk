import Image from "next/image";
import Section from "@/components/ui/Section";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  newsRow1,
  newsRow2,
  newsMobileRow1,
  newsMobileRow2,
  newsMobileRow3,
  outletAnchor,
  type PressLogo,
} from "@/lib/content/press-logos";
import styles from "./PressMarquee.module.css";

/** A row of logos, each linking to its outlet's newest piece on /press. */
export function NewsRow({ items, reverse = false }: { items: PressLogo[]; reverse?: boolean }) {
  return (
    <div className={reverse ? `${styles.row} ${styles.reverse}` : styles.row}>
      <div className={styles.track} data-marquee-track="news">
        {[0, 1].map((copyIdx) => (
          <div
            key={copyIdx}
            className={styles.copy}
            data-marquee-copy=""
            {...(copyIdx > 0 ? { "aria-hidden": true } : {})}
          >
            {items.map((item, i) => (
              <Link
                key={i}
                className={styles.item}
                href={`/press#${outletAnchor(item.outlet)}`}
                {...(copyIdx > 0 ? { tabIndex: -1 } : {})}
              >
                <div className={styles.logoBox}>
                  <Image
                    className={styles.logo}
                    src={item.logoSrc}
                    alt={item.outlet}
                    width={item.logoIntrinsicWidth}
                    height={item.logoIntrinsicHeight}
                    loading="lazy"
                    style={{ "--logo-h": item.logoHeight } as CSSProperties}
                  />
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Press coverage logos scrolling past: two rows on desktop, three on phones.
export default function PressMarquee() {
  return (
    <Section id="news" snug>
      <div className={styles.marquee} aria-label="Press coverage of PauseAI UK">
        <div className={styles.desktop} aria-hidden={false}>
          <NewsRow items={newsRow1} />
          <NewsRow items={newsRow2} reverse />
        </div>
        <div className={styles.mobile} aria-hidden={true}>
          <NewsRow items={newsMobileRow1} />
          <NewsRow items={newsMobileRow2} reverse />
          <NewsRow items={newsMobileRow3} />
        </div>
      </div>
      <div className={`container ${styles.cta}`}>
        <Link className="inline-link" href="/press">
          See our press page →
        </Link>
      </div>
    </Section>
  );
}
