import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./BriefingFigure.module.css";

/**
 * A drawing across the width of a briefing's box, such as a diagram, with
 * the marks citing its sources under it at the right. Its words are part of
 * the drawing, so on a phone it keeps a width they can be read at, and
 * scrolls sideways.
 */
export default function BriefingFigure({
  src,
  alt,
  width,
  height,
  cite,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** The sources' footnote marks. */
  cite: ReactNode;
}) {
  return (
    <figure className={styles.figure}>
      {/* Focusable, so a keyboard can scroll it on a phone. */}
      <div className={styles.scroller} role="region" aria-label={alt} tabIndex={0}>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="(max-width: 820px) 720px, 900px"
          className={styles.picture}
        />
      </div>
      <p className={styles.cite}>{cite}</p>
    </figure>
  );
}
